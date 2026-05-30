/**
 * GET /api/internal/tenant-config?tenant=<slug>
 *
 * VPS-side agents (Eli, Marco, Kai, etc.) read decrypted credentials from
 * the per-tenant vault via HTTP because the VPS does not hold the
 * ENCRYPTION_KEY — Vercel does. This endpoint is the only safe vault
 * read path for the agent fleet.
 *
 * Auth: x-internal-secret header matching WEBHOOK_SECRET env var (same
 * shared secret used by /api/agents/[name]/trigger and the geo-webhook
 * service on the VPS, so there is exactly one rotation point).
 *
 * Response is the full TenantConfig (see src/lib/credentials.ts) with
 * decrypted secret values. Cached: never. Logged: per-call audit row in
 * the future (TODO once the AuditLog model is wired).
 *
 * Example (from VPS):
 *   curl -s "https://www.investoros.tech/api/internal/tenant-config?tenant=geo-carpentry" \
 *        -H "x-internal-secret: $WEBHOOK_SECRET" | jq .wordpress
 */
import { NextRequest, NextResponse } from "next/server";
import { getTenantConfigBySlug } from "@/lib/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "Server not configured (WEBHOOK_SECRET missing)" },
      { status: 500 }
    );
  }
  if (!secret || secret !== expected) {
    // No timing-attack mitigation here yet — this is internal-only over HTTPS
    // and the secret is 64 hex chars (256-bit). Add constant-time compare if
    // we ever expose this to a wider audience.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = req.nextUrl.searchParams.get("tenant");
  if (!tenant) {
    return NextResponse.json(
      { error: "Missing required query param: tenant" },
      { status: 400 }
    );
  }

  try {
    const config = await getTenantConfigBySlug(tenant);
    return NextResponse.json(config, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[internal/tenant-config] lookup failed for ${tenant}:`,
      msg
    );
    return NextResponse.json(
      { error: msg },
      { status: msg.includes("not found") ? 404 : 500 }
    );
  }
}
