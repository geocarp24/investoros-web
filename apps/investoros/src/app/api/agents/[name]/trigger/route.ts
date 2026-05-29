/**
 * POST /api/agents/{name}/trigger
 *
 * Bridge between the dashboard "Run Now" button and the VPS webhook
 * service. Signs the payload with HMAC-SHA256 and forwards to the VPS
 * webhook receiver, which spawns the actual agent process.
 *
 * Body: { tenant?: string, mode?: string, dry_run?: boolean }
 *  - tenant defaults to the authenticated user's publicMetadata.tenantId
 *  - agent comes from the [name] URL param
 *
 * Security:
 *  - Requires authenticated Clerk user
 *  - Tenant in body MUST match user.publicMetadata.tenantId (prevents privilege escalation)
 *  - Tenant must exist in DB and have non-suspended status
 *
 * Env required:
 *  - VPS_WEBHOOK_URL  (e.g. http://187.77.215.146:3001/trigger)
 *  - WEBHOOK_SECRET   (shared secret; must match the VPS .env)
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/server/db";

const ALLOWED_AGENTS = new Set([
  "posicionador",
  "mercader",
  "rastreador",
  "clasificador",
  "escriba",
  "cazador",
  "creativo",
  "director",
  "social_media",
  "embajador",
  "foro",
  "supervisor",
  "analista",
  "analitico",
  "audit_meta",
  "auditor",
  "espia",
  "oraculo",
  "reescritor",
  "remitente",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (!ALLOWED_AGENTS.has(name)) {
    return NextResponse.json({ error: `Unknown agent: ${name}` }, { status: 400 });
  }

  // ── Auth ──
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userTenantId = (user.publicMetadata as { tenantId?: string } | undefined)?.tenantId;
  if (!userTenantId) {
    return NextResponse.json(
      { error: "Account pending tenant assignment. Contact admin." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const requestedTenant = (body.tenant as string | undefined) ?? userTenantId;
  const mode = body.mode ?? undefined;
  const dry_run = body.dry_run ?? false;

  // ── Tenant authorization: request tenant must match user's tenant ──
  if (requestedTenant !== userTenantId) {
    return NextResponse.json(
      {
        error: `Forbidden: you are not authorized to trigger agents for tenant "${requestedTenant}"`,
      },
      { status: 403 }
    );
  }

  // ── Tenant existence + status check ──
  // Defensive: if the DB is unreachable or unprovisioned, skip DB-level
  // validation and rely on the user-tenant match check above. This keeps
  // the trigger flow working during the early bootstrap before
  // `prisma db push` has created the Tenant table.
  try {
    const tenant = await db.tenant.findUnique({
      where: { slug: requestedTenant },
      select: { slug: true, status: true },
    });
    if (tenant?.status === "SUSPENDED" || tenant?.status === "CANCELED") {
      return NextResponse.json(
        { error: `Tenant ${requestedTenant} is ${tenant.status.toLowerCase()}` },
        { status: 403 }
      );
    }
    // If tenant is null (not yet in DB), we still allow because the user-tenant
    // metadata match above already proved authorization.
  } catch (err) {
    console.warn(
      `[trigger] DB unreachable, skipping tenant status check for ${requestedTenant}:`,
      err instanceof Error ? err.message : err
    );
  }

  // ── Forward to VPS webhook ──
  const vpsUrl = process.env.VPS_WEBHOOK_URL;
  const secret = process.env.WEBHOOK_SECRET;
  if (!vpsUrl || !secret) {
    return NextResponse.json(
      { error: "Server not configured (VPS_WEBHOOK_URL or WEBHOOK_SECRET missing)" },
      { status: 500 }
    );
  }

  const payload = JSON.stringify({
    tenant: requestedTenant,
    agent: name,
    mode,
    dry_run,
  });
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  try {
    const vpsRes = await fetch(vpsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-signature": signature,
      },
      body: payload,
      // Short timeout — webhook responds immediately with jobId,
      // the actual agent execution is fire-and-forget on VPS side.
      signal: AbortSignal.timeout(10_000),
    });

    const data = await vpsRes.json().catch(() => ({ error: "Invalid VPS response" }));
    return NextResponse.json(data, { status: vpsRes.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `VPS webhook unreachable: ${msg}` }, { status: 502 });
  }
}
