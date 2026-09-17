export const DUPLICATE_PARTICIPANT_WARNING =
  "같은 이름으로 이미 참여한 기록이 있습니다.\n기존 참여를 수정하지 않고 추가 등록하면 같은 이름으로 중복 신청될 수 있습니다.\n기존 제출 수정은 전체 목록에서 가능합니다.\n동명이인이라면 이름 뒤에 학번이나 핸드폰 번호 뒷자리 등을 추가로 기입해주세요.\n계속 입력하시겠습니까?";

/** 이름 일치 판별. */
export function participantIdentityMatches(
  a: { name: string },
  b: { name: string },
): boolean {
  return a.name.trim() === b.name.trim();
}

/** 클라이언트용 — 목록에서 중복 참여자 존재 여부. */
export function hasDuplicateParticipantInList(
  participants: { id: number; name: string }[],
  name: string,
  excludeParticipantId?: number,
): boolean {
  const target = { name };
  return participants.some((p) => {
    if (excludeParticipantId != null && p.id === excludeParticipantId) return false;
    return participantIdentityMatches({ name: p.name }, target);
  });
}
