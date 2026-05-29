"use client";

import type { OnboardData, OnboardStep } from "@/lib/onboard";
import { OnboardForm, Field, RadioCardGroup } from "./OnboardForm";

export function PhoneStep({ step, initialData }: { step: OnboardStep; initialData: OnboardData }) {
  return (
    <OnboardForm step={step} initialData={initialData}>
      {({ data, setField }) => {
        const v = data.phone ?? { mode: "provision" as const };
        const set = (patch: Partial<typeof v>) => setField("phone", { ...v, ...patch });
        return (
          <>
            <RadioCardGroup
              name="phone-mode"
              value={v.mode}
              onChange={(m) => set({ mode: m })}
              options={[
                {
                  value: "provision",
                  label: "Provision me a number",
                  description: "We get you a dedicated Telnyx business line. Fer takes over SMS lead reception 24/7.",
                  recommended: true,
                },
                {
                  value: "byo",
                  label: "I have a business line",
                  description: "Bring an OpenPhone, Twilio, or Telnyx number you already own.",
                },
                {
                  value: "skip",
                  label: "Skip for now",
                  description: "Set up phone later. Fer stays paused until you do.",
                },
              ]}
            />

            {v.mode === "provision" && (
              <Field
                label="Preferred area code"
                placeholder="e.g. 920"
                hint="3-digit US area code (we'll pick a number with this prefix)."
                maxLength={3}
                value={v.areaCode ?? ""}
                onChange={(e) => set({ areaCode: e.target.value.replace(/\D/g, "") })}
              />
            )}

            {v.mode === "byo" && (
              <Field
                label="Your business phone number"
                placeholder="+1 (920) 555-1234"
                hint="Must support SMS via Telnyx, OpenPhone, or Twilio API."
                value={v.phoneNumber ?? ""}
                onChange={(e) => set({ phoneNumber: e.target.value })}
              />
            )}

            <div className="rounded-md border border-[rgba(255,255,255,0.07)] bg-[#16161f] p-4 text-[11px] text-[#94a3b8]">
              <strong className="text-white">A2P 10DLC compliance:</strong> US carriers require business
              SMS senders to register a brand + campaign. We handle that once Stripe is wired (Sprint B4) —
              for now your number stays in test mode (200 SMS/day).
            </div>
          </>
        );
      }}
    </OnboardForm>
  );
}
