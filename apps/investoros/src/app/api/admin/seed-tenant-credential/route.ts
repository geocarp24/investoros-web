/**
 * POST /api/admin/seed-tenant-credential
 *
 * Securely store a single credential into the per-tenant vault.
 *
 * Auth: x-admin-secret header matching WEBHOOK_SECRET env var.
 *
 * Body:
 *   {
 *     tenantSlug: string,        // "geo-carpentry" | "pinnacle" | etc.
 *     service:    string,        // "wordpress" | "google_business" | "telnyx" | ...
 *     keyName:    string,        // "app_password" | "client_secret" | "phone_number" | ...
 *     value:      string,        // the actual secret (encrypted before storage)
 *     metadata?:  Record<string, unknown>  // non-secret context (username, URL, expiry, etc.)
 *   }
 *
 * Returns:
 *   { ok: true, tenantId, service, keyName, encrypted: true }
 *   or
 *   { error: "..." }
 *
 * Idempotent — re-running with the same (tenantSlug, service, keyName)
 * tuple replaces the encrypted value. Use this to rotate credentials too.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { setCredential, type ServiceName } from "@/lib/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SERVICES: ServiceName[] = [
  "airtable",
  "telnyx",
  "buffer",
  "google_business",
  "hostinger_email",
  "wordpress",
  "social",
  "meta_graph",
  "facebook",
  "openphone",
  "clerk",
];

interface Body {
  tenantSlug?: string;
  service?: string;
  keyName?: string;
  value?: string;
  metadata?: Record<string, unknown>;
}

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

  const body = (await req.json().catch(() => ({}))) as Body;
  const { tenantSlug, service, keyName, value, metadata } = body;

  if (!tenantSlug || !service || !keyName || !value) {
    return NextResponse.json(
      { error: "Missing required field: tenantSlug, service, keyName, value" },
      { status: 400 }
    );
  }

  if (!ALLOWED_SERVICES.includes(service as ServiceName)) {
    return NextResponse.json(
      { error: `Unknown service: ${service}. Allowed: ${ALLOWED_SERVICES.join(", ")}` },
      { status: 400 }
    );
  }

  const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    return NextResponse.json(
      { error: `Tenant not found: ${tenantSlug}. Run /api/admin/seed-tenant first.` },
      { status: 404 }
    );
  }

  try {
    await setCredential(tenant.id, service as ServiceName, keyName, value, {
      metadata,
    });
    return NextResponse.json({
      ok: true,
      tenantId: tenant.id,
      service,
      keyName,
      encrypted: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/seed-tenant-credential] failed:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
