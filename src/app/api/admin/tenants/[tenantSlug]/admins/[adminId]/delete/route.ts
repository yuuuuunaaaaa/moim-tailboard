import { NextRequest, NextResponse } from "next/server";
import { getPageContext, normalizeIsSuperadmin } from "@/lib/auth";
import { findTenantBySlug } from "@/lib/db";
import { execute, queryFirst } from "@/lib/queryRows";
import { isSuperadminForTenant } from "@/lib/superadmin";

// POST /api/admin/tenants/[tenantSlug]/admins/[adminId]/delete
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; adminId: string }> },
) {
  try {
    const { membership } = await getPageContext();
    if (!membership) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const { tenantSlug, adminId: adminIdStr } = await params;
    const adminId = Number(adminIdStr);

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!isSuperadminForTenant(membership, tenant.id)) {
      return new Response("최고 관리자만 관리자를 삭제할 수 있습니다.", { status: 403 });
    }

    const target = await queryFirst<{ is_superadmin: unknown }>(
      "SELECT is_superadmin FROM admin WHERE id = ? AND tenant_id = ? LIMIT 1",
      [adminId, tenant.id],
    );
    if (!target) {
      return NextResponse.redirect(
        new URL(`/admin/tenants/${tenantSlug}?error=not_found`, request.url),
        303,
      );
    }
    if (normalizeIsSuperadmin(target.is_superadmin)) {
      return NextResponse.redirect(
        new URL(`/admin/tenants/${tenantSlug}?error=cannot_remove_superadmin`, request.url),
        303,
      );
    }

    const result = await execute(
      "DELETE FROM admin WHERE id = ? AND tenant_id = ? AND is_superadmin = 0",
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
