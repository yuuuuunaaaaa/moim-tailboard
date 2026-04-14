"use client";

/** 이벤트 목록 삭제 — confirm은 클라이언트에서만 처리 */
export default function AdminEventDeleteForm({
  eventId,
  tenantSlug,
}: {
  eventId: number;
  tenantSlug: string;
}) {
  return (
    <form
      method="post"
      action={`/api/admin/events/${eventId}/delete`}
      style={{ display: "inline" }}
      onSubmit={(e) => {
        if (!confirm("이벤트와 모든 참여자 데이터가 삭제됩니다. 계속하시겠습니까?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <button className="icon-btn" style={{ color: "var(--danger)" }} type="submit" title="삭제">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </button>
    </form>
  );
}
