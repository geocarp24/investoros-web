/**
 * /dashboard — generic landing for signed-in users.
 *
 * Routes by Clerk publicMetadata:
 *   - tenantId set        → /[tenant]
 *   - onboarding pending  → /onboard
 *   - neither             → /onboard (first time signing in after sign-up)
 *
 * Used as the post-sign-in default redirect so the app never lands a user on
 * a page they can't actually use.
 */
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardRouter() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const tenantId = (user.publicMetadata as { tenantId?: string } | undefined)?.tenantId;
  if (tenantId) redirect(`/${tenantId}`);

  redirect("/onboard");
}
