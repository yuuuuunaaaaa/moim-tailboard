"use client";

import { useState } from "react";
import type { Tenant } from "@/types";

interface Props {
  tenant: Tenant;
}

const DEFAULT_BUTTON_LABEL = "꼬리달기 목록";

export default function AdminBroadcastForm({ tenant }: Props) {
  const [open, setOpen] = useState(false);
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const noticeChatConfigured =
    !!(tenant.event_notice_chat_room_id ?? "").trim() &&
    tenant.event_notice_chat_room_id !== "-1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;

    if (!noticeChatConfigured) {
      setFeedback({
        kind: "error",
        text: "꼬리달기 알림 방이 설정되어 있지 않습니다.",
      });
      return;
    }

    const trimmed = message.trim();
    if (!trimmed) {
      setFeedback({ kind: "error", text: "메시지 내용을 입력해 주세요." });
      return;
    }

    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tenantSlug: tenant.slug,
          headline: headline.trim() || undefined,
          message: trimmed,
          buttonText: buttonText.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setFeedback({ kind: "error", text: data.error || "전송에 실패했습니다." });
        return;
      }
      setFeedback({ kind: "ok", text: "꼬리달기 알림 방에 메시지를 보냈습니다." });
      setMessage("");
      setHeadline("");
      setButtonText("");
    } catch {
      setFeedback({ kind: "error", text: "전송 요청 중 오류가 발생했습니다." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card admin-broadcast-card" style={{ gridColumn: "1 / -1" }}>
      <div className="card__title-row">
        <h2 className="card__title">메시지 보내기</h2>
        <button
          type="button"
          className="btn btn--sm btn--secondary"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "접기" : "펼치기"}
        </button>
      </div>

      {open && (
        <form className="admin-broadcast-form" onSubmit={handleSubmit}>
          <p className="form-hint" style={{ marginTop: 0 }}>
            꼬리달기 알림 방으로 전송합니다. 하단 버튼은 참가 알림과 같이{" "}
            <strong>꼬리달기 목록</strong> 미니앱으로 연결됩니다.
          </p>

          {!noticeChatConfigured && (
            <p className="form-hint admin-broadcast-feedback admin-broadcast-feedback--error" role="alert">
              이 지역에 꼬리달기 알림 방 ID가 없어 전송할 수 없습니다. 관리자에게 문의하세요.
            </p>
          )}

          <div className="form-group">
            <label htmlFor="broadcast-headline">굵은 제목 <span className="optional">(선택)</span></label>
            <input
              id="broadcast-headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={120}
              placeholder="예: 이번 주 안내"
              disabled={sending}
            />
          </div>

          <div className="form-group">
            <label htmlFor="broadcast-message">본문</label>
            <textarea
              id="broadcast-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={3500}
              rows={5}
              required
              placeholder="참여자에게 전달할 내용을 입력하세요."
              disabled={sending}
            />
          </div>

          <div className="form-group">
            <label htmlFor="broadcast-button">하단 버튼 글자 <span className="optional">(선택)</span></label>
            <input
              id="broadcast-button"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              maxLength={32}
              placeholder={`기본: ${DEFAULT_BUTTON_LABEL}`}
              disabled={sending}
            />
            <p className="form-hint" style={{ marginTop: 8, marginBottom: 0 }}>
              링크는 항상 이 지역의 꼬리달기 목록으로 연결됩니다.
            </p>
          </div>

          <div className="admin-edit-actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={sending || !noticeChatConfigured}
            >
              {sending ? "전송 중…" : "텔레그램으로 보내기"}
            </button>
          </div>

          {feedback && (
            <p
              className={`form-hint admin-broadcast-feedback admin-broadcast-feedback--${feedback.kind}`}
              role={feedback.kind === "error" ? "alert" : "status"}
            >
              {feedback.text}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
