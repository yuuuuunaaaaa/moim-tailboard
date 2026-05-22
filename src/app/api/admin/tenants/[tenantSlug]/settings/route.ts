import { NextRequest, NextResponse } from "next/server";
import { getPageContext } from "@/lib/auth";
import { findTenantBySlug } from "@/lib/db";
import { insertActionLog } from "@/lib/actionLog";
import { execute } from "@/lib/queryRows";
import { isSuperadminForTenant } from "@/lib/superadmin";

function parseOptionalThreadId(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function parseOptionalChatId(raw: string): string | null {
  const s = raw.trim();
  return s || null;
}

// POST /api/admin/tenants/[tenantSlug]/settings
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { membership, username } = await getPageContext();
    if (!membership) return new Response("관리자만 접근할 수 있습니다.", { status: 403 });

    const { tenantSlug } = await params;
    const tenant = await findTenantBySlug(tenantSlug);
    if (!tenant) return new Response("Tenant not found", { status: 404 });
    if (!isSuperadminForTenant(membership, tenant.id)) {
      return new Response("최고 관리자만 설정을 변경할 수 있습니다.", { status: 403 });
    }

    const formData = await request.formData();
    const chatRoomId = String(formData.get("chat_room_id") ?? "").trim();
    if (!chatRoomId) {
      return NextResponse.redirect(
        new URL(`/admin/tenants/${tenantSlug}/settings?error=invalid_chat_room`, request.url),
        303,
      );
    }

    const chatRoomThreadId = parseOptionalThreadId(String(formData.get("chat_room_thread_id") ?? ""));
    const eventNoticeChatRoomId = parseOptionalChatId(
      String(formData.get("event_notice_chat_room_id") ?? ""),
    );
    const eventNoticeChatRoomThreadId = parseOptionalThreadId(
      String(formData.get("event_notice_chat_room_thread_id") ?? ""),
    );

    await execute(
      `UPDATE tenant SET
         chat_room_id = ?,
         chat_room_thread_id = ?,
         event_notice_chat_room_id = ?,
         event_notice_chat_room_thread_id = ?
       WHERE id = ?`,
      [
        chatRoomId,
        chatRoomThreadId,
        eventNoticeChatRoomId,
        eventNoticeChatRoomThreadId,
        tenant.id,
      ],
    );

    await insertActionLog({
      tenantId: tenant.id,
      action: "ADMIN_UPDATE_TENANT_TELEGRAM",
      metadata: {
        username: username ?? null,
        chat_room_id: chatRoomId,
      },
    });

    return NextResponse.redirect(
      new URL(`/admin/tenants/${tenantSlug}/settings?success=1`, request.url),
      303,
    );
  } catch (err) {
    console.error("POST /api/admin/tenants/[tenantSlug]/settings:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
