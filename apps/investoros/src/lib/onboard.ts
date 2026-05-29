/**
 * Onboarding state model + step constants.
 *
 * Source of truth lives in Clerk publicMetadata.onboarding (and gets mirrored
 * to the Tenant row once the wizard completes). The shape is intentionally
 * loose during the wizard — only completion creates the real Tenant.
 */

export const ONBOARD_STEPS = [
  "business",
  "domain",
  "phone",
  "gbp",
  "social",
] as const;

export type OnboardStep = (typeof ONBOARD_STEPS)[number];

export const STEP_LABEL: Record<OnboardStep, string> = {
  business: "Business info",
  domain:   "Website",
  phone:    "Business phone",
  gbp:      "Google Business",
  social:   "Social media",
};

export const STEP_BLURB: Record<OnboardStep, string> = {
  business: "Tell us about the business so the agents know who they're working for.",
  domain:   "Bring your existing domain or let InvestorOS host one for you.",
  phone:    "Provision a Telnyx number so Fer can reply to leads 24/7. Skip if you're not ready.",
  gbp:      "Add us as a Google Business manager so Nova can post on your behalf.",
  social:   "Add us as a Facebook Page admin so Marco can publish (or skip — we'll set this up later).",
};

export type OnboardData = {
  business?: {
    name: string;
    legalName?: string;
    industry: string;            // "general-contractor" | "real-estate-investor" | "other"
    ownerFullName: string;
    city: string;
    state: string;
    primaryLanguage: "en" | "es";
  };
  domain?: {
    mode: "byo" | "hosted";
    domain?: string;             // e.g. "geocarpentry.com" for byo, "{slug}.investoros.tech" for hosted
  };
  phone?: {
    mode: "provision" | "byo" | "skip";
    phoneNumber?: string;        // for byo
    areaCode?: string;           // for provision (e.g. "920")
  };
  gbp?: {
    mode: "delegated" | "skip";
    placeId?: string;
  };
  social?: {
    mode: "added" | "skip";
    facebookPageId?: string;
    instagramHandle?: string;
  };
};

export type OnboardMetadata = {
  step: OnboardStep | "complete";
  data: OnboardData;
};

export function nextStepOf(step: OnboardStep): OnboardStep | "complete" {
  const i = ONBOARD_STEPS.indexOf(step);
  if (i === -1 || i === ONBOARD_STEPS.length - 1) return "complete";
  return ONBOARD_STEPS[i + 1];
}

export function prevStepOf(step: OnboardStep): OnboardStep | null {
  const i = ONBOARD_STEPS.indexOf(step);
  if (i <= 0) return null;
  return ONBOARD_STEPS[i - 1];
}

export function isValidStep(s: string): s is OnboardStep {
  return ONBOARD_STEPS.includes(s as OnboardStep);
}

/** Slugify a business name into a tenant slug. Lowercase, hyphenated, ASCII. */
export function slugifyTenant(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "tenant";
}
