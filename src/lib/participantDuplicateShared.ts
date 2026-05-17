export const DUPLICATE_PARTICIPANT_WARNING =
  "같은 이름으로 이미 참여한 기록이 있습니다. 계속 입력하시겠습니까?";

export function normalizeStudentNo(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

/** DB `student_no <=> ?` 와 동일한 이름·학번 일치 판별. */
export function participantIdentityMatches(
  a: { name: string; studentNo: string | null },
  b: { name: string; studentNo: string | null },
): boolean {
  return a.name.trim() === b.name.trim() && normalizeStudentNo(a.studentNo) === normalizeStudentNo(b.studentNo);
}

/** 클라이언트용 — 목록에서 중복 참여자 존재 여부. */
export function hasDuplicateParticipantInList(
  participants: { id: number; name: string; student_no: string | null }[],
  name: string,
  studentNo: string | null,
  excludeParticipantId?: number,
): boolean {
  const target = { name, studentNo };
  return participants.some((p) => {
    if (excludeParticipantId != null && p.id === excludeParticipantId) return false;
    return participantIdentityMatches({ name: p.name, studentNo: p.student_no }, target);
  });
}
