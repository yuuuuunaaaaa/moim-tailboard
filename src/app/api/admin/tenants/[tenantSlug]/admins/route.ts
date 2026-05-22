import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { findTenantBySlug } from "@/lib/db";
import { execute } from "@/lib/queryRows";
import { isSuperadminForTenant } from "@/lib/superadmin";

// POST /api/admin/tenants/[tenantSlug]/admins — 일반 관리자 추가 (superadmin 전용)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { membership } = await getPageContext();
    if (!membership) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const { tenantSlug } = await params;
    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!isSuperadminForTenant(membership, tenant.id)) {
      return new Response("최고 관리자만 관리자를 추가할 수 있습니다.", { status: 403 });
    }

    const formData = await request.formData();
    const inputUsername = String(formData.get("username") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim() || null;

    if (!inputUsername) {
      return NextResponse.redirect(
        new URL(`/admin/tenants/${tenantSlug}?error=username_required`, request.url),
        303,
      );
    }

    try {
      await execute(
        "INSERT INTO admin (tenant_id, username, name, is_superadmin) VALUES (?, ?, ?, 0)",
        [tenant.id, inputUsername, name],
      );
      return NextResponse.redirect(
        new URL(`/admin/tenants/${tenantSlug}?success=added`, request.url),
        303,
      );
    } catch (err: unknown) {
      const mysqlErr = err as { code?: string };
      if (mysqlErr.code === "ER_DUP_ENTRY") {
        return NextResponse.redirect(
          new URL(`/admin/tenants/${tenantSlug}?error=username_duplicate`, request.url),
          303,
        );
      }
      throw err;
    }
  } catch (err) {
    console.error("POST /api/admin/tenants/[tenantSlug]/admins:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
