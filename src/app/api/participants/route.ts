import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, loadAdminByUsernameCached } from "@/lib/auth";
import { pool, findTenantBySlug } from "@/lib/db";
import { isTenantAccessGrantedForApi, TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
import { sendMessage, eventDetailUrl, buildParticipantCountTelegramHtml } from "@/lib/telegram";

// POST /api/participants — 참여 신청 (JWT → username → DB)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const eventId = Number(formData.get("eventId"));
    const name = String(formData.get("name") ?? "").trim();
    const studentNo = String(formData.get("studentNo") ?? "").trim() || null;
    const optionItemIds = formData.getAll("optionItemIds").map(Number).filter(Boolean);
    const isDevBypass =
      process.env.NODE_ENV === "development" || process.env.ALLOW_LOCAL_WITHOUT_AUTH === "1";
    const usernameFromForm = String(formData.get("username") ?? "").trim() || null;

    const auth = await getUserFromRequest(request);
    let username = auth?.username ?? null;
    if (!username && isDevBypass) username = usernameFromForm;

    if (!username) {
      return new Response("로그인이 필요합니다. 텔레그램에서 열어 주세요.", { status: 401 });
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });

    const cookieStore = request.cookies;
    const allowedSlug = cookieStore.get(TENANT_COOKIE_NAME)?.value;
    const admin = await loadAdminByUsernameCached(username);
    if (!isTenantAccessGrantedForApi(admin, tenant, allowedSlug)) {
      return new Response("접근이 거부되었습니다.", { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [[event]] = await pool.query<any[]>(
      "SELECT * FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
      [eventId, tenant.id],
    );
    if (!event) return new Response("Event not found", { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [participantResult] = await pool.query<any>(
      "INSERT INTO participant (event_id, name, student_no, username) VALUES (?, ?, ?, ?)",
      [event.id, name, studentNo, username],
    );
    const participantId = participantResult.insertId;

    if (optionItemIds.length > 0) {
      const values = optionItemIds.map((id) => [participantId, id]);
      await pool.query(
        "INSERT INTO participant_option (participant_id, option_item_id) VALUES ?",
        [values],
      );
    }

    await pool.query(
      "INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata) VALUES (?, ?, ?, ?, JSON_OBJECT('name', ?, 'studentNo', ?, 'username', ?, 'optionItemIds', ?))",
      [tenant.id, event.id, participantId, "JOIN_EVENT", name, studentNo, username, JSON.stringify(optionItemIds)],
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [[{ cnt }]] = await pool.query<any[]>(
      "SELECT COUNT(*) AS cnt FROM participant WHERE event_id = ?",
      [event.id],
    );
    const link = eventDetailUrl(tenant.slug, event.id);
    const joinPrefix = event.telegram_participant_join_prefix ?? "";
    await sendMessage(
      tenant.chat_room_id,
      buildParticipantCountTelegramHtml({
        eventTitle: event.title,
        link,
        count: cnt,
        deltaLabel: "+1",
        prefix: joinPrefix,
      }),
    );

    return NextResponse.redirect(
      new URL(`/t/${tenant.slug}/events/${event.id}`, request.url),
      303,
    );
  } catch (err) {
    console.error("POST /api/participants:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
