"use client";

import type { OnboardData, OnboardStep } from "@/lib/onboard";
import { OnboardForm, Field, RadioCardGroup } from "./OnboardForm";

export function SocialStep({ step, initialData }: { step: OnboardStep; initialData: OnboardData }) {
  return (
    <OnboardForm step={step} initialData={initialData}>
      {({ data, setField }) => {
        const v = data.social ?? { mode: "added" as const };
        const set = (patch: Partial<typeof v>) => setField("social", { ...v, ...patch });
        return (
          <>
            <RadioCardGroup
              name="social-mode"
              value={v.mode}
              onChange={(m) => set({ mode: m })}
              options={[
                {
                  value: "added",
                  label: "Add InvestorOS as Page admin",
                  description: "Standard Meta-approved path. Marco + Sofia draft and we publish via Buffer (already Meta-approved).",
                  recommended: true,
                },
                {
                  value: "skip",
                  label: "Skip for now",
                  description: "Connect FB / IG later from Settings. Marco runs in draft-only mode until you do.",
                },
              ]}
            />

            {v.mode === "added" && (
              <>
                <div className="space-y-2 rounded-md border border-[rgba(255,255,255,0.07)] bg-[#16161f] p-4 text-xs text-[#94a3b8]">
                  <p className="font-semibold text-white">How to add us as Page admin (3 minutes):</p>
                  <ol className="list-decimal space-y-1 pl-4">
                    <li>Open your Facebook Page in <a href="https://business.facebook.com" target="_blank" rel="noopener" className="text-[#a5b4fc] underline">Meta Business Suite</a>.</li>
                    <li>Go to <strong className="text-white">Settings → Page Access</strong>.</li>
                    <li>Click <strong className="text-white">Add new → Add People</strong>.</li>
                    <li>Add <code className="rounded bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 text-[#a5b4fc]">social@investoros.tech</code> with <strong className="text-white">Full control</strong>.</li>
                    <li>If your Instagram is linked to that Page, we get IG access automatically.</li>
                  </ol>
                </div>
                <Field
                  label="Facebook Page name (optional)"
                  placeholder="e.g. Geo Carpentry LLC"
                  hint="So we can confirm we connected to the right Page."
                  value={v.facebookPageId ?? ""}
                  onChange={(e) => set({ facebookPageId: e.target.value })}
                />
                <Field
                  label="Instagram handle (optional)"
                  placeholder="@geocarpentryllc2026"
                  value={v.instagramHandle ?? ""}
                  onChange={(e) => set({ instagramHandle: e.target.value })}
                />
              </>
            )}
          </>
        );
      }}
    </OnboardForm>
  );
}
