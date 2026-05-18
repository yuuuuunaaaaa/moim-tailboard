"use client";

import { useState } from "react";
import type { Event, Tenant } from "@/types";

type LinkType = "none" | "list" | "event";

interface Props {
  tenant: Tenant;
  events: Event[];
}

export default function AdminBroadcastForm({ tenant, events }: Props) {
  const [open, setOpen] = useState(false);
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [linkType, setLinkType] = useState<LinkType>("list");
  const [eventId, setEventId] = useState("");
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
    if (linkType === "event" && !eventId) {
      setFeedback({ kind: "error", text: "연결할 꼬리달기를 선택해 주세요." });
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
          linkType,
          eventId: linkType === "event" ? Number(eventId) : undefined,
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
      <button
        type="button"
        className="admin-broadcast-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <h2 className="card__title" style={{ marginBottom: 0 }}>
          메시지 보내기
        </h2>
        <span className="admin-broadcast-toggle__hint">{open ? "접기" : "펼치기"}</span>
      </button>

      {open && (
        <form className="admin-broadcast-form" onSubmit={handleSubmit}>
          <p className="form-hint" style={{ marginTop: 0 }}>
            <code>event_notice_chat_room_id</code> 로 지정된 꼬리달기 알림 방으로 바로 전송합니다. DB에
            저장되지 않습니다.
          </p>
          {!noticeChatConfigured && (
            <p className="form-hint admin-broadcast-feedback admin-broadcast-feedback--error" role="alert">
              이 지역에 꼬리달기 알림 방 ID가 없어 전송할 수 없습니다.
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
            <label htmlFor="broadcast-link">버튼 링크</label>
            <select
              id="broadcast-link"
              value={linkType}
              onChange={(e) => setLinkType(e.target.value as LinkType)}
              disabled={sending}
            >
              <option value="none">없음</option>
              <option value="list">꼬리달기 목록</option>
              <option value="event">특정 꼬리달기</option>
            </select>
          </div>

          {linkType === "event" && (
            <div className="form-group">
              <label htmlFor="broadcast-event">꼬리달기</label>
              <select
                id="broadcast-event"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                required
                disabled={sending}
              >
                <option value="">선택…</option>
                {events.map((ev) => (
                  <option key={ev.id} value={String(ev.id)}>
                    {ev.title}
                    {!ev.is_active ? " (비공개)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {linkType !== "none" && (
            <div className="form-group">
              <label htmlFor="broadcast-button">버튼 글자 <span className="optional">(선택)</span></label>
              <input
                id="broadcast-button"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                maxLength={32}
                placeholder={linkType === "list" ? "기본: 꼬리달기 목록" : "기본: 꼬리달기 제목"}
                disabled={sending}
              />
            </div>
          )}

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