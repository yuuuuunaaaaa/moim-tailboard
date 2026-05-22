import { appendParticipantOptionsToFormData } from "@/lib/collectParticipantOptionFormData";
import type { OptionGroupWithItems } from "@/lib/participantOptionGroups";

/** 관리자 `update-one` API 로 이름·옵션 저장 (관리 화면·참여 화면 공용) */
export async function submitParticipantRowUpdate(opts: {
  eventId: number;
  tenantSlug: string;
  participantId: number;
  container: HTMLElement;
  groups: OptionGroupWithItems[];
  /** `event` → 꼬리달기 상세, `admin` → 관리 수정 페이지 */
  from: "event" | "admin";
  allowDuplicate?: boolean;
}): Promise<void> {
  const fd = new FormData();
  fd.set("tenantSlug", opts.tenantSlug);
  fd.set("participantId", String(opts.participantId));
  fd.set("from", opts.from);
  if (opts.allowDuplicate) fd.set("allowDuplicate", "1");

  const nameInput = opts.container.querySelector<HTMLInputElement>('input[name="name"]');
  if (nameInput) fd.set("name", nameInput.value.trim());

  const studentNoInput = opts.container.querySelector<HTMLInputElement>('input[name="studentNo"]');
  if (studentNoInput) fd.set("studentNo", studentNoInput.value.trim());

  appendParticipantOptionsToFormData(fd, opts.container, opts.groups);

  const res = await fetch(`/api/admin/events/${opts.eventId}/participants/update-one`, {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `저장 실패 (${res.status})`);
  }

  if (res.redirected) {
    window.location.href = res.url;
    return;
  }

  const toast = opts.from === "event" ? "updated" : "row_saved";
  const path =
    opts.from === "event"
      ? `/t/${encodeURIComponent(opts.tenantSlug)}/events/${opts.eventId}?toast=${toast}`
      : `/admin/events/${opts.eventId}/edit?tenant=${encodeURIComponent(opts.tenantSlug)}&toast=${toast}`;
  window.location.href = path;
}
