import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { pool, findTenantBySlug } from "@/lib/db";
import type { Admin, Tenant } from "@/types";

function canAccessTenant(admin: Admin, tenant: Tenant): boolean {
  return admin.is_superadmin || admin.tenant_id === tenant.id;
}

// POST /api/admin/tenants/[tenantSlug]/admins/[adminId]/delete
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; adminId: string }> },
) {
  try {
    const { admin } = await getPageContext();
    if (!admin) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const { tenantSlug, adminId: adminIdStr } = await params;
    const adminId = Number(adminIdStr);

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant)) {
      return new Response("소속 지역만 수정할 수 있습니다.", { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result] = await pool.query<any>(
      "DELETE FROM admin WHERE id = ? AND tenant_id = ?",
      [adminId, tenant.id],
    );

    if (result.affectedRows) {
      return NextResponse.redirect(
        new URL(`/admin/tenants/${tenantSlug}?success=removed`, request.url),
        303,
      );
    }
    return NextResponse.redirect(
      new URL(`/admin/tenants/${tenantSlug}?error=not_found`, request.url),
      303,
    );
  } catch (err) {
    console.error("POST /api/admin/tenants/[tenantSlug]/admins/[adminId]/delete:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
