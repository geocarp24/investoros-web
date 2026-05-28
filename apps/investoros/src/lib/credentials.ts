/**
 * Per-tenant credential vault.
 *
 * Stores third-party service credentials (Airtable PAT, Telnyx API key, Buffer token,
 * Hostinger SMTP password, etc.) encrypted with AES-256-GCM at rest in Postgres.
 *
 * Key responsibilities:
 *  - `setCredential(...)` — encrypt and persist a credential
 *  - `getCredential(...)` — fetch and decrypt a single credential
 *  - `getTenantConfig(...)` — load the full tenant config (all credentials + metadata)
 *  - `TenantConfig` — TypeScript type exported for Cowork's agent refactors
 *
 * Backwards compatibility (vault-miss fallback):
 *  When `getCredential()` does not find a row, it falls back to the legacy
 *  per-tenant env var pattern (e.g. `AIRTABLE_TOKEN_GEO`). This lets Pinnacle
 *  and Geo Carpentry keep running while we migrate them into the vault.
 *
 * Server-only — never import from a 'use client' file. The encryption helpers
 * use the Node `crypto` module which is unavailable in the browser bundle.
 */
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";

// ─── Types ───────────────────────────────────────────────────────────────────
export type ServiceName =
  | "airtable"
  | "telnyx"
  | "buffer"
  | "google_business"
  | "hostinger_email"
  | "wordpress"
  | "social"        // FB page ID, IG account ID, Buffer token, Meta Graph user/page tokens
  | "meta_graph"
  | "openphone"
  | "clerk";

/**
 * Consolidated tenant config returned by `getTenantConfig()`.
 *
 * **Cowork: this is the type your agent refactors should import** to know
 * which keys to read from the vault. Add new optional sub-objects here as
 * we add new service integrations.
 */
export type TenantConfig = {
  slug: string;
  name: string;
  airtable: {
    token: string;
    baseId: string;
  };
  telnyx?: {
    phoneNumber: string;
    apiKey: string;
    areaCode?: string;
  };
  social?: {
    facebookPageId?: string;
    instagramAccountId?: string;
    bufferToken?: string;
    metaUserToken?: string;
    metaPageAccessToken?: string;
  };
  wordpress?: {
    url: string;
    bridgeToken?: string;
    wpcliPath?: string;
  };
  email?: {
    smtpHost: string;
    smtpUser: string;
    smtpPassword: string;
    smtpPort?: number;
  };
  gbp?: {
    placeId: string;
    managerEmail: string;
    placeIdCid?: string;
  };
};

