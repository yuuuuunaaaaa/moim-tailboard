import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { findTenantBySlug } from "@/lib/db";
import { execute } from "@/lib/queryRows";
import { canAccessTenant } from "@/lib/tenantRestrict";

// POST /api/admin/tenants/[tenantSlug]/admins — 관리자 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { admin } = await getPageContext();
    if (!admin) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const { tenantSlug } = await params;
    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant)) {
      return new Response("소속 지역만 수정할 수 있습니다.", { status: 403 });
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
        "INSERT INTO admin (tenant_id, username, name) VALUES (?, ?, ?)",
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
