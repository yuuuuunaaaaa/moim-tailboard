"use client";

import { useEffect } from "react";

interface Props {
  tenantSlug: string;
  eventId: number;
}

/**
 * 꼬리달기 상세 페이지 조회를 action_log 에 남긴다.
 * 같은 탭·같은 이벤트는 세션당 1회만 기록(Strict Mode 이중 호출 완화).
 */
export default function EventViewLogger({ tenantSlug, eventId }: Props) {
  useEffect(() => {
    const key = `moim-view:${tenantSlug}:${eventId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* sessionStorage 불가 환경 */
    }

    fetch("/api/events/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({ tenantSlug, eventId }),
    }).catch(() => {});
  }, [tenantSlug, eventId]);

  return null;
}
