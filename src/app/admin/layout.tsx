import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPageContext } from "@/lib/auth";
import { hasMultipleAdminTenants } from "@/lib/adminMembership";
import AdminManageTenantBar from "@/components/AdminManageTenantBar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin, membership } = await getPageContext();
  if (!admin || !membership) redirect("/login");

  const showBar = hasMultipleAdminTenants(membership);
  const tenants = membership.managedTenants.map((t) => ({
    slug: t.slug,
    name: t.name,
  }));

  return (
    <div className={showBar ? "admin-layout-root admin-layout-root--fab" : "admin-layout-root"}>
      {showBar && (
        <Suspense fallback={null}>
          <AdminManageTenantBar tenants={tenants} />
        </Suspense>
      )}
      {children}
    </div>
  );
}
