import { redirect } from "next/navigation";

/**
 * Legacy /geo route — redirects to the dynamic /[tenant] dashboard.
 *
 * Preserved so old bookmarks and links keep working. The Clerk middleware still
 * enforces auth before this runs. The dynamic route validates the user's tenant.
 */
export default function GeoLegacyRedirect() {
  redirect("/geo-carpentry");
}
