"use client";

import { UserButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

interface TopbarProps {
  tenantName: string;
  tenantSlug: string;
}

export function Topbar({ tenantName, tenantSlug }: TopbarProps) {
  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[rgba(255,255,255,0.07)] bg-[#09090f]/80 px-6 backdrop-blur"
    >
      <div className="flex items-center gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">
          Tenant
        </p>
        <span className="text-sm font-medium text-white">{tenantName}</span>
        <span className="hidden text-xs text-[#64748b] sm:inline">/{tenantSlug}</span>
      </div>

      <div className="flex items-center gap-3">
        <UserButton appearance={{ baseTheme: dark }} />
      </div>
    </header>
  );
}
