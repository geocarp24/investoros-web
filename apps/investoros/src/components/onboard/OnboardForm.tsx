"use client";

import { useState, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import {
  type OnboardStep,
  type OnboardData,
  ONBOARD_STEPS,
} from "@/lib/onboard";

interface OnboardFormProps {
  step: OnboardStep;
  initialData: OnboardData;
  children: (form: { data: OnboardData; setField: (k: keyof OnboardData, v: OnboardData[keyof OnboardData]) => void }) => ReactNode;
}

/**
 * Shared form shell for each onboarding step. Children receive the current
 * data + a setField helper that updates the in-memory state. On submit, posts
 * to /api/onboard/submit and navigates to the next step or /onboard/complete.
 */
export function OnboardForm({ step, initialData, children }: OnboardFormProps) {
  const router = useRouter();
  const [data, setData] = useState<OnboardData>(initialData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentIdx = ONBOARD_STEPS.indexOf(step);
  const isFirst = currentIdx === 0;

  function setField<K extends keyof OnboardData>(k: K, v: OnboardData[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboard/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, stepData: data[step] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      if (json.redirect) router.push(json.redirect);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  function onBack() {
    if (currentIdx === 0) return;
    router.push(`/onboard/${ONBOARD_STEPS[currentIdx - 1]}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {children({ data, setField })}

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.07)] pt-5">
        <button
          type="button"
          onClick={onBack}
          disabled={isFirst || submitting}
          className={[
            "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium",
            isFirst || submitting
              ? "cursor-not-allowed text-[#475569]"
              : "text-[#94a3b8] hover:text-white",
          ].join(" ")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="submit"
          disabled={submitting}
          className={[
            "inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-opacity",
            submitting
              ? "cursor-wait bg-[rgba(99,102,241,0.4)] text-white"
              : "bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white hover:opacity-90",
          ].join(" ")}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {currentIdx === ONBOARD_STEPS.length - 1 ? "Finish" : "Continue"}
          {!submitting && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </form>
  );
}

/** Standard text input used across all onboarding steps. */
export function Field({
  label, hint, ...inputProps
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium text-[#cbd5e1]">{label}</span>
      <input
        {...inputProps}
        className={[
          "block w-full rounded-md border border-[rgba(255,255,255,0.1)] bg-[#16161f] px-3 py-2 text-sm text-white placeholder:text-[#475569]",
          "focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]",
          inputProps.className ?? "",
        ].join(" ")}
      />
      {hint && <span className="block text-[10px] text-[#64748b]">{hint}</span>}
    </label>
  );
}

/** Radio-card group for "pick a mode" selection within a step. */
export function RadioCardGroup<T extends string>({
  name, value, onChange, options,
}: {
  name: string;
  value: T | undefined;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; description: string; recommended?: boolean }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={[
            "cursor-pointer rounded-lg border p-4 transition-colors",
            value === opt.value
              ? "border-[#6366f1] bg-[rgba(99,102,241,0.08)]"
              : "border-[rgba(255,255,255,0.07)] bg-[#111118] hover:border-[rgba(255,255,255,0.14)]",
          ].join(" ")}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="sr-only"
          />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{opt.label}</span>
            {opt.recommended && (
              <span className="rounded-md bg-[rgba(99,102,241,0.2)] px-1.5 py-0.5 text-[10px] font-medium text-[#a5b4fc]">
                Recommended
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-[#94a3b8]">{opt.description}</p>
        </label>
      ))}
    </div>
  );
}
