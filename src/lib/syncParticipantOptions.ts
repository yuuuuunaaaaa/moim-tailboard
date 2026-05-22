import { execute, queryRows } from "@/lib/queryRows";

/** 폼 필드 `g_{groupId}` 로 전달된 선택을 participant_option 에 반영 */
export async function syncParticipantOptionsFromForm(
  eventId: number,
  participantId: number,
  formData: FormData,
): Promise<number> {
  const groups = await queryRows<{ id: number; multiple_select: number }>(
    "SELECT id, multiple_select FROM option_group WHERE event_id = ?",
    [eventId],
  );
  if (groups.length === 0) return 0;

  const groupIds = groups.map((g) => g.id);
  const itemRows = await queryRows<{ id: number; option_group_id: number }>(
    "SELECT id, option_group_id FROM option_item WHERE option_group_id IN (?)",
    [groupIds],
  );
  const itemById = new Map<number, { id: number; option_group_id: number }>();
  itemRows.forEach((r) => itemById.set(r.id, r));

  await execute("DELETE FROM participant_option WHERE participant_id = ?", [participantId]);

  const values: Array<[number, number]> = [];
  for (const g of groups) {
    const key = `g_${g.id}`;
    const rawVals = formData.getAll(key).map(String).filter(Boolean);
    for (const v of rawVals) {
      const optId = Number(v);
      if (!Number.isFinite(optId) || optId <= 0) continue;
      const item = itemById.get(optId);
      if (!item || item.option_group_id !== g.id) continue;
      values.push([participantId, optId]);
    }
    if (!g.multiple_select && values.length > 0) {
      const last = values.filter((t) => itemById.get(t[1])?.option_group_id === g.id);
      if (last.length > 1) {
        const keep = last[last.length - 1]!;
        for (let i = values.length - 1; i >= 0; i--) {
          const opt = values[i]!;
          if (itemById.get(opt[1])?.option_group_id === g.id && opt[1] !== keep[1]) {
            values.splice(i, 1);
          }
        }
      }
    }
  }

  if (values.length > 0) {
    await execute(
      "INSERT INTO participant_option (participant_id, option_item_id) VALUES ?",
      [values],
    );
  }

  return values.length;
}
