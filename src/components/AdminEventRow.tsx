"use client";

import type { Event } from "@/types";

export interface EventRowProps {
  event: Event;
  tenantSlug: string;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  isDragHandleActive: boolean;
  reorderEnabled?: boolean;
  /** floating 클론으로 그릴 때는 form/링크 등 상호작용을 숨겨 시각만 보여준다 */
  isClone?: boolean;
}

/**
 * 한 줄짜리 이벤트 행.
 * 디자인: [핸들] [제목]               [수정] [로그]
 * - 공개/비공개 변경과 삭제 등 더 위험한 동작은 수정 페이지 안에서만 가능하도록 빼두었다.
 * - floating 클론(드래그 중 시각용)은 시각 요소만 보이고 인터랙션은 비활성화한다.
 */
export function EventRow({
  event: ev,
  tenantSlug,
  onPointerDown,
  isDragHandleActive,
  reorderEnabled = true,
  isClone = false,
}: EventRowProps) {
  const editHref = `/admin/events/${ev.id}/edit?tenant=${encodeURIComponent(tenantSlug)}`;
  const logsHref = `/admin/events/${ev.id}/logs?tenant=${encodeURIComponent(tenantSlug)}`;

  return (
    <div className={`event-admin-item ${!ev.is_active ? "event-admin-item--inactive" : ""}`}>
      {/* 드래그 핸들 — 공개 목록에서만 순서 변경 */}
      {reorderEnabled ? (
        <button
          type="button"
          className="icon-btn"
          title="드래그해서 순서 변경"
          aria-label="순서 변경 핸들"
          onPointerDown={onPointerDown}
          style={{
            cursor: isDragHandleActive ? "grabbing" : "grab",
            touchAction: "none",
            flex: "0 0 auto",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="6" r="1.4" />
            <circle cx="15" cy="6" r="1.4" />
            <circle cx="9" cy="12" r="1.4" />
            <circle cx="15" cy="12" r="1.4" />
            <circle cx="9" cy="18" r="1.4" />
            <circle cx="15" cy="18" r="1.4" />
          </svg>
        </button>
      ) : (
        <span className="icon-btn icon-btn--spacer" aria-hidden />
      )}

      <div className="event-admin-info">
        <div className="event-admin-title">{ev.title}</div>
      </div>

      {!isClone ? (
        <>
          <a
            className="icon-btn"
            href={editHref}
            title="수정"
            aria-label="꼬리달기 수정"
            style={{
              flex: "0 0 auto",
              minWidth: 32,
              minHeight: 32,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
            </svg>
          </a>
          <a
            className="icon-btn"
            href={logsHref}
            title="참여/취소 로그"
            aria-label="참여/취소 로그 보기"
            style={{ flex: "0 0 auto", minWidth: 32, minHeight: 32, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M7 14l3-3 3 2 5-6" />
            </svg>
          </a>
        </>
      ) : (
        <>
          <span
            className="icon-btn"
            aria-hidden
            style={{
              flex: "0 0 auto",
              minWidth: 32,
              minHeight: 32,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              opacity: 0.85,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
            </svg>
          </span>
          <span
            className="icon-btn"
            aria-hidden
            style={{
              flex: "0 0 auto",
              minWidth: 32,
              minHeight: 32,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              opacity: 0.85,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M7 14l3-3 3 2 5-6" />
            </svg>
          </span>
        </>
      )}
    </div>
  );
}
