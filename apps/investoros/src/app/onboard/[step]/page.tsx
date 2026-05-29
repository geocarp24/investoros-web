/**
 * /onboard/[step] — dynamic step renderer.
 *
 * One route handles all 5 wizard steps. The step param picks which client
 * component owns the form. Initial data comes from Clerk publicMetadata so a
 * user that abandoned partway through resumes where they left off.
 */
import { currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import {
  isValidStep,
  STEP_LABEL,
  STEP_BLURB,
  type OnboardData,
  type OnboardMetadata,
  type OnboardStep,
} from "@/lib/onboard";
import { WizardProgress } from "@/components/onboard/WizardProgress";
import { BusinessStep } from "@/components/onboard/BusinessStep";
import { DomainStep } from "@/components/onboard/DomainStep";
import { PhoneStep } from "@/components/onboard/PhoneStep";
import { GbpStep } from "@/components/onboard/GbpStep";
import { SocialStep } from "@/components/onboard/SocialStep";

export const dynamic = "force-dynamic";

export default async function OnboardStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  if (!isValidStep(step)) notFound();

  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const tenantId = (user.publicMetadata as { tenantId?: string } | undefined)?.tenantId;
  if (tenantId) redirect(`/${tenantId}`);

  const onboarding = (user.publicMetadata as { onboarding?: OnboardMetadata } | undefined)?.onboarding;
  const initialData: OnboardData = onboarding?.data ?? {};

  const Form = STEP_COMPONENT[step];

  return (
    <main className="space-y-8">
      <WizardProgress current={step} />

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#111118] p-6">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">
            Step {String(STEP_INDEX[step] + 1)} of 5
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">{STEP_LABEL[step]}</h1>
          <p className="mt-1 text-sm text-[#94a3b8]">{STEP_BLURB[step]}</p>
        </header>

        <Form step={step} initialData={initialData} />
      </section>

      <p className="text-center text-[11px] text-[#64748b]">
        You can come back later — your progress saves to your account each step.
      </p>
    </main>
  );
}

const STEP_COMPONENT: Record<
  OnboardStep,
  React.ComponentType<{ step: OnboardStep; initialData: OnboardData }>
> = {
  business: BusinessStep,
  domain: DomainStep,
  phone: PhoneStep,
  gbp: GbpStep,
  social: SocialStep,
};

const STEP_INDEX: Record<OnboardStep, number> = {
  business: 0,
  domain: 1,
  phone: 2,
  gbp: 3,
  social: 4,
};
