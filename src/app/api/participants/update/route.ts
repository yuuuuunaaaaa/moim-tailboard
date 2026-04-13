import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, loadAdminByUsernameCached } from "@/lib/auth";
import { pool, findTenantBySlug } from "@/lib/db";
import { checkTenantAccess, TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
import { sendMessage, eventDetailUrl, buildParticipantCountTelegramHtml } from "@/lib/telegram";

// POST /api/participants/update — 수정 또는 취소 (JWT → username → DB)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const participantId = Number(formData.get("participantId"));
    const name = String(formData.get("name") ?? "").trim();
    const studentNo = String(formData.get("studentNo") ?? "").trim() || null;
    const mode = String(formData.get("mode") ?? "");
    const isDevBypass =
      process.env.NODE_ENV === "development" || process.env.ALLOW_LOCAL_WITHOUT_AUTH === "1";
    const usernameFromForm = String(formData.get("username") ?? "").trim() || null;

    const auth = await getUserFromRequest(request);
    let username = auth?.username ?? null;
    if (!username && isDevBypass) username = usernameFromForm;

    if (!username) {
      return new Response("로그인이 필요합니다.", { status: 401 });
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });

    const cookieStore = request.cookies;
    const allowedSlug = cookieStore.get(TENANT_COOKIE_NAME)?.value;
    const admin = await loadAdminByUsernameCached(username);
    const access = checkTenantAccess(admin, tenant, allowedSlug);
    if (access === "forbidden") return new Response("접근이 거부되었습니다.", { status: 403 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [[participant]] = await pool.query<any[]>(
      "SELECT p.*, e.tenant_id, e.id AS event_id FROM participant p JOIN event e ON p.event_id = e.id WHERE p.id = ? LIMIT 1",
      [participantId],
    );
    if (!participant || participant.tenant_id !== tenant.id) {
      return new Response("Participant not found", { status: 404 });
    }
    if (participant.username !== username) {
      return new Response("Not allowed to modify this participant", { status: 403 });
    }

    if (mode === "delete") {
      await pool.query(
        "INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata) VALUES (?, ?, ?, ?, JSON_OBJECT('name', ?))",
        [tenant.id, participant.event_id, participant.id, "CANCEL_EVENT", participant.name],
      );
      await pool.query("UPDATE action_log SET participant_id = NULL WHERE participant_id = ?", [participant.id]);
      await pool.query("DELETE FROM participant WHERE id = ?", [participant.id]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [[{ cnt }]] = await pool.query<any[]>(
        "SELECT COUNT(*) AS cnt FROM participant WHERE event_id = ?",
        [participant.event_id],
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [[ev]] = await pool.query<any[]>(
        "SELECT title, telegram_participant_leave_prefix FROM event WHERE id = ? LIMIT 1",
        [participant.event_id],
      );
      const link = eventDetailUrl(tenant.slug, participant.event_id);
      const titleText = ev?.title ?? "이벤트";
      const leavePrefix = ev?.telegram_participant_leave_prefix ?? "";
      await sendMessage(
        tenant.chat_room_id,
        buildParticipantCountTelegramHtml({
          eventTitle: titleText,
          link,
          count: cnt,
          deltaLabel: "-1",
          prefix: leavePrefix,
        }),
      );
    } else {
      const newName = name || participant.name;
      const newStudentNo = studentNo;
      await pool.query(
        "UPDATE participant SET name = ?, student_no = ? WHERE id = ?",
        [newName, newStudentNo, participant.id],
      );
      await pool.query(
        "INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata) VALUES (?, ?, ?, ?, JSON_OBJECT('oldName', ?, 'oldStudentNo', ?, 'newName', ?, 'newStudentNo', ?))",
        [tenant.id, participant.event_id, participant.id, "UPDATE_PARTICIPANT",
          participant.name, participant.student_no, newName, newStudentNo],
      );
    }

    return NextResponse.redirect(
      new URL(`/t/${tenant.slug}/events/${participant.event_id}`, request.url),
      303,
    );
  } catch (err) {
    console.error("POST /api/participants/update:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
