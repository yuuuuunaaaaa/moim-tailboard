import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { canManageTenant, loadAdminMembershipCached } from "@/lib/adminMembership";
import { responseWhenTenantSlugMissingForRequest } from "@/lib/adminTenantSlug";
import { findTenantBySlug } from "@/lib/db";
import { isDevBypassEnabled } from "@/lib/dev";
import { findParticipantByNameAndStudentNo } from "@/lib/participantDuplicate";
import { syncParticipantOptionsFromForm } from "@/lib/syncParticipantOptions";
import { execute, queryFirst } from "@/lib/queryRows";
import { isTenantAccessGrantedForApi, TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";

// POST /api/admin/events/[eventId]/participants/update-one — 참여자 1행 이름·옵션 저장 (관리자 또는 본인)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId: eventIdStr } = await params;
    const eventId = Number(eventIdStr);

    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const from = String(formData.get("from") ?? "admin").trim() === "event" ? "event" : "admin";
    const usernameFromForm = String(formData.get("username") ?? "").trim() || null;

    const auth = await getUserFromRequest(request);
    let username = auth?.username ?? null;
    if (!username && isDevBypassEnabled()) username = usernameFromForm;
    if (!username) return new Response("로그인이 필요합니다.", { status: 401 });

    const membership = await loadAdminMembershipCached(username);
    const admin = membership?.admin ?? null;

    if (!tenantSlug) {
      return await responseWhenTenantSlugMissingForRequest();
      return new Response("tenantSlug required", { status: 400 });
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });

    const allowedSlug = request.cookies.get(TENANT_COOKIE_NAME)?.value;
    if (!isTenantAccessGrantedForApi(admin, tenant, allowedSlug, membership)) {
      return new Response("접근이 거부되었습니다.", { status: 403 });
    }

    const participantId = Number(formData.get("participantId"));
    if (!Number.isFinite(participantId) || participantId <= 0) {
      return new Response("Invalid participantId", { status: 400 });
    }

    const rawName = formData.get("name");
    const nameInput = typeof rawName === "string" ? rawName.trim() : "";
    const studentNo = String(formData.get("studentNo") ?? "").trim() || null;
    const allowDuplicate = String(formData.get("allowDuplicate") ?? "") === "1";

    const [ev, p] = await Promise.all([
      queryFirst<{ id: number }>(
        "SELECT id FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
        [eventId, tenant.id],
      ),
      queryFirst<{ id: number; name: string; student_no: string | null; username: string | null }>(
        "SELECT id, name, student_no, username FROM participant WHERE id = ? AND event_id = ? LIMIT 1",
        [participantId, eventId],
      ),
    ]);

    if (!ev) return new Response("Event not found", { status: 404 });
    if (!p) return new Response("Participant not found", { status: 404 });

    const isOwner = p.username === username;
    const isTenantAdmin = !!(admin && canManageTenant(membership, tenant.id));
    if (!isOwner && !isTenantAdmin) {
      return new Response("권한이 없습니다.", { status: 403 });
    }

    const newName = nameInput || p.name;
    const nameChanged = newName !== p.name;
    const studentChanged = studentNo !== p.student_no;

    if (!allowDuplicate && (nameChanged || studentChanged)) {
      const duplicate = await findParticipantByNameAndStudentNo(
        eventId,
        newName,
        studentNo,
        participantId,
      );
      if (duplicate) {
        const toastPath =
          from === "event"
            ? `/t/${tenant.slug}/events/${eventId}?toast=duplicate`
            : `/admin/events/${eventId}/edit?tenant=${encodeURIComponent(tenant.slug)}&toast=duplicate`;
        return NextResponse.redirect(new URL(toastPath, request.url), 303);
      }
    }

    if (nameChanged || studentChanged) {
      await execute("UPDATE participant SET name = ?, student_no = ? WHERE id = ?", [
        newName,
        studentNo,
        participantId,
      ]);
    }

    const optionCount = await syncParticipantOptionsFromForm(eventId, participantId, formData);

    const action = isTenantAdmin && !isOwner ? "ADMIN_UPDATE_PARTICIPANT_OPTIONS" : "UPDATE_PARTICIPANT";
    await execute(
      "INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata) VALUES (?, ?, ?, ?, JSON_OBJECT('username', ?, 'optionCount', ?, 'oldName', ?, 'newName', ?))",
      [
        tenant.id,
        eventId,
        participantId,
        action,
        username,
        optionCount,
        nameChanged ? p.name : null,
        nameChanged ? newName : null,
      ],
    );

    const toast = from === "event" ? "updated" : "row_saved";
    const redirectPath =
      from === "event"
        ? `/t/${tenant.slug}/events/${eventId}?toast=${toast}`
        : `/admin/events/${eventId}/edit?tenant=${encodeURIComponent(tenant.slug)}&toast=${toast}`;

    return NextResponse.redirect(new URL(redirectPath, request.url), 303);
  } catch (err) {
    console.error("POST /api/admin/events/[eventId]/participants/update-one:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
