import type { OptionGroupWithItems } from "@/lib/participantOptionGroups";

/** `g_{groupId}` 체크/라디오 값을 FormData 에 붙임 (관리자·참여자 수정 공용) */
export function appendParticipantOptionsToFormData(
  fd: FormData,
  container: HTMLElement,
  groups: Pick<OptionGroupWithItems, "id">[],
): void {
  for (const g of groups) {
    const key = `g_${g.id}`;
    const inputs = container.querySelectorAll<HTMLInputElement>(`input[name="${key}"]`);
    inputs.forEach((el) => {
      if (el.type === "checkbox") {
        if (el.checked) fd.append(key, el.value);
        return;
      }
      if (el.type === "radio") {
        if (el.checked && el.value !== "") fd.append(key, el.value);
      }
    });
  }
}
