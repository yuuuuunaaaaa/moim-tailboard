/**
 * 참여자 목록·텔레그램 요약은 이름을 `, ` 로 이어 붙여 보여준다.
 * 이름 안에 구분자로 오해될 문자가 섞이면 명단을 읽을 수 없으므로 입력 단계에서 막는다.
 */
const FORBIDDEN_NAME_CHARS = /[,/&]/g;

export const PARTICIPANT_NAME_FORBIDDEN_MESSAGE =
  "이름에 쉼표(,) 슬래시(/) 앰퍼샌드(&)는 쓸 수 없습니다.";

export function stripForbiddenParticipantNameChars(value: string): string {
  return value.replace(FORBIDDEN_NAME_CHARS, "");
}
