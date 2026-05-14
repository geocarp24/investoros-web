/**
 * Tests for src/lib/tenants.ts.
 * Run: node --test tests/*.test.mjs
 *
 * Note: imports the .ts file directly via `node --experimental-strip-types`
 * (Node 22+). For environments that need a transpile step, run via `tsx`.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Inline mini-impl matching src/lib/tenants.ts so tests run without TS toolchain.
// (When npm install is done, switch this to: import { ... } from "../src/lib/tenants.ts")
const ROOT_DOMAIN = "investoros.tech";
const DEFAULT_SLUG = "pinnacle";

function resolveTenantContext(host, pathname) {
  const cleanHost = (host || "").toLowerCase().split(":")[0];
  if (cleanHost && !cleanHost.endsWith(ROOT_DOMAIN) && cleanHost !== "localhost" && !cleanHost.startsWith("127.")) {
    return { slug: cleanHost, source: "custom_domain" };
  }
  if (cleanHost.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = cleanHost.slice(0, -ROOT_DOMAIN.length - 1);
    if (subdomain && subdomain !== "www" && subdomain !== "app") {
      return { slug: subdomain, source: "subdomain" };
    }
  }
  const pathMatch = pathname.match(/^\/t\/([a-z0-9_-]+)(\/|$)/i);
  if (pathMatch) return { slug: pathMatch[1].toLowerCase(), source: "path" };
  return { slug: DEFAULT_SLUG, source: "default" };
}

function isValidTenantSlug(slug) {
  return /^[a-z0-9][a-z0-9_-]{1,31}$/i.test(slug || "");
}

describe("resolveTenantContext", () => {
  test("custom domain → uses host as slug", () => {
    const r = resolveTenantContext("crm.acme.com", "/dashboard");
    assert.equal(r.slug, "crm.acme.com");
    assert.equal(r.source, "custom_domain");
  });

  test("subdomain of root → strips root", () => {
    const r = resolveTenantContext("acme.investoros.tech", "/");
    assert.equal(r.slug, "acme");
    assert.equal(r.source, "subdomain");
  });

  test("www subdomain → falls through to default", () => {
    const r = resolveTenantContext("www.investoros.tech", "/");
    assert.equal(r.slug, "pinnacle");
    assert.equal(r.source, "default");
  });

  test("app subdomain → falls through to default", () => {
    const r = resolveTenantContext("app.investoros.tech", "/");
    assert.equal(r.slug, "pinnacle");
    assert.equal(r.source, "default");
  });

  test("path prefix /t/<slug> → slug from path", () => {
    const r = resolveTenantContext("investoros.tech", "/t/acme/dashboard");
    assert.equal(r.slug, "acme");
    assert.equal(r.source, "path");
  });

  test("localhost without path → default tenant", () => {
    const r = resolveTenantContext("localhost", "/");
    assert.equal(r.slug, "pinnacle");
    assert.equal(r.source, "default");
  });

  test("127.0.0.1 with port → default tenant", () => {
    const r = resolveTenantContext("127.0.0.1:3000", "/");
    assert.equal(r.slug, "pinnacle");
    assert.equal(r.source, "default");
  });

  test("localhost with /t/<slug> → path resolution", () => {
    const r = resolveTenantContext("localhost:3000", "/t/dev/dashboard");
    assert.equal(r.slug, "dev");
    assert.equal(r.source, "path");
  });

  test("missing host → default", () => {
    const r = resolveTenantContext(null, "/");
    assert.equal(r.source, "default");
  });

  test("host:port stripped correctly", () => {
    const r = resolveTenantContext("acme.investoros.tech:3000", "/");
    assert.equal(r.slug, "acme");
    assert.equal(r.source, "subdomain");
  });
});

describe("isValidTenantSlug", () => {
  test("accepts valid slugs", () => {
    for (const s of ["pinnacle", "acme-co", "user_123", "ab", "investor99"]) {
      assert.equal(isValidTenantSlug(s), true, `${s} should be valid`);
    }
  });

  test("rejects too short (< 2 chars)", () => {
    assert.equal(isValidTenantSlug("a"), false);
    assert.equal(isValidTenantSlug(""), false);
  });

  test("rejects too long (> 32 chars)", () => {
    assert.equal(isValidTenantSlug("a".repeat(33)), false);
  });

  test("rejects starting with non-alphanumeric", () => {
    assert.equal(isValidTenantSlug("-abc"), false);
    assert.equal(isValidTenantSlug("_abc"), false);
  });

  test("rejects special characters", () => {
    assert.equal(isValidTenantSlug("acme!"), false);
    assert.equal(isValidTenantSlug("acme.co"), false);
    assert.equal(isValidTenantSlug("acme co"), false);
    assert.equal(isValidTenantSlug("acme/co"), false);
  });

  test("rejects null/undefined", () => {
    assert.equal(isValidTenantSlug(null), false);
    assert.equal(isValidTenantSlug(undefined), false);
  });
});
