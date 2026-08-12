"use client";

export default function AdminEventClosedToggle({
  eventId,
  tenantSlug,
  returnTo,
  isClosed,
}: {
  eventId: number;
  tenantSlug: string;
  returnTo: string;
  isClosed: boolean;
}) {
  const confirmText = isClosed
    ? "정말 마감을 해제할까요?"
    : "정말 마감할까요? 일반 참여자는 참가·수정·취소가 불가능해집니다.";

  return (
    <form
      method="post"
      action={`/api/admin/events/${eventId}/close`}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
      style={{ display: "inline" }}
    >
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        className={`badge ${isClosed ? "badge--closed" : "badge--on"}`}
        title={isClosed ? "마감 해제" : "마감하기"}
        style={{ cursor: "pointer", border: 0, minHeight: 32 }}
      >
        {isClosed ? "마감" : "접수중"}
      </button>
    </form>
  );
}
