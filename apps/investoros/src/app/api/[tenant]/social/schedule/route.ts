/**
 * POST /api/[tenant]/social/schedule
 *
 * Sets scheduled_for on a Geo_Posts/Reels/Videos row. The VPS cron picks up
 * rows with Status=Visual Listo + scheduled_for in past/now and publishes them
 * via Precision Live Publishing (graph_api.mjs publishFacebookPhotoPost).
 *
 * Body: { recordId, format: "Post"|"Reel"|"Video", scheduledFor: ISO timestamp }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { getTenantConfigBySlug } from "@/lib/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE_BY_FORMAT: Record<string, string> = {
  Post: "tblBbSbpzzANl74y0",
  Reel: "tblF6RDSTysUtb7bf",
  Video: "tblbmEQluqQU1Yft0",
};

interface Body {
  recordId?: string;
  format?: string;
  scheduledFor?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const userTenantId = user?.publicMetadata?.tenantId as string | undefined;
  const tenantRow = await db.tenant.findUnique({ where: { slug: tenant } });
  if (!tenantRow) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (userTenantId && userTenantId !== tenantRow.id) {
    return NextResponse.json({ error: "Forbidden — tenant mismatch" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const { recordId, format, scheduledFor } = body;
  if (!recordId || !format || !scheduledFor) {
    return NextResponse.json(
      { error: "Missing required field: recordId, format, scheduledFor" },
      { status: 400 }
    );
  }

  const tableId = TABLE_BY_FORMAT[format];
  if (!tableId) {
    return NextResponse.json({ error: `Unknown format: ${format}` }, { status: 400 });
  }

  // Validate scheduledFor is a future ISO date
  const ts = Date.parse(scheduledFor);
  if (Number.isNaN(ts)) {
    return NextResponse.json({ error: "Invalid scheduledFor (must be ISO timestamp)" }, { status: 400 });
  }
  if (ts < Date.now() + 60 * 1000) {
    return NextResponse.json({ error: "scheduledFor must be at least 1 minute in the future" }, { status: 400 });
  }

  const config = await getTenantConfigBySlug(tenant);
  const url = `https://api.airtable.com/v0/${config.airtable.baseId}/${tableId}/${recordId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${config.airtable.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: { scheduled_for: scheduledFor },
      typecast: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Airtable update ${res.status}: ${text.slice(0, 200)}` }, { status: 500 });
  }
  const data = await res.json();
  return NextResponse.json({ ok: true, recordId, scheduledFor, fields: data.fields });
}
