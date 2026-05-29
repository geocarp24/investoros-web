/**
 * POST /api/admin/seed-tenant
 *
 * One-shot bootstrap endpoint that seeds bootstrap tenant rows (Geo Carpentry,
 * Pinnacle) and migrates their AIRTABLE_TOKEN env vars into the encrypted vault.
 *
 * Auth: requires `x-admin-secret` header matching WEBHOOK_SECRET env var.
 * (Using the same secret as the VPS webhook for simplicity — we trust whoever
 * holds it. Long-term this should be a separate admin secret.)
 *
 * Idempotent — safe to re-run. Upserts tenant rows and updates encrypted
 * credentials on every call.
 *
 * Example:
 *   curl -X POST https://www.investoros.tech/api/admin/seed-tenant \
 *     -H "x-admin-secret: <WEBHOOK_SECRET>"
 *
 * Response:
 *   { ok: true, report: { tenants: [...] } }
 */
import { NextRequest, NextResponse } from "next/server";
import { seedTenants } from "../../../../../prisma/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminSecret = req.headers.get("x-admin-secret");
  const expected = process.env.WEBHOOK_SECRET;

  if (!expected) {
    return NextResponse.json(
      { error: "Server not configured (WEBHOOK_SECRET missing)" },
      { status: 500 }
    );
  }
  if (!adminSecret || adminSecret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const report = await seedTenants();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/seed-tenant] failed:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
