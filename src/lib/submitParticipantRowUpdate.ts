import { appendParticipantOptionsToFormData } from "@/lib/collectParticipantOptionFormData";
import type { OptionGroupWithItems } from "@/lib/participantOptionGroups";

/** `update-one` API 로 이름·옵션 저장 (꼬리달기 상세의 본인·관리자 수정 공용) */
export async function submitParticipantRowUpdate(opts: {
  eventId: number;
  tenantSlug: string;
  participantId: number;
  container: HTMLElement;
  groups: OptionGroupWithItems[];
  allowDuplicate?: boolean;
}): Promise<void> {
  const fd = new FormData();
  fd.set("tenantSlug", opts.tenantSlug);
  fd.set("participantId", String(opts.participantId));
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

  window.location.href = `/t/${encodeURIComponent(opts.tenantSlug)}/events/${opts.eventId}?toast=updated`;
}
