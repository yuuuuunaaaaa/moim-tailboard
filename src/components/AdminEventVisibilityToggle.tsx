"use client";

export default function AdminEventVisibilityToggle({
  eventId,
  tenantSlug,
  returnTo,
  isActive,
}: {
  eventId: number;
  tenantSlug: string;
  returnTo: string;
  isActive: boolean;
}) {
  const nextLabel = isActive ? "비공개" : "공개";
  const confirmText = `정말 ${nextLabel}로 변경할까요?`;

  return (
    <form
      method="post"
      action={`/api/admin/events/${eventId}/toggle`}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
      style={{ display: "inline" }}
    >
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        className={`badge ${isActive ? "badge--on" : "badge--off"}`}
        title={isActive ? "비공개로 전환" : "공개로 전환"}
        style={{ cursor: "pointer", border: 0, minHeight: 32 }}
      >
        {isActive ? "공개" : "비공개"}
      </button>
    </form>
  );
}

