/**
 * Root tRPC router — composes per-feature subrouters.
 * Sprint B1 — Jorge 2026-05-08.
 */
import { router, publicProcedure, tenantProcedure } from "@/server/trpc";
import { z } from "zod";

export const appRouter = router({
  // Health check — no auth required.
  health: publicProcedure.query(() => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    app: process.env.NEXT_PUBLIC_APP_NAME || "InvestorOS",
  })),

  // Tenant info for the resolved tenant in context.
  tenant: tenantProcedure.query(({ ctx }) => ({
    id: ctx.tenant.id,
    slug: ctx.tenant.slug,
    name: ctx.tenant.name,
    brandColor: ctx.tenant.brandColor,
    whiteLabel: ctx.tenant.whiteLabel,
  })),

  // Public stats placeholder (e.g. for marketing site live counter).
  publicStats: publicProcedure.query(async ({ ctx }) => {
    const tenantCount = await ctx.db.tenant.count({ where: { status: "ACTIVE" } });
    return { activeTenants: tenantCount };
  }),

  contacts: router({
    count: tenantProcedure.query(async ({ ctx }) => {
      return ctx.db.contact.count({ where: { tenantId: ctx.tenant.id } });
    }),
    recent: tenantProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }))
      .query(async ({ ctx, input }) => {
        return ctx.db.contact.findMany({
          where: { tenantId: ctx.tenant.id },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        });
      }),
  }),

  deals: router({
    pipeline: tenantProcedure.query(async ({ ctx }) => {
      const grouped = await ctx.db.deal.groupBy({
        by: ["status"],
        where: { tenantId: ctx.tenant.id },
        _count: true,
      });
      return grouped.map((g) => ({ status: g.status, count: g._count }));
    }),
  }),
});

export type AppRouter = typeof appRouter;
