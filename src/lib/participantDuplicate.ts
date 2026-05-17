import { queryFirst } from "@/lib/queryRows";
import type { Participant } from "@/types";

/** 같은 꼬리달기에서 이름·학번(둘 다 NULL 포함)이 일치하는 참여자가 있는지 확인. (서버 전용) */
export async function findParticipantByNameAndStudentNo(
  eventId: number,
  name: string,
  studentNo: string | null,
  excludeParticipantId?: number,
): Promise<Participant | null> {
  const excludeClause =
    excludeParticipantId != null ? " AND id <> ?" : "";
  const params: (string | number | null)[] = [eventId, name, studentNo];
  if (excludeParticipantId != null) params.push(excludeParticipantId);

  return queryFirst<Participant>(
    `SELECT * FROM participant
     WHERE event_id = ? AND name = ? AND student_no <=> ?${excludeClause}
     LIMIT 1`,
    params,
  );
}
