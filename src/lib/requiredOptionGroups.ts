type RequiredCheckGroup = { id: number; name: string; is_required: number };

export function requiredOptionGroupMessage(groupName: string): string {
  return `'${groupName}' 옵션을 선택해 주세요.`;
}

/**
 * 필수 그룹 중 아직 아무것도 고르지 않은 첫 번째 그룹 이름.
 * 항목이 하나도 없는 그룹은 고를 수가 없으니 검사 대상에서 제외한다.
 */
export function findUnselectedRequiredGroupName(
  container: HTMLElement,
  groups: RequiredCheckGroup[],
): string | null {
  for (const g of groups) {
    if (!g.is_required) continue;
    const inputs = container.querySelectorAll<HTMLInputElement>(`input[name="g_${g.id}"]`);
    if (inputs.length === 0) continue;
    const hasSelection = [...inputs].some((el) => el.checked && el.value !== "");
    if (!hasSelection) return g.name;
  }
  return null;
}
