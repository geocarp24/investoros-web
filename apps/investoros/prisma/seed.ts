/**
 * Seed script — bootstraps Pinnacle as tenant-zero for local dev.
 * Run: npm run db:seed
 */
import { PrismaClient, TenantStatus, SubscriptionTier, SubscriptionStatus } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const pinnacle = await db.tenant.upsert({
    where: { slug: "pinnacle" },
    update: {},
    create: {
      slug: "pinnacle",
      name: "Pinnacle Holdings Group",
      legalName: "Pinnacle Holdings Group LLC",
      brandColor: "#1F2937",
      whiteLabel: true,
      status: TenantStatus.ACTIVE,
      customDomain: "pinnaclegroupwi.com",
    },
  });

  await db.subscription.upsert({
    where: { tenantId: pinnacle.id },
    update: {},
    create: {
      tenantId: pinnacle.id,
      stripeCustomerId: "cus_pinnacle_seed_placeholder",
      tier: SubscriptionTier.ENTERPRISE,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`Seeded tenant-zero: ${pinnacle.slug} (${pinnacle.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
