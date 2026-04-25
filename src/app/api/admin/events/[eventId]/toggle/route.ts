import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissing } from "@/lib/adminTenantSlug";
import { findTenantBySlug } from "@/lib/db";
import { execute, queryFirst } from "@/lib/queryRows";
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

    // 토글 결과(공개/비공개)를 호출자에게 알려야 토스트 메시지를 정확히 띄울 수 있다.
    // 한 번의 SELECT 로 현재값을 읽고, 명시적 값으로 UPDATE 한다.
    const cur = await queryFirst<{ is_active: number }>(
      "SELECT is_active FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
      [eventId, tenant.id],
    );
    if (!cur) return new Response("Event not found", { status: 404 });
    const nextActive = cur.is_active ? 0 : 1;
    await execute(
      "UPDATE event SET is_active = ? WHERE id = ? AND tenant_id = ?",
      [nextActive, eventId, tenant.id],
    );

    // 폼이 returnTo 를 보내면(수정 페이지 등) 그쪽으로 다시 보내고, 없으면 관리 메인으로.
    // 외부 리다이렉트로 악용되지 않도록 동일 출처 경로(`/`)만 허용한다.
    const returnTo = String(formData.get("returnTo") ?? "").trim();
    const isSafeRelative = returnTo.startsWith("/") && !returnTo.startsWith("//");
    const redirectPath = isSafeRelative ? returnTo : `/admin?tenant=${tenant.slug}`;
    const target = new URL(redirectPath, request.url);
    target.searchParams.set(
      "toast",
      nextActive ? "event_toggled_active" : "event_toggled_inactive",
    );
    return NextResponse.redirect(target, 303);
  } catch (err) {
    console.error("POST /api/admin/events/[eventId]/toggle:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
