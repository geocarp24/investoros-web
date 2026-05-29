"use client";

import type { OnboardData, OnboardStep } from "@/lib/onboard";
import { OnboardForm, Field, RadioCardGroup } from "./OnboardForm";

export function GbpStep({ step, initialData }: { step: OnboardStep; initialData: OnboardData }) {
  return (
    <OnboardForm step={step} initialData={initialData}>
      {({ data, setField }) => {
        const v = data.gbp ?? { mode: "delegated" as const };
        const set = (patch: Partial<typeof v>) => setField("gbp", { ...v, ...patch });
        return (
          <>
            <RadioCardGroup
              name="gbp-mode"
              value={v.mode}
              onChange={(m) => set({ mode: m })}
              options={[
                {
                  value: "delegated",
                  label: "Add InvestorOS as manager",
                  description: "Most legitimate path — works without Meta App Review. Nova posts on your behalf via Google's manager API.",
                  recommended: true,
                },
                {
                  value: "skip",
                  label: "Skip for now",
                  description: "Set up GBP later from Settings. You'll miss Nova's automation until you do.",
                },
              ]}
            />

            {v.mode === "delegated" && (
              <>
                <div className="space-y-2 rounded-md border border-[rgba(255,255,255,0.07)] bg-[#16161f] p-4 text-xs text-[#94a3b8]">
                  <p className="font-semibold text-white">How to add us as manager (5 minutes):</p>
                  <ol className="list-decimal space-y-1 pl-4">
                    <li>Open <a href="https://business.google.com" target="_blank" rel="noopener" className="text-[#a5b4fc] underline">business.google.com</a> and sign in with your Google account.</li>
                    <li>Pick the business profile you want us to manage.</li>
                    <li>Go to <strong className="text-white">Menu → Users → Add</strong>.</li>
                    <li>Add <code className="rounded bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 text-[#a5b4fc]">ops@investoros.tech</code> with role <strong className="text-white">Manager</strong>.</li>
                    <li>Click <strong className="text-white">Invite</strong>. We accept automatically within an hour.</li>
                  </ol>
                </div>
                <Field
                  label="Your Google place ID (optional)"
                  placeholder="ChIJ..."
                  hint="If you know it, paste here. Otherwise we find it from your business name + city after onboarding."
                  value={v.placeId ?? ""}
                  onChange={(e) => set({ placeId: e.target.value })}
                />
              </>
            )}
          </>
        );
      }}
    </OnboardForm>
  );
}
