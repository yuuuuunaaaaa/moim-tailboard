import { execute, queryRows } from "@/lib/queryRows";

/** 폼 필드 `g_{groupId}` 에서 검증된 option_item id 목록 추출 */
export async function collectOptionItemIdsFromForm(
  eventId: number,
  formData: FormData,
): Promise<number[]> {
  const groups = await queryRows<{ id: number; multiple_select: number }>(
    "SELECT id, multiple_select FROM option_group WHERE event_id = ?",
    [eventId],
  );
  if (groups.length === 0) return [];

  const groupIds = groups.map((g) => g.id);
  const itemRows = await queryRows<{ id: number; option_group_id: number }>(
    "SELECT id, option_group_id FROM option_item WHERE option_group_id IN (?)",
    [groupIds],
  );
  const itemById = new Map<number, { id: number; option_group_id: number }>();
  itemRows.forEach((r) => itemById.set(r.id, r));

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
