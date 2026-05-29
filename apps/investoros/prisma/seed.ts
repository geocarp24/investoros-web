/**
 * Seed bootstrap tenants + migrate env-var credentials into the vault.
 *
 * Run via Vercel API route POST /api/admin/seed-tenant (production)
 * or locally via `npx tsx prisma/seed.ts` once DATABASE_URL is set.
 *
 * Idempotent: re-running upserts both the Tenant row and any vault credentials.
 *
 * What it seeds:
 *  - Tenant rows for "geo-carpentry" (active) and "pinnacle" (active)
 *  - Vault credentials for any tenant whose legacy env var token is present:
 *    AIRTABLE_TOKEN_GEO       → Credential(geo-carpentry, airtable, api_token)
 *    AIRTABLE_TOKEN_PINNACLE  → Credential(pinnacle, airtable, api_token)
 *    AIRTABLE_TOKEN           → Credential(pinnacle, airtable, api_token) (fallback)
 *  - Base IDs as metadata on each Credential row (non-secret)
 */
import { PrismaClient } from "@prisma/client";
import { setCredential } from "../src/lib/credentials";

const prisma = new PrismaClient();

type TenantSeed = {
  slug: string;
  name: string;
  legalName?: string;
  airtableBaseId?: string;
  airtableTokenEnv?: string[];
};

const TENANTS: TenantSeed[] = [
  {
    slug: "geo-carpentry",
    name: "Geo Carpentry LLC",
    legalName: "Geo Carpentry LLC",
    airtableBaseId: "appAQpveuAec077jF",
    airtableTokenEnv: ["AIRTABLE_TOKEN_GEO"],
  },
  {
    slug: "pinnacle",
    name: "Pinnacle Holdings Group",
    legalName: "Pinnacle Holdings Group LLC",
    airtableBaseId: "appfQbDA750Oihy9J",
    airtableTokenEnv: ["AIRTABLE_TOKEN_PINNACLE", "AIRTABLE_TOKEN"],
  },
];

export type SeedReport = {
  tenants: Array<{
    slug: string;
    tenantId: string;
    created: boolean;
    credentialsSeeded: string[];
    credentialsSkipped: string[];
  }>;
};

export async function seedTenants(): Promise<SeedReport> {
  const report: SeedReport = { tenants: [] };

  for (const t of TENANTS) {
    const existing = await prisma.tenant.findUnique({ where: { slug: t.slug } });
    const tenant = await prisma.tenant.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        name: t.name,
        legalName: t.legalName,
        status: "ACTIVE",
      },
      update: {
        name: t.name,
        legalName: t.legalName,
        status: "ACTIVE",
      },
    });

    const credentialsSeeded: string[] = [];
    const credentialsSkipped: string[] = [];

    // Airtable: try each env var in order until one resolves
    if (t.airtableTokenEnv && t.airtableBaseId) {
      let token: string | undefined;
      let sourceEnv: string | undefined;
      for (const envName of t.airtableTokenEnv) {
        if (process.env[envName]) {
          token = process.env[envName];
          sourceEnv = envName;
          break;
        }
      }

      if (token && sourceEnv) {
        await setCredential(tenant.id, "airtable", "api_token", token, {
          metadata: { source_env: sourceEnv, seeded_at: new Date().toISOString() },
        });
        await setCredential(tenant.id, "airtable", "base_id", t.airtableBaseId, {
          metadata: { non_secret: true },
        });
        credentialsSeeded.push(`airtable:api_token (from ${sourceEnv})`, "airtable:base_id");
      } else {
        credentialsSkipped.push(
          `airtable: no env var present (tried ${t.airtableTokenEnv.join(", ")})`
        );
      }
    }

    report.tenants.push({
      slug: tenant.slug,
      tenantId: tenant.id,
      created: !existing,
      credentialsSeeded,
      credentialsSkipped,
    });
  }

  return report;
}

// Allow direct CLI run: `npx tsx prisma/seed.ts`
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  seedTenants()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      return prisma.$disconnect();
    })
    .catch((err) => {
      console.error("[seed] failed:", err);
      return prisma.$disconnect().then(() => process.exit(1));
    });
}
