import type { Event } from "@/types";

export function isEventClosed(event: Pick<Event, "is_closed">): boolean {
  return !!event.is_closed;
}

export const EVENT_CLOSED_MESSAGE =
  "마감된 꼬리달기입니다.\n추가 참가·수정·취소는 임원에게 문의하세요.";
