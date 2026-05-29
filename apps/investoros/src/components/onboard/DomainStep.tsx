"use client";

import type { OnboardData, OnboardStep } from "@/lib/onboard";
import { OnboardForm, Field, RadioCardGroup } from "./OnboardForm";

export function DomainStep({ step, initialData }: { step: OnboardStep; initialData: OnboardData }) {
  return (
    <OnboardForm step={step} initialData={initialData}>
      {({ data, setField }) => {
        const v = data.domain ?? { mode: "byo" as const };
        const set = (patch: Partial<typeof v>) => setField("domain", { ...v, ...patch });
        return (
          <>
            <RadioCardGroup
              name="domain-mode"
              value={v.mode}
              onChange={(m) => set({ mode: m })}
              options={[
                {
                  value: "byo",
                  label: "I already have a domain",
                  description: "Bring your existing site. You stay on your platform; we connect via integrations.",
                  recommended: true,
                },
                {
                  value: "hosted",
                  label: "Host me a site",
                  description: "We deploy a branded site for you under a subdomain or your domain. Faster path if you don't have a site.",
                },
              ]}
            />

            {v.mode === "byo" && (
              <Field
                label="Your domain"
                placeholder="e.g. geocarpentry.com"
                hint="Just the domain — no https:// or paths."
                value={v.domain ?? ""}
                onChange={(e) => set({ domain: e.target.value.replace(/^https?:\/\//, "").replace(/\/.*$/, "") })}
              />
            )}

            {v.mode === "hosted" && (
              <div className="rounded-md border border-[rgba(255,255,255,0.07)] bg-[#16161f] p-4 text-xs text-[#94a3b8]">
                We'll provision a subdomain like <code className="text-[#a5b4fc]">yourbusiness.investoros.tech</code> after onboarding.
                You can connect a custom domain anytime from <span className="text-white">Settings → Connections</span>.
              </div>
            )}
          </>
        );
      }}
    </OnboardForm>
  );
}
