"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Users,
  FileText,
  Settings as SettingsIcon,
  CreditCard,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** marker used to compute active state; matches if pathname startsWith */
  match: string;
}

export function Sidebar({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname() ?? "";

  const items: NavItem[] = [
    { label: "Overview",  href: `/${tenantSlug}`,          icon: LayoutDashboard, match: `/${tenantSlug}` },
    { label: "Agents",    href: `/${tenantSlug}/agents`,   icon: Bot,             match: `/${tenantSlug}/agents` },
    { label: "Leads",     href: `/${tenantSlug}/leads`,    icon: Users,           match: `/${tenantSlug}/leads` },
    { label: "Content",   href: `/${tenantSlug}/content`,  icon: FileText,        match: `/${tenantSlug}/content` },
    { label: "Settings",  href: `/settings`,               icon: SettingsIcon,    match: `/settings` },
    { label: "Billing",   href: `/billing`,                icon: CreditCard,      match: `/billing` },
  ];

  return (
    <aside
      aria-label="Primary navigation"
      className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-[rgba(255,255,255,0.07)] md:bg-[#0b0b13]"
    >
      <div className="flex h-16 items-center gap-2 px-5 border-b border-[rgba(255,255,255,0.07)]">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-md text-[12px] font-extrabold text-white"
          style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)" }}
        >
          IO
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-white">InvestorOS</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.match === `/${tenantSlug}`
                ? pathname === item.match
                : pathname.startsWith(item.match);
            return (
              <li key={item.href}>
                <Link
                  href={item.href as never}
                  className={[
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-[rgba(99,102,241,0.12)] text-[#a5b4fc]"
                      : "text-[#94a3b8] hover:bg-[rgba(255,255,255,0.04)] hover:text-white",
                  ].join(" ")}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-[rgba(255,255,255,0.07)] px-5 py-3 text-[11px] text-[#64748b]">
        <p>v0.1 · Founder rate</p>
      </div>
    </aside>
  );
}
