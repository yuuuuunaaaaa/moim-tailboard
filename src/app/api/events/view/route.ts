import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { loadAdminMembershipCached } from "@/lib/adminMembership";
import { findTenantBySlug } from "@/lib/db";
import { queryFirst } from "@/lib/queryRows";
import { insertActionLog, ACTION_VIEW_EVENT } from "@/lib/actionLog";
import { isTenantAccessGrantedForApi, TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
import type { Event } from "@/types";

/** POST /api/events/view — 꼬리달기 상세 조회 로그 (DB action_log) */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { tenantSlug?: string; eventId?: number | string };
    const tenantSlug = typeof body.tenantSlug === "string" ? body.tenantSlug.trim() : "";
    const eventId = Number(body.eventId);
    if (!tenantSlug || !Number.isFinite(eventId) || eventId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    const allowedSlug = request.cookies.get(TENANT_COOKIE_NAME)?.value;
    const auth = await getUserFromRequest(request);
    const username = auth?.username ?? null;
    const membership = username ? await loadAdminMembershipCached(username) : null;
    const admin = membership?.admin ?? null;
    if (!isTenantAccessGrantedForApi(admin, tenant, allowedSlug, membership)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const event = await queryFirst<Event>(
      "SELECT id, title FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
      [eventId, tenant.id],
    );
    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
    }

    await insertActionLog({
      tenantId: tenant.id,
      eventId: event.id,
      action: ACTION_VIEW_EVENT,
      metadata: {
        username: username ?? null,
        eventTitle: event.title,
        path: `/t/${tenant.slug}/events/${event.id}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/events/view:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
