/**
 * /settings/connections — show connected integrations status.
 *
 * Lands here after OAuth callback at /api/auth/facebook/callback completes:
 *   /settings/connections?connected=facebook&page=<name>&page_id=<id>
 *
 * Reads tenant credentials from vault (server-side) to show which services
 * have valid tokens stored. Per visibility-first rule: client must SEE which
 * integrations are connected, never trust the API silently.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { getTenantConfig } from "@/lib/credentials";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; page?: string; page_id?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { userId } = await auth();
  if (!userId) {
    return (
      <main style={{ padding: 48, maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, marginBottom: 16 }}>Sign in required</h1>
        <p>You need to sign in to view connections.</p>
        <Link href="/sign-in" style={{ color: "#e07b2a" }}>Sign in</Link>
      </main>
    );
  }

  const user = await currentUser();
  const tenantId = user?.publicMetadata?.tenantId as string | undefined;
  let tenantRow = tenantId
    ? await db.tenant.findUnique({ where: { id: tenantId } })
    : null;

  // Fallback: single-tenant mode (pre-Clerk publicMetadata.tenantId assignment).
  // When SaaS goes multi-tenant, every Clerk user MUST have publicMetadata.tenantId
  // set during onboarding. Until then, if there's exactly one tenant in DB, use it.
  // This keeps Jorge's solo dev experience working without forcing Clerk metadata wiring.
  if (!tenantRow) {
    const tenants = await db.tenant.findMany({ take: 2 });
    if (tenants.length === 1) tenantRow = tenants[0];
  }

  const tenantSlug = tenantRow?.slug ?? "";

  let connections: {
    facebook?: { connected: boolean; pageName?: string; pageId?: string; igBusinessId?: string };
    airtable?: { connected: boolean };
    wordpress?: { connected: boolean; url?: string };
  } = {};

  if (tenantSlug) {
    try {
      const cfg = await getTenantConfig(tenantRow!.id);
      connections = {
        facebook: cfg.facebook?.pageAccessToken
          ? {
              connected: true,
              pageName: cfg.facebook.pageName ?? params.page,
              pageId: cfg.facebook.pageId,
              igBusinessId: cfg.facebook.igBusinessId,
            }
          : { connected: false },
        airtable: { connected: !!cfg.airtable?.token },
        wordpress: cfg.wordpress?.appPassword
          ? { connected: true, url: cfg.wordpress.url }
          : { connected: false },
      };
    } catch {
      // tenant has no credentials yet
    }
  }

  const justConnected = params.connected === "facebook";
  const errorMsg = params.error;

  return (
    <main style={{ padding: 48, maxWidth: 800, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8, color: "#1a2e44" }}>Connected Integrations</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Tenant: <strong>{tenantSlug || "(not set)"}</strong>
      </p>

      {justConnected && (
        <div
          style={{
            background: "#dcfce7",
            border: "1px solid #22c55e",
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            color: "#166534",
          }}
        >
          ✅ <strong>Facebook Page connected:</strong> {params.page?.trim() || "your Page"}
          {params.page_id && (
            <span style={{ display: "block", fontSize: 13, marginTop: 4, color: "#444" }}>
              Page ID: <code>{params.page_id}</code>
            </span>
          )}
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #ef4444",
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            color: "#991b1b",
          }}
        >
          ❌ <strong>OAuth error:</strong> {errorMsg}
        </div>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        <ConnectionCard
          name="Facebook + Instagram"
          icon="📘"
          connected={connections.facebook?.connected ?? false}
          details={
            connections.facebook?.connected ? (
              <>
                Page: <strong>{connections.facebook.pageName?.trim() || "Connected"}</strong>
                <br />
                {connections.facebook.pageId && (
                  <span style={{ fontSize: 13, color: "#666" }}>
                    Page ID: <code>{connections.facebook.pageId}</code>
                  </span>
                )}
                {connections.facebook.igBusinessId && (
                  <span style={{ display: "block", fontSize: 13, color: "#666" }}>
                    IG Business: <code>{connections.facebook.igBusinessId}</code>
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: "#666" }}>
                Not connected. <Link href="/onboard/connect-facebook" style={{ color: "#e07b2a" }}>Connect now</Link>
              </span>
            )
          }
        />

        <ConnectionCard
          name="Airtable"
          icon="📊"
          connected={connections.airtable?.connected ?? false}
          details={
            connections.airtable?.connected
              ? "Token configured (encrypted vault)"
              : "Not connected"
          }
        />

        <ConnectionCard
          name="WordPress"
          icon="🌐"
          connected={connections.wordpress?.connected ?? false}
          details={
            connections.wordpress?.connected ? (
              <>
                Site: <a href={connections.wordpress.url} target="_blank" rel="noreferrer" style={{ color: "#e07b2a" }}>
                  {connections.wordpress.url}
                </a>
              </>
            ) : (
              "Not connected"
            )
          }
        />
      </div>

      <div style={{ marginTop: 32, padding: 16, background: "#f8f5ee", borderRadius: 8 }}>
        <h3 style={{ marginTop: 0, color: "#1a2e44" }}>Next steps</h3>
        <ul style={{ paddingLeft: 20, color: "#444" }}>
          <li>
            <Link href={tenantSlug ? `/${tenantSlug}/social/calendar` : "#"} style={{ color: "#e07b2a" }}>
              Go to Social Calendar →
            </Link>
          </li>
          <li>
            <Link href={tenantSlug ? `/${tenantSlug}` : "/dashboard"} style={{ color: "#e07b2a" }}>
              Dashboard →
            </Link>
          </li>
        </ul>
      </div>
    </main>
  );
}

function ConnectionCard({
  name,
  icon,
  connected,
  details,
}: {
  name: string;
  icon: string;
  connected: boolean;
  details: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: `2px solid ${connected ? "#22c55e" : "#cbd5e1"}`,
        borderRadius: 12,
        padding: 20,
        background: "#fff",
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
      }}
    >
      <div style={{ fontSize: 32 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <strong style={{ fontSize: 18, color: "#1a2e44" }}>{name}</strong>
          <span
            style={{
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 12,
              background: connected ? "#dcfce7" : "#f1f5f9",
              color: connected ? "#166534" : "#64748b",
              fontWeight: 600,
            }}
          >
            {connected ? "✓ Connected" : "Not connected"}
          </span>
        </div>
        <div style={{ color: "#444", fontSize: 14 }}>{details}</div>
      </div>
    </div>
  );
}
