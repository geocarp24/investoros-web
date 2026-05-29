/**
 * /onboard — entry point that resolves the user's current step from Clerk
 * publicMetadata.onboarding and redirects there. If onboarding is complete,
 * sends them to their tenant dashboard instead.
 */
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ONBOARD_STEPS, isValidStep, type OnboardMetadata } from "@/lib/onboard";

export default async function OnboardEntry() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const tenantId = (user.publicMetadata as { tenantId?: string } | undefined)?.tenantId;
  if (tenantId) redirect(`/${tenantId}`);

  const onboarding = (user.publicMetadata as { onboarding?: OnboardMetadata } | undefined)?.onboarding;
  const step = onboarding?.step;

  if (step === "complete") redirect("/onboard/complete");
  if (step && isValidStep(step)) redirect(`/onboard/${step}`);
  redirect(`/onboard/${ONBOARD_STEPS[0]}`);
}