// ─── Encryption helpers (AES-256-GCM) ────────────────────────────────────────
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard: 96-bit IV

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "Missing ENCRYPTION_KEY env var. Generate with: openssl rand -base64 32. " +
        "Set in Vercel env vars (Production + Preview)."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes (AES-256). Got ${key.length} bytes. ` +
        "Regenerate with: openssl rand -base64 32"
    );
  }
  return key;
}

type Encrypted = { encryptedValue: string; iv: string; authTag: string };

function encrypt(plaintext: string): Encrypted {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    encryptedValue: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decrypt(payload: Encrypted): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.encryptedValue, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

// ─── Vault API ───────────────────────────────────────────────────────────────

/**
 * Encrypts and persists a credential. Upserts on (tenantId, service, keyName).
 *
 * @param metadata non-secret context (base ID, page ID, area code, etc.) — readable in DB
 * @param expiresAt for OAuth refresh tokens that have a TTL
 */
export async function setCredential(
  tenantId: string,
  service: ServiceName,
  keyName: string,
  value: string,
  options: { metadata?: Record<string, unknown>; expiresAt?: Date } = {}
): Promise<void> {
  const encrypted = encrypt(value);
  await db.credential.upsert({
    where: {
      tenantId_service_keyName: { tenantId, service, keyName },
    },
    create: {
      tenantId,
      service,
      keyName,
      encryptedValue: encrypted.encryptedValue,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      keyVersion: 1,
      metadata: (options.metadata as Prisma.InputJsonValue) ?? undefined,
      expiresAt: options.expiresAt,
    },
    update: {
      encryptedValue: encrypted.encryptedValue,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      keyVersion: 1,
      metadata: (options.metadata as Prisma.InputJsonValue) ?? undefined,
      expiresAt: options.expiresAt,
    },
  });
}

/**
 * Fetches and decrypts a credential. Returns null if not found and no fallback exists.
 *
 * Falls back to a legacy env var pattern when the vault row is missing:
 *  - tenantSlug "geo-carpentry" + service "airtable" + keyName "api_token"
 *    → process.env.AIRTABLE_TOKEN_GEO
 *
 * This keeps Pinnacle and Geo Carpentry running during the migration to the vault.
 */
export async function getCredential(
  tenantId: string,
  service: ServiceName,
  keyName: string,
  fallbackEnvVar?: string
): Promise<string | null> {
  const row = await db.credential.findUnique({
    where: {
      tenantId_service_keyName: { tenantId, service, keyName },
    },
  });

  if (row) {
    try {
      return decrypt({
        encryptedValue: row.encryptedValue,
        iv: row.iv,
        authTag: row.authTag,
      });
    } catch (err) {
      console.error(
        `[credentials] decrypt failed for tenant=${tenantId} service=${service} key=${keyName}:`,
        err instanceof Error ? err.message : err
      );
      // fall through to env var fallback
    }
  }

  if (fallbackEnvVar) {
    const envValue = process.env[fallbackEnvVar];
    if (envValue) return envValue;
  }

  return null;
}

/**
 * Loads the full consolidated tenant config from the vault.
 *
 * Reads all credentials for the tenant and assembles them into a typed `TenantConfig`.
 * Only includes service blocks that have all required credentials present.
 *
 * Throws if Airtable token + base ID are missing (the minimum required for any tenant).
 * This guarantees that downstream code can always destructure `config.airtable`.
 */
export async function getTenantConfig(tenantId: string): Promise<TenantConfig> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: { credentials: true },
  });
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const credByName = new Map<string, { value: string; metadata: unknown }>();
  for (const cred of tenant.credentials) {
    try {
      const value = decrypt({
        encryptedValue: cred.encryptedValue,
        iv: cred.iv,
        authTag: cred.authTag,
      });
      credByName.set(`${cred.service}:${cred.keyName}`, {
        value,
        metadata: cred.metadata,
      });
    } catch {
      // skip undecryptable rows (likely from a rotated key)
    }
  }

  function get(service: ServiceName, keyName: string, fallbackEnv?: string): string | undefined {
    const cred = credByName.get(`${service}:${keyName}`);
    if (cred) return cred.value;
    if (fallbackEnv) return process.env[fallbackEnv];
    return undefined;
  }

  // Resolve Airtable env var fallback by tenant slug (legacy pattern)
  const airtableEnv = `AIRTABLE_TOKEN_${tenant.slug.toUpperCase().replace(/-/g, "_")}`;
  const airtableToken = get("airtable", "api_token", airtableEnv) ?? process.env.AIRTABLE_TOKEN;
  const airtableBaseId =
    get("airtable", "base_id") ??
    (tenant.slug === "geo-carpentry" ? "appAQpveuAec077jF" : undefined);

  if (!airtableToken || !airtableBaseId) {
    throw new Error(
      `Tenant ${tenant.slug} missing required Airtable credentials. ` +
        `Provision via /settings/connections or set ${airtableEnv} env var.`
    );
  }

  const config: TenantConfig = {
    slug: tenant.slug,
    name: tenant.name,
    airtable: { token: airtableToken, baseId: airtableBaseId },
  };

  const telnyxPhone = get("telnyx", "phone_number");
  const telnyxKey = get("telnyx", "api_key", "TELNYX_API_KEY");
  if (telnyxPhone && telnyxKey) {
    config.telnyx = { phoneNumber: telnyxPhone, apiKey: telnyxKey };
  }

  const fbPageId = get("social", "facebook_page_id");
  const igAccountId = get("social", "instagram_account_id");
  const bufferToken = get("social", "buffer_token");
  const metaUserToken = get("social", "meta_user_token", "META_USER_TOKEN");
  const metaPageToken = get("social", "meta_page_access_token", "META_PAGE_ACCESS_TOKEN");
  if (fbPageId || igAccountId || bufferToken || metaUserToken) {
    config.social = {
      facebookPageId: fbPageId,
      instagramAccountId: igAccountId,
      bufferToken,
      metaUserToken,
      metaPageAccessToken: metaPageToken,
    };
  }

  const wpUrl = get("wordpress", "url");
  if (wpUrl) {
    config.wordpress = {
      url: wpUrl,
      bridgeToken: get("wordpress", "bridge_token"),
    };
  }

  const smtpHost = get("hostinger_email", "smtp_host", "HOSTINGER_SMTP_HOST");
  const smtpUser = get("hostinger_email", "smtp_user", "HOSTINGER_SMTP_USER");
  const smtpPassword = get("hostinger_email", "smtp_password", "HOSTINGER_SMTP_PASSWORD");
  if (smtpHost && smtpUser && smtpPassword) {
    config.email = { smtpHost, smtpUser, smtpPassword, smtpPort: 465 };
  }

  const gbpPlaceId = get("google_business", "place_id");
  const gbpManager = get("google_business", "manager_email");
  if (gbpPlaceId && gbpManager) {
    config.gbp = { placeId: gbpPlaceId, managerEmail: gbpManager };
  }

  return config;
}

/**
 * Convenience helper for the common case: lookup tenant by slug, then return config.
 */
export async function getTenantConfigBySlug(slug: string): Promise<TenantConfig> {
  const tenant = await db.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant not found by slug: ${slug}`);
  return getTenantConfig(tenant.id);
}
