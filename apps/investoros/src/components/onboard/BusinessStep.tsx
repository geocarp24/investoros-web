"use client";

import type { OnboardData, OnboardStep } from "@/lib/onboard";
import { OnboardForm, Field } from "./OnboardForm";

const INDUSTRIES = [
  { value: "general-contractor",   label: "General Contractor / Remodeler" },
  { value: "real-estate-investor", label: "Real Estate Investor" },
  { value: "wholesaler",           label: "Wholesaler" },
  { value: "agency-broker",        label: "Agency / Broker" },
  { value: "other",                label: "Other" },
];

export function BusinessStep({ step, initialData }: { step: OnboardStep; initialData: OnboardData }) {
  return (
    <OnboardForm step={step} initialData={initialData}>
      {({ data, setField }) => {
        const v = data.business ?? {
          name: "",
          industry: "general-contractor",
          ownerFullName: "",
          city: "",
          state: "WI",
          primaryLanguage: "en" as const,
        };
        const set = (patch: Partial<typeof v>) => setField("business", { ...v, ...patch });
        return (
          <>
            <Field
              label="Business name"
              required
              placeholder="e.g. Geo Carpentry LLC"
              value={v.name}
              onChange={(e) => set({ name: e.target.value })}
            />
            <Field
              label="Legal name (optional)"
              placeholder="Used on invoices and contracts"
              value={v.legalName ?? ""}
              onChange={(e) => set({ legalName: e.target.value })}
            />
            <Field
              label="Your full name"
              required
              placeholder="e.g. Jorge Cruz"
              value={v.ownerFullName}
              onChange={(e) => set({ ownerFullName: e.target.value })}
            />

            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-[#cbd5e1]">Industry</span>
              <select
                value={v.industry}
                onChange={(e) => set({ industry: e.target.value })}
                className="block w-full rounded-md border border-[rgba(255,255,255,0.1)] bg-[#16161f] px-3 py-2 text-sm text-white focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
              >
                {INDUSTRIES.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="City"
                required
                placeholder="e.g. Green Bay"
                value={v.city}
                onChange={(e) => set({ city: e.target.value })}
              />
              <Field
                label="State"
                required
                placeholder="WI"
                maxLength={2}
                value={v.state}
                onChange={(e) => set({ state: e.target.value.toUpperCase() })}
              />
            </div>

            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-[#cbd5e1]">Primary language</span>
              <div className="flex gap-2">
                {(["en", "es"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => set({ primaryLanguage: lang })}
                    className={[
                      "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      v.primaryLanguage === lang
                        ? "border-[#6366f1] bg-[rgba(99,102,241,0.12)] text-[#a5b4fc]"
                        : "border-[rgba(255,255,255,0.1)] bg-[#16161f] text-[#94a3b8] hover:text-white",
                    ].join(" ")}
                  >
                    {lang === "en" ? "English" : "Español"}
                  </button>
                ))}
              </div>
              <span className="block text-[10px] text-[#64748b]">
                Agents will reply in this language by default — they auto-detect when customers write in the other one.
              </span>
            </label>
          </>
        );
      }}
    </OnboardForm>
  );
}
