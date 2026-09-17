import { queryFirst } from "@/lib/queryRows";
import type { Participant } from "@/types";

/** 같은 꼬리달기에서 이름이 일치하는 참여자가 있는지 확인. (서버 전용) */
export async function findParticipantByName(
  eventId: number,
  name: string,
  excludeParticipantId?: number,
): Promise<Participant | null> {
  const excludeClause =
    excludeParticipantId != null ? " AND id <> ?" : "";
  const params: (string | number)[] = [eventId, name];
  if (excludeParticipantId != null) params.push(excludeParticipantId);

  return queryFirst<Participant>(
    `SELECT * FROM participant
     WHERE event_id = ? AND name = ?${excludeClause}
     LIMIT 1`,
    params,
  );
}
