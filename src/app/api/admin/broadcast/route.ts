import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { findTenantBySlug } from "@/lib/db";
import { queryFirst } from "@/lib/queryRows";
import { canAccessTenant } from "@/lib/tenantRestrict";
import {
  buildAdminBroadcastTelegramHtml,
  eventDetailUrl,
  eventListUrl,
  getEventNoticeChatRoomIdStrict,
  sendMessage,
} from "@/lib/telegram";

const MAX_BODY = 3500;
const MAX_HEADLINE = 120;

type LinkType = "none" | "list" | "event";

/** POST /api/admin/broadcast — 관리자 커스텀 방 알림(저장 없이 즉시 전송) */
export async function POST(request: NextRequest) {
  try {
    const { admin } = await getPageContext();
    if (!admin) {
      return NextResponse.json({ success: false, error: "관리자만 접근할 수 있습니다." }, { status: 403 });
    }

    const body = (await request.json()) as {
      tenantSlug?: string;
      headline?: string;
      message?: string;
      linkType?: string;
      eventId?: number | string;
      buttonText?: string;
    };

    const tenantSlug = typeof body.tenantSlug === "string" ? body.tenantSlug.trim() : "";
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "지역이 필요합니다." }, { status: 400 });
    }

    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) {
      return NextResponse.json({ success: false, error: "지역을 찾을 수 없습니다." }, { status: 404 });
    }
    if (!canAccessTenant(admin, tenant)) {
      return NextResponse.json({ success: false, error: "소속 지역만 전송할 수 있습니다." }, { status: 403 });
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ success: false, error: "메시지 내용을 입력해 주세요." }, { status: 400 });
    }
    if (message.length > MAX_BODY) {
      return NextResponse.json(
        { success: false, error: `메시지는 ${MAX_BODY}자 이내로 입력해 주세요.` },
        { status: 400 },
      );
    }

    const headline =
      typeof body.headline === "string" ? body.headline.trim().slice(0, MAX_HEADLINE) : "";

    const linkType: LinkType =
      body.linkType === "list" || body.linkType === "event" ? body.linkType : "none";

    const chatId = getEventNoticeChatRoomIdStrict(tenant);
    if (!chatId) {
      return NextResponse.json(
        {
          success: false,
          error: "꼬리달기 알림 방이 설정되어 있지 않습니다.",
        },
        { status: 400 },
      );
    }

    let webAppUrl: string | undefined;
    let buttonText = typeof body.buttonText === "string" ? body.buttonText.trim().slice(0, 32) : "";

    if (linkType === "list") {
      webAppUrl = eventListUrl(tenant.slug);
      if (!buttonText) buttonText = "꼬리달기 목록";
    } else if (linkType === "event") {
      const eventId = Number(body.eventId);
      if (!Number.isFinite(eventId) || eventId <= 0) {
        return NextResponse.json({ success: false, error: "연결할 꼬리달기를 선택해 주세요." }, { status: 400 });
      }
      const row = await queryFirst<{ id: number; title: string }>(
        "SELECT id, title FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
        [eventId, tenant.id],
      );
      if (!row) {
        return NextResponse.json({ success: false, error: "꼬리달기를 찾을 수 없습니다." }, { status: 404 });
      }
      webAppUrl = eventDetailUrl(tenant.slug, row.id);
      if (!buttonText) buttonText = row.title.slice(0, 32) || "바로가기";
    }

    const html = buildAdminBroadcastTelegramHtml({ body: message, headline: headline || null });

    const sent = await sendMessage(chatId, html, webAppUrl ? { webAppUrl, buttonText } : undefined);
    if (!sent.ok) {
      return NextResponse.json({ success: false, error: sent.error }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/admin/broadcast:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
