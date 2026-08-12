import { execute, queryRows } from "@/lib/queryRows";

type GroupRow = { id: number; name: string; multiple_select: number; is_required: number };
type ItemRow = { id: number; option_group_id: number };

async function loadOptionGroupsWithItemIndex(eventId: number): Promise<{
  groups: GroupRow[];
  itemById: Map<number, ItemRow>;
}> {
  const groups = await queryRows<GroupRow>(
    "SELECT id, name, multiple_select, is_required FROM option_group WHERE event_id = ?",
    [eventId],
  );
  if (groups.length === 0) return { groups, itemById: new Map() };

  const itemRows = await queryRows<ItemRow>(
    "SELECT id, option_group_id FROM option_item WHERE option_group_id IN (?)",
    [groups.map((g) => g.id)],
  );
  const itemById = new Map<number, ItemRow>();
  itemRows.forEach((r) => itemById.set(r.id, r));
  return { groups, itemById };
}

/**
 * 필수인데 선택이 비어 있는 그룹 이름 목록.
 * 항목이 없는 그룹은 고를 수가 없으니 검사에서 제외한다.
 */
export async function findUnselectedRequiredGroupNames(
  eventId: number,
  formData: FormData,
): Promise<string[]> {
  const { groups, itemById } = await loadOptionGroupsWithItemIndex(eventId);
  const groupIdsWithItems = new Set([...itemById.values()].map((it) => it.option_group_id));

  const missing: string[] = [];
  for (const g of groups) {
    if (!g.is_required) continue;
    if (!groupIdsWithItems.has(g.id)) continue;

    const selected = formData
      .getAll(`g_${g.id}`)
      .map(String)
      .some((v) => {
        const optId = Number(v);
        if (!Number.isFinite(optId) || optId <= 0) return false;
        return itemById.get(optId)?.option_group_id === g.id;
      });
    if (!selected) missing.push(g.name);
  }
  return missing;
}

/** 폼 필드 `g_{groupId}` 에서 검증된 option_item id 목록 추출 */
export async function collectOptionItemIdsFromForm(
  eventId: number,
  formData: FormData,
): Promise<number[]> {
  const { groups, itemById } = await loadOptionGroupsWithItemIndex(eventId);
  if (groups.length === 0) return [];

  const ids: number[] = [];
  for (const g of groups) {
    const key = `g_${g.id}`;
    const rawVals = formData.getAll(key).map(String).filter(Boolean);
    for (const v of rawVals) {
      const optId = Number(v);
      if (!Number.isFinite(optId) || optId <= 0) continue;
      const item = itemById.get(optId);
      if (!item || item.option_group_id !== g.id) continue;
      ids.push(optId);
    }
    if (!g.multiple_select && ids.length > 0) {
      const inGroup = ids.filter((id) => itemById.get(id)?.option_group_id === g.id);
      if (inGroup.length > 1) {
        const keep = inGroup[inGroup.length - 1]!;
        for (let i = ids.length - 1; i >= 0; i--) {
          const id = ids[i]!;
          if (itemById.get(id)?.option_group_id === g.id && id !== keep) {
            ids.splice(i, 1);
          }
        }
      }
    }
  }

  return ids;
}

/** 폼 필드 `g_{groupId}` 로 전달된 선택을 participant_option 에 반영 */
export async function syncParticipantOptionsFromForm(
  eventId: number,
  participantId: number,
  formData: FormData,
): Promise<number> {
  const optionItemIds = await collectOptionItemIdsFromForm(eventId, formData);
  await execute("DELETE FROM participant_option WHERE participant_id = ?", [participantId]);

  if (optionItemIds.length > 0) {
    const values = optionItemIds.map((id) => [participantId, id]);
    await execute(
      "INSERT INTO participant_option (participant_id, option_item_id) VALUES ?",
      [values],
    );
  }

  return optionItemIds.length;
}
