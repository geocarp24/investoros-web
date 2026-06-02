/**
 * POST /api/[tenant]/social/publish
 *
 * Publishes a Geo_Posts/Reels/Videos row IMMEDIATELY via FB Graph API
 * (Precision Live Publishing — visible in Meta Business Suite Published tab).
 * Triggers VPS publisher via webhook (port 3003) which has Cloudinary + Meta tokens.
 *
 * Body: { recordId, format: "Post"|"Reel"|"Video" }
 *
 * Returns: { ok: true, fb_post_id?, ig_post_id? }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  recordId?: string;
  format?: string;
}

const VPS_WEBHOOK_URL = process.env.VPS_WEBHOOK_URL || "http://187.77.215.146:3003/trigger";

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
  const { recordId, format } = body;
  if (!recordId || !format) {
    return NextResponse.json(
      { error: "Missing required field: recordId, format" },
      { status: 400 }
    );
  }

  // Trigger VPS publisher via webhook. The VPS has Cloudinary creds, Meta tokens
  // from vault, and the publishFacebookPhotoPost (Precision Live) implementation.
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "WEBHOOK_SECRET not configured" }, { status: 500 });
  }

  const targetPlatform = "FB"; // default to FB; UI can extend to IG later
  const res = await fetch(VPS_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": webhookSecret,
    },
    body: JSON.stringify({
      tenant,
      agent: "social_media",
      mode: "process_posts",
      args: {
        targetPlatform,
        targetFormat: format,
        recordId,
        max: 1,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `VPS publish trigger failed ${res.status}: ${text.slice(0, 300)}` },
      { status: 502 }
    );
  }

  const data = await res.json().catch(() => ({}));
  return NextResponse.json({
    ok: true,
    triggered: true,
    recordId,
    format,
    vps_response: data,
  });
}
