/**
 * tRPC server setup with multi-tenant middleware.
 *
 * Every procedure runs through tenant resolution: if no tenant context is
 * present in the request, the procedure throws UNAUTHORIZED. This is the
 * primary application-layer enforcement of multi-tenant isolation.
 *
 * Sprint B1 — Jorge 2026-05-08.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { Tenant } from "@prisma/client";
import { db, getActiveTenant } from "@/server/db";
import { resolveTenantContext } from "@/lib/tenants";

export type Context = {
  tenant: Tenant | null;
  userId: string | null;
  db: typeof db;
};

/**
 * Build context from a Fetch Request (Next.js App Router style).
 * Resolves tenant from host + pathname.
 */
export async function createTRPCContext(req: Request): Promise<Context> {
  const url = new URL(req.url);
  const host = req.headers.get("host");
  const ctx = resolveTenantContext(host, url.pathname);
  const tenant = await getActiveTenant(ctx.slug);
  // Clerk userId is wired in B5; placeholder for now.
  const userId = req.headers.get("x-user-id");
  return { tenant, userId, db };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * tenantProcedure — guarantees ctx.tenant is non-null.
 * Use for any operation that touches tenant-scoped data.
 */
export const tenantProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.tenant) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "no active tenant" });
  }
  return opts.next({
    ctx: { ...opts.ctx, tenant: opts.ctx.tenant },
  });
});

/**
 * authedProcedure — requires both tenant + userId.
 */
export const authedProcedure = tenantProcedure.use(async (opts) => {
  if (!opts.ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "auth required" });
  }
  return opts.next({
    ctx: { ...opts.ctx, userId: opts.ctx.userId },
  });
});
