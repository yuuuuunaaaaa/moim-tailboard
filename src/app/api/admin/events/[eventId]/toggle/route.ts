import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissing } from "@/lib/adminTenantSlug";
import { findTenantBySlug } from "@/lib/db";
import { execute } from "@/lib/queryRows";
import { canAccessTenant } from "@/lib/tenantRestrict";

// POST /api/admin/events/[eventId]/toggle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { admin } = await getPageContext();
    if (!admin) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const { eventId: eventIdStr } = await params;
    const eventId = Number(eventIdStr);

    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    if (!tenantSlug) return await responseWhenTenantSlugMissing(admin);

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant)) return new Response("권한이 없습니다.", { status: 403 });

    await execute(
      "UPDATE event SET is_active = 1 - is_active WHERE id = ? AND tenant_id = ?",
      [eventId, tenant.id],
    );

    // 폼이 returnTo 를 보내면(수정 페이지 등) 그쪽으로 다시 보내고, 없으면 관리 메인으로.
    // 외부 리다이렉트로 악용되지 않도록 동일 출처 경로(`/`)만 허용한다.
    const returnTo = String(formData.get("returnTo") ?? "").trim();
    const isSafeRelative = returnTo.startsWith("/") && !returnTo.startsWith("//");
    const redirectPath = isSafeRelative ? returnTo : `/admin?tenant=${tenant.slug}`;
    return NextResponse.redirect(new URL(redirectPath, request.url), 303);
  } catch (err) {
    console.error("POST /api/admin/events/[eventId]/toggle:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
