"use client";

import { useEffect } from "react";
import { parseStartParam } from "@/lib/telegram";

/** 로그인된 상태로 Mini App 루트(/)에 startapp 으로 진입했을 때 해당 테넌트 목록으로 보냄 */
export default function TelegramWebAppHomeRedirect() {
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const tryRedirect = (): boolean => {
      if (cancelled) return true;
      const raw =
        typeof window.Telegram?.WebApp?.initDataUnsafe?.start_param === "string"
          ? window.Telegram.WebApp.initDataUnsafe.start_param.trim()
          : "";
      if (!raw) return false;

      const { tenantSlug, eventId } = parseStartParam(raw);
      const slug = tenantSlug.trim();
      if (!slug) return true;

      const nextPath = eventId
        ? `/t/${encodeURIComponent(slug)}/events/${eventId}`
        : `/t/${encodeURIComponent(slug)}/events`;
      window.location.replace(
        `/api/init-tenant?slug=${encodeURIComponent(slug)}&next=${encodeURIComponent(nextPath)}`,
      );
      return true;
    };

    if (tryRedirect()) return;

    const poll = () => {
      if (cancelled) return;
      if (tryRedirect()) return;
      if (++attempts >= 45) return;
      setTimeout(poll, 150);
    };
    poll();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
