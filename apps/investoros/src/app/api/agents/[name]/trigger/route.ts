/**
 * POST /api/agents/{name}/trigger
 *
 * Bridge between the dashboard "Run Now" button and the VPS webhook
 * service. Signs the payload with HMAC-SHA256 and forwards to the VPS
 * webhook receiver, which spawns the actual agent process.
 *
 * Body: { tenant?: string, mode?: string, dry_run?: boolean }
 *  - tenant defaults to "geo-carpentry"
 *  - agent comes from the [name] URL param
 *
 * Env required:
 *  - VPS_WEBHOOK_URL  (e.g. http://187.77.215.146:3001/trigger)
 *  - WEBHOOK_SECRET   (shared secret; must match the VPS .env)
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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
]);

const ALLOWED_TENANTS = new Set(["geo-carpentry", "pinnacle"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (!ALLOWED_AGENTS.has(name)) {
    return NextResponse.json(
      { error: `Unknown agent: ${name}` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const tenant = body.tenant ?? "geo-carpentry";
  const mode = body.mode ?? undefined;
  const dry_run = body.dry_run ?? false;

  if (!ALLOWED_TENANTS.has(tenant)) {
    return NextResponse.json(
      { error: `Unknown tenant: ${tenant}` },
      { status: 400 }
    );
  }

  const vpsUrl = process.env.VPS_WEBHOOK_URL;
  const secret = process.env.WEBHOOK_SECRET;
  if (!vpsUrl || !secret) {
    return NextResponse.json(
      { error: "Server not configured (VPS_WEBHOOK_URL or WEBHOOK_SECRET missing)" },
      { status: 500 }
    );
  }

  const payload = JSON.stringify({ tenant, agent: name, mode, dry_run });
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

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
    return NextResponse.json(
      { error: `VPS webhook unreachable: ${msg}` },
      { status: 502 }
    );
  }
}
