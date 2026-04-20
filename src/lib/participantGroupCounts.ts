import { queryFirst, queryRows } from "@/lib/queryRows";

export type OptionGroupCountRow = {
  id: number;
  name: string;
  sort_order: number;
  cnt: number;
};

/** 이벤트의 옵션 그룹별 현재 참가자 수(해당 그룹 옵션을 1개 이상 고른 인원) */
export async function fetchParticipantCountsPerOptionGroup(
  eventId: number,
): Promise<OptionGroupCountRow[]> {
  return queryRows<OptionGroupCountRow>(
    `SELECT og.id, og.name, og.sort_order,
      (
        SELECT COUNT(DISTINCT p2.id)
        FROM participant p2
        INNER JOIN participant_option po2 ON po2.participant_id = p2.id
        INNER JOIN option_item oi2 ON oi2.id = po2.option_item_id AND oi2.option_group_id = og.id
        WHERE p2.event_id = ?
      ) AS cnt
     FROM option_group og
     WHERE og.event_id = ?
     ORDER BY og.sort_order ASC`,
    [eventId, eventId],
  );
}

/** 신규 참가자가 고른 option_item 기준, 그룹별 +n (같은 그룹에 여러 항목이면 n>1) */
export async function fetchJoinDeltaPerOptionGroup(
  optionItemIds: number[],
): Promise<Map<number, number>> {
  const m = new Map<number, number>();
  if (optionItemIds.length === 0) return m;
  const ph = optionItemIds.map(() => "?").join(",");
  const rows = await queryRows<{ option_group_id: number; n: number }>(
    `SELECT option_group_id, COUNT(*) AS n FROM option_item WHERE id IN (${ph}) GROUP BY option_group_id`,
    optionItemIds,
  );
  for (const r of rows) m.set(r.option_group_id, r.n);
  return m;
}

/** 취소 직전 참가자의 선택 기준, 그룹별 제거 행 수(양수) */
export async function fetchLeaveRemovedCountPerOptionGroup(
  participantId: number,
): Promise<Map<number, number>> {
  const rows = await queryRows<{ option_group_id: number; n: number }>(
    `SELECT oi.option_group_id, COUNT(*) AS n
     FROM participant_option po
     INNER JOIN option_item oi ON oi.id = po.option_item_id
     WHERE po.participant_id = ?
     GROUP BY oi.option_group_id`,
    [participantId],
  );
  const m = new Map<number, number>();
  for (const r of rows) m.set(r.option_group_id, r.n);
  return m;
}

/** 목록 페이지와 동일: 활성 꼬리달기별 참가 인원 스냅샷. (±n)은 affectedEventId 에만 표시 */
export type TenantEventParticipantSnapshot = {
  eventTitle: string;
  lines: { groupName: string; count: number; delta?: number }[];
  totalFallback?: { count: number; delta?: number };
};

export async function fetchTenantParticipantSnapshots(
  tenantId: number,
  affectedEventId: number,
  mode: "join" | "leave",
  deltaByGroupId: Map<number, number>,
): Promise<TenantEventParticipantSnapshot[]> {
  const events = await queryRows<{ id: number; title: string }>(
    `SELECT id, title FROM event WHERE tenant_id = ? AND is_active = 1 ORDER BY event_date ASC`,
    [tenantId],
  );

  return Promise.all(
    events.map(async (ev) => {
      const isAffected = ev.id === affectedEventId;
      const groupRows = await fetchParticipantCountsPerOptionGroup(ev.id);
      if (groupRows.length > 0) {
        const lines = groupRows.map((g) => {
          let delta: number | undefined;
          if (isAffected) {
            const raw = deltaByGroupId.get(g.id);
            if (raw != null && raw !== 0) {
              delta = mode === "leave" ? -raw : raw;
            }
          }
          return { groupName: g.name, count: g.cnt, delta };
        });
        return { eventTitle: ev.title, lines };
      }
      const countRow = await queryFirst<{ cnt: number }>(
        "SELECT COUNT(*) AS cnt FROM participant WHERE event_id = ?",
        [ev.id],
      );
      let delta: number | undefined;
      if (isAffected) {
        delta = mode === "join" ? 1 : -1;
      }
      return {
        eventTitle: ev.title,
        lines: [],
        totalFallback: { count: countRow?.cnt ?? 0, delta },
      };
    }),
  );
}
