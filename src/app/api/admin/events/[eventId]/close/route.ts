import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { responseWhenTenantSlugMissingForRequest } from "@/lib/adminTenantSlug";
import { findTenantBySlug } from "@/lib/db";
import { execute, queryFirst } from "@/lib/queryRows";
import { canAccessTenant } from "@/lib/tenantRestrict";

// POST /api/admin/events/[eventId]/close
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { admin, membership } = await getPageContext();
    if (!admin) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const { eventId: eventIdStr } = await params;
    const eventId = Number(eventIdStr);

    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    if (!tenantSlug) return await responseWhenTenantSlugMissingForRequest();

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!canAccessTenant(admin, tenant, membership)) return new Response("권한이 없습니다.", { status: 403 });

    const cur = await queryFirst<{ is_closed: number }>(
      "SELECT is_closed FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
      [eventId, tenant.id],
    );
    if (!cur) return new Response("Event not found", { status: 404 });

    const nextClosed = cur.is_closed ? 0 : 1;
    await execute(
      "UPDATE event SET is_closed = ? WHERE id = ? AND tenant_id = ?",
      [nextClosed, eventId, tenant.id],
    );

    const returnTo = String(formData.get("returnTo") ?? "").trim();
    const isSafeRelative = returnTo.startsWith("/") && !returnTo.startsWith("//");
    const redirectPath = isSafeRelative ? returnTo : `/admin?tenant=${tenant.slug}`;
    const target = new URL(redirectPath, request.url);
    target.searchParams.set(
      "toast",
      nextClosed ? "event_closed_on" : "event_closed_off",
    );
    return NextResponse.redirect(target, 303);
  } catch (err) {
    console.error("POST /api/admin/events/[eventId]/close:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
