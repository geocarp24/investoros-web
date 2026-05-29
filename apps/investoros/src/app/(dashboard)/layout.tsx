/**
 * Dashboard route group layout.
 *
 * Wraps all (dashboard) routes — /[tenant], /settings, /billing, etc. — in a
 * dark-themed shell with sidebar + topbar. The sidebar reads the current
 * tenant slug from Clerk publicMetadata so it can build the correct routes.
 *
 * Visual style mirrors the public landing (investoros.tech): bg #09090f,
 * accent gradient #6366f1 → #8b5cf6, Inter font. Components inside the shell
 * inherit dark CSS variables via the .dashboard-shell class in globals.css
 * (which overrides --color-background, --color-card, etc. for the subtree).
 */
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { db } from "@/server/db";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const userTenantId = (user.publicMetadata as { tenantId?: string } | undefined)?.tenantId;

  // Pending-assignment users get the shell without nav (no tenant yet)
  if (!userTenantId) {
    return (
      <div className="dashboard-shell min-h-screen bg-[#09090f] text-[#f8f8ff]">
        {children}
      </div>
    );
  }

  // Look up tenant name (fallback to hardcoded for the two bootstrap tenants)
  let tenantName = userTenantId;
  try {
    const tenant = await db.tenant.findUnique({
      where: { slug: userTenantId },
      select: { name: true },
    });
    if (tenant) tenantName = tenant.name;
  } catch {
    if (userTenantId === "geo-carpentry") tenantName = "Geo Carpentry LLC";
    else if (userTenantId === "pinnacle") tenantName = "Pinnacle Holdings Group";
  }

  return (
    <div className="dashboard-shell flex min-h-screen bg-[#09090f] text-[#f8f8ff]">
      <Sidebar tenantSlug={userTenantId} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar tenantName={tenantName} tenantSlug={userTenantId} />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
