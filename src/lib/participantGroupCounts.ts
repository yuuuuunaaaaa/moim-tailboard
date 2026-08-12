import { queryFirst, queryRows } from "@/lib/queryRows";

/** 이벤트 전체 참가자 수(옵션 그룹과 무관) */
export async function countEventParticipants(eventId: number): Promise<number> {
  const row = await queryFirst<{ cnt: number }>(
    "SELECT COUNT(*) AS cnt FROM participant WHERE event_id = ?",
    [eventId],
  );
  return Number(row?.cnt ?? 0);
}

/** 10·20·30… 명 돌파 시 알림 */
export function isParticipantCountMilestone(count: number): boolean {
  return count > 0 && count % 10 === 0;
}

/** 목록 페이지와 동일: 활성 꼬리달기별 참가 인원 스냅샷. (±1)은 affectedEventId 에만 표시 */
export type TenantEventParticipantSnapshot = {
  eventTitle: string;
  /** 이벤트별 말머리. 감소한 이벤트는 leave_prefix, 나머지는 join_prefix를 사용. */
  titlePrefix?: string | null;
  count: number;
  delta?: number;
};

/**
 * 옵션 그룹과 무관하게 꼬리달기별 '전체 신청 인원'만 집계한다.
 * 변동(±1)은 이번 참여/취소가 발생한 꼬리달기에만 붙는다.
 */
export async function fetchTenantParticipantSnapshots(
  tenantId: number,
  affectedEventId: number,
  mode: "join" | "leave",
): Promise<TenantEventParticipantSnapshot[]> {
  const events = await queryRows<{
    id: number;
    title: string;
    telegram_participant_join_prefix: string | null;
    telegram_participant_leave_prefix: string | null;
    cnt: number;
  }>(
    `SELECT e.id, e.title, e.telegram_participant_join_prefix, e.telegram_participant_leave_prefix,
       (SELECT COUNT(*) FROM participant p WHERE p.event_id = e.id) AS cnt
     FROM event e
     WHERE e.tenant_id = ? AND e.is_active = 1
     ORDER BY e.event_order ASC, e.event_date DESC, e.id ASC`,
    [tenantId],
  );

  return events.map((ev) => {
    const isAffected = ev.id === affectedEventId;
    // 참가 인원이 "감소"한 이벤트만 leave_prefix, 그 외(증가·변동 없음)는 join_prefix.
    const rawPrefix =
      isAffected && mode === "leave"
        ? ev.telegram_participant_leave_prefix
        : ev.telegram_participant_join_prefix;
    return {
      eventTitle: ev.title,
      titlePrefix: rawPrefix?.trim() || null,
      count: Number(ev.cnt ?? 0),
      delta: isAffected ? (mode === "join" ? 1 : -1) : undefined,
    };
  });
}
