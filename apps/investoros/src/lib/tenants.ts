/**
 * Tenant resolution helpers.
 *
 * Multi-tenant SaaS resolves the active tenant from one of three sources, in
 * priority order:
 *   1. Custom domain (e.g. crm.acme.com → tenant with customDomain match)
 *   2. Subdomain (e.g. acme.investoros.tech → tenant.slug = "acme")
 *   3. Path prefix dev mode (e.g. /t/acme/dashboard → tenant.slug = "acme")
 *
 * In production, custom domain or subdomain are the only supported paths.
 * Path-prefix is a dev-only convenience while we build out infra.
 *
 * Sprint B1 — Jorge 2026-05-08.
 */

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "investoros.tech";
const DEFAULT_SLUG = process.env.DEFAULT_TENANT_SLUG || "pinnacle";

export type TenantContext = {
  slug: string;
  source: "custom_domain" | "subdomain" | "path" | "default";
};

/**
 * Resolve tenant from an HTTP host header + URL path.
 * Pure function — no DB calls. Returns the slug to look up.
 */
export function resolveTenantContext(host: string | null, pathname: string): TenantContext {
  const cleanHost = (host || "").toLowerCase().split(":")[0];

  // 1. Custom domain (anything not ending in ROOT_DOMAIN or localhost)
  if (cleanHost && !cleanHost.endsWith(ROOT_DOMAIN) && cleanHost !== "localhost" && !cleanHost.startsWith("127.")) {
    // The DB lookup will happen in the route handler; we just signal source.
    return { slug: cleanHost, source: "custom_domain" };
  }

  // 2. Subdomain (e.g. acme.investoros.tech → "acme")
  if (cleanHost.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = cleanHost.slice(0, -ROOT_DOMAIN.length - 1);
    if (subdomain && subdomain !== "www" && subdomain !== "app") {
      return { slug: subdomain, source: "subdomain" };
    }
  }

  // 3. Path prefix /t/<slug>/...
  const pathMatch = pathname.match(/^\/t\/([a-z0-9_-]+)(\/|$)/i);
  if (pathMatch) {
    return { slug: pathMatch[1].toLowerCase(), source: "path" };
  }

  // 4. Default (Pinnacle in dev)
  return { slug: DEFAULT_SLUG, source: "default" };
}

/**
 * Validate a tenant slug — alphanumeric + dashes + underscores, 2-32 chars.
 */
export function isValidTenantSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{1,31}$/i.test(slug || "");
}
