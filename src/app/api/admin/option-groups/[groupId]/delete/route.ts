import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissing } from "@/lib/adminTenantSlug";
import { pool, findTenantBySlug } from "@/lib/db";
import type { Admin, Tenant } from "@/types";

function canAccessTenant(admin: Admin, tenant: Tenant): boolean {
  return admin.is_superadmin || admin.tenant_id === tenant.id;
}

// POST /api/admin/option-groups/[groupId]/delete
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const { admin } = await getPageContext();
    if (!admin) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const { groupId: groupIdStr } = await params;
    const groupId = Number(groupIdStr);

    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    if (!tenantSlug) return await responseWhenTenantSlugMissing(admin);

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant)) return new Response("권한이 없습니다.", { status: 403 });

    await pool.query(
      "DELETE FROM option_group WHERE id = ? AND EXISTS (SELECT 1 FROM event e WHERE e.id = option_group.event_id AND e.tenant_id = ?)",
      [groupId, tenant.id],
    );

    return NextResponse.redirect(
      new URL(`/admin?tenant=${tenant.slug}`, request.url),
      303,
    );
  } catch (err) {
    console.error("POST /api/admin/option-groups/[groupId]/delete:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
