"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * 텔레그램 Login Widget — 스크립트를 이 컨테이너 안에만 넣어 카드 레이아웃이 깨지지 않게 함.
 * (next/script는 종종 body 끝에 붙어 iframe이 이상한 위치에 그려짐)
 *
 * data-auth-url 은 반드시 실제 접속 origin 과 일치해야 함. 서버에서 NEXT_PUBLIC_APP_URL 만으로
 * 조립하면 Vercel 배포 URL과 불일치해 oauth.telegram.org 에서 인증 후 넘어가지 않거나 /login 으로만
 * 머무는 경우가 있다. 그래서 브라우저의 location.origin 을 쓴다.
 */
export default function TelegramLoginWidget({
  botName,
  tenantSlug,
}: {
  botName: string;
  /** 로그인 콜백에 붙일 쿼리 (?tenantSlug=) — 선택 */
  tenantSlug?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !botName || typeof window === "undefined") return;

    const qs = tenantSlug?.trim()
      ? `?tenantSlug=${encodeURIComponent(tenantSlug.trim())}`
      : "";
    const authUrl = `${window.location.origin}/api/auth/telegram${qs}`;

    host.replaceChildren();
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-auth-url", authUrl);
    script.setAttribute("data-request-access", "write");
    host.appendChild(script);

    return () => {
      host.replaceChildren();
    };
  }, [botName, tenantSlug]);

  return <div ref={hostRef} className="telegram-widget-mount" aria-label="Telegram 로그인" />;
}
