import { Check } from "lucide-react";
import { ONBOARD_STEPS, STEP_LABEL, type OnboardStep } from "@/lib/onboard";

export function WizardProgress({ current }: { current: OnboardStep }) {
  const currentIdx = ONBOARD_STEPS.indexOf(current);
  return (
    <ol className="mb-8 flex items-center gap-2 text-[11px]">
      {ONBOARD_STEPS.map((step, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <li key={step} className="flex flex-1 items-center gap-2">
            <span
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                isComplete
                  ? "border-[#6366f1] bg-[#6366f1] text-white"
                  : isCurrent
                  ? "border-[#a5b4fc] bg-[rgba(99,102,241,0.15)] text-[#a5b4fc]"
                  : "border-[rgba(255,255,255,0.1)] bg-transparent text-[#475569]",
              ].join(" ")}
            >
              {isComplete ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={isCurrent ? "text-white" : "text-[#64748b]"}>
              {STEP_LABEL[step]}
            </span>
            {i < ONBOARD_STEPS.length - 1 && (
              <span className="ml-1 h-px flex-1 bg-[rgba(255,255,255,0.07)]" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
