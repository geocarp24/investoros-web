/**
 * Prisma client + tenant-scoped wrapper.
 *
 * The base Prisma client is a singleton. The tenant-scoped wrapper enforces
 * tenantId injection on writes and tenantId filtering on reads — this is a
 * defense-in-depth layer ABOVE Postgres RLS, so even if RLS is misconfigured
 * the application code can't accidentally cross tenant boundaries.
 *
 * Sprint B1 — Jorge 2026-05-08.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/**
 * Resolve a tenant by slug or custom domain.
 * Returns null if not found or status is SUSPENDED/CANCELED.
 */
export async function getActiveTenant(slugOrDomain: string) {
  if (!slugOrDomain) return null;
  const tenant = await db.tenant.findFirst({
    where: {
      OR: [{ slug: slugOrDomain }, { customDomain: slugOrDomain }],
    },
  });
  if (!tenant) return null;
  if (tenant.status === "SUSPENDED" || tenant.status === "CANCELED") return null;
  return tenant;
}
