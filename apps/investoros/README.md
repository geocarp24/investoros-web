# InvestorOS

The Operating System for Real Estate Investors.

## Status

Sprint B1 scaffold (2026-05-08). MVP web SaaS for wholesalers / flippers / agencies.

## Stack

- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind v4 + shadcn/ui
- **API:** tRPC 11 (type-safe end-to-end)
- **Database:** Postgres via Supabase + Prisma 6 ORM
- **Multi-tenant:** Row-level security with `tenantId` column on every table (Pinnacle = tenant zero)
- **Auth:** Clerk (wired in B5)
- **Billing:** Stripe (wired in B4)
- **Hosting:** Vercel (Next.js) + Supabase (Postgres) + Hostinger (DNS investoros.tech)

## Pricing tiers (approved Jorge 2026-04-22)

| Tier | Mensual | Notes |
|---|---|---|
| Starter | $297 | "Powered by InvestorOS" visible |
| Growth | $697 | Removable for $15/mo add-on |
| Pro | $1,497 | Invisible default |
| Enterprise | $3,500+ | Custom domain + SLA 99.9% |

Setup fee $997 one-time. Annual 16.6% off (2 months free). Refund 30 days. Performance fee 0/5/4/3/2% based on attributable MRR.

## Local dev

```bash
cd apps/investoros
npm install
cp .env.example .env.local
# fill in DATABASE_URL pointing to your Supabase project
npm run db:push
npm run dev
```

## Multi-tenant model

Every domain entity has a `tenantId` foreign key. Postgres RLS enforces isolation at DB level. tRPC middleware injects the resolved tenant into every query, so application code never has to remember to filter — it's enforced at the data layer.

See `src/server/db.ts` and `src/lib/tenants.ts` for the helpers.

## Roadmap

- [x] **B1** scaffold (this commit)
- [ ] **B2** Branding (logo + color palette)
- [ ] **B3** Landing page mockups + production hero
- [ ] **B4** Stripe subscription tiers + webhook
- [ ] **B5** Admin dashboard + Clerk auth
- [ ] **B6** Beta cerrada — 5 clientes Jorge network
- [ ] **B7** Launch público (Product Hunt + press)
- [ ] **Phase 2** Mobile native (post-90 days)
