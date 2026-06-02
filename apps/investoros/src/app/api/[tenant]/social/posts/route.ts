/**
 * GET /api/[tenant]/social/posts
 *
 * Returns posts from the tenant's SM tables (Posts + Reels + Videos) for the
 * social-calendar UI. Auth via Clerk session: user must have publicMetadata.tenantId
 * matching the requested tenant slug.
 *
 * Response:
 *   { posts: Array<{id, title, caption, status, theme, visual_url, scheduled_for, format}> }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { getTenantConfigBySlug } from "@/lib/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
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

  const config = await getTenantConfigBySlug(tenant);
  const baseId = config.airtable.baseId;
  const token = config.airtable.token;

  const tables: Array<{ id: string; format: "Post" | "Reel" | "Video" }> = [
    { id: "tblBbSbpzzANl74y0", format: "Post" },
    { id: "tblF6RDSTysUtb7bf", format: "Reel" },
    { id: "tblbmEQluqQU1Yft0", format: "Video" },
  ];

  const posts: Array<{
    id: string;
    title: string;
    caption: string;
    status: string;
    theme: string;
    visual_url: string;
    scheduled_for: string | null;
    format: string;
  }> = [];

  for (const t of tables) {
    const url = `https://api.airtable.com/v0/${baseId}/${t.id}?pageSize=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) continue;
    const data = (await res.json()) as { records?: Array<{ id: string; fields: Record<string, unknown> }> };
    for (const r of data.records ?? []) {
      const f = r.fields;
      posts.push({
        id: r.id,
        title: String(f.Title ?? f.title ?? "(untitled)"),
        caption: String(f.Caption ?? ""),
        status: String(f.Status ?? "Idea"),
        theme: String(f.Theme ?? "T1"),
        visual_url: String(f.visual_url ?? ""),
        scheduled_for: f.scheduled_for ? String(f.scheduled_for) : null,
        format: t.format,
      });
    }
  }

  return NextResponse.json({ posts }, {
    headers: { "Cache-Control": "no-store" },
  });
}
