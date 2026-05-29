/**
 * POST /api/onboard/submit
 *
 * Body: { step: OnboardStep, stepData: OnboardData[step] }
 *
 * Validates the user is authenticated and not already onboarded, merges the
 * step data into the running OnboardMetadata in Clerk publicMetadata, and:
 *  - If the step is the last one → creates the Tenant row, encrypts initial
 *    credentials into the vault, assigns user.publicMetadata.tenantId, and
 *    returns redirect=/onboard/complete.
 *  - Else → returns redirect=/onboard/<next-step>.
 *
 * Idempotent re-submits update the in-flight metadata without creating
 * duplicate tenants (slug collision throws 409).
 */
import { NextRequest, NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { setCredential } from "@/lib/credentials";
import {
  ONBOARD_STEPS,
  nextStepOf,
  isValidStep,
  slugifyTenant,
  type OnboardData,
  type OnboardMetadata,
  type OnboardStep,
} from "@/lib/onboard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const existingTenantId = (user.publicMetadata as { tenantId?: string } | undefined)?.tenantId;
  if (existingTenantId) {
    return NextResponse.json({ ok: true, redirect: `/${existingTenantId}` });
  }

  const body = await req.json().catch(() => ({}));
  const step = body.step as string | undefined;
  const stepData = body.stepData as OnboardData[OnboardStep] | undefined;

  if (!step || !isValidStep(step)) {
    return NextResponse.json({ error: `Invalid step: ${step}` }, { status: 400 });
  }

  const current = (user.publicMetadata as { onboarding?: OnboardMetadata } | undefined)?.onboarding ?? {
    step: ONBOARD_STEPS[0],
    data: {},
  };

  const updatedData: OnboardData = { ...current.data, [step]: stepData };
  const next = nextStepOf(step);

  const clerk = await clerkClient();

  if (next === "complete") {
    // Final step → provision the tenant
    const biz = updatedData.business;
    if (!biz?.name) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    }

    const slug = slugifyTenant(biz.name);

    // Reject collisions for now (no auto-suffixing yet — that's a UX call)
    const collision = await db.tenant.findUnique({ where: { slug } });
    if (collision) {
      return NextResponse.json(
        { error: `Tenant slug "${slug}" is already taken. Try a slightly different business name.` },
        { status: 409 }
      );
    }

    const tenant = await db.tenant.create({
      data: {
        slug,
        name: biz.name,
        legalName: biz.legalName ?? biz.name,
        status: "TRIAL",
      },
    });

    // Seed any provided integration metadata into the vault as non-secret credentials.
    // Real secret credentials (Airtable tokens, Telnyx API keys) will be added by
    // the provisioning scripts later — these rows just record the user's choices.
    if (updatedData.domain?.mode === "byo" && updatedData.domain.domain) {
      await setCredential(tenant.id, "wordpress", "url", `https://${updatedData.domain.domain}`, {
        metadata: { source: "onboard", mode: "byo" },
      });
    }
    if (updatedData.phone?.mode === "provision" && updatedData.phone.areaCode) {
      await setCredential(tenant.id, "telnyx", "area_code", updatedData.phone.areaCode, {
        metadata: { source: "onboard", mode: "provision" },
      });
    } else if (updatedData.phone?.mode === "byo" && updatedData.phone.phoneNumber) {
      await setCredential(tenant.id, "telnyx", "phone_number", updatedData.phone.phoneNumber, {
        metadata: { source: "onboard", mode: "byo" },
      });
    }
    if (updatedData.gbp?.mode === "delegated" && updatedData.gbp.placeId) {
      await setCredential(tenant.id, "google_business", "place_id", updatedData.gbp.placeId, {
        metadata: { source: "onboard" },
      });
    }
    if (updatedData.social?.mode === "added") {
      if (updatedData.social.facebookPageId) {
        await setCredential(tenant.id, "social", "facebook_page_id", updatedData.social.facebookPageId, {
          metadata: { source: "onboard" },
        });
      }
      if (updatedData.social.instagramHandle) {
        await setCredential(tenant.id, "social", "instagram_handle", updatedData.social.instagramHandle, {
          metadata: { source: "onboard" },
        });
      }
    }

    // Assign the tenant to the Clerk user + mark onboarding complete
    await clerk.users.updateUserMetadata(user.id, {
      publicMetadata: {
        tenantId: tenant.slug,
        onboarding: { step: "complete", data: updatedData } satisfies OnboardMetadata,
      },
    });

    return NextResponse.json({ ok: true, redirect: "/onboard/complete" });
  }

  // Save in-progress metadata and forward to next step
  await clerk.users.updateUserMetadata(user.id, {
    publicMetadata: {
      onboarding: { step: next, data: updatedData } satisfies OnboardMetadata,
    },
  });

  return NextResponse.json({ ok: true, redirect: `/onboard/${next}` });
}
