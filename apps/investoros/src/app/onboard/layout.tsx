/**
 * Onboarding shell layout — dark, focused, no sidebar (you don't have a tenant
 * yet so the dashboard nav doesn't apply). Renders a centered card with a
 * progress rail on the left.
 */
import { ReactNode } from "react";

export const metadata = { title: "Welcome to InvestorOS" };

export default function OnboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dashboard-shell min-h-screen bg-[#09090f] text-[#f8f8ff]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-1/2 top-[-200px] z-0 h-[600px] w-[800px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15),transparent_70%)]"
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
        <header className="mb-10 flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md text-[12px] font-extrabold text-white"
            style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)" }}
          >
            IO
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">InvestorOS</span>
        </header>
        {children}
      </div>
    </div>
  );
}
