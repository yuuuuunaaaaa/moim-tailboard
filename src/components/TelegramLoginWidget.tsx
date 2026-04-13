"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * 텔레그램 Login Widget — 스크립트를 이 컨테이너 안에만 넣어 카드 레이아웃이 깨지지 않게 함.
 * (next/script는 종종 body 끝에 붙어 iframe이 이상한 위치에 그려짐)
 */
export default function TelegramLoginWidget({
  botName,
  authUrl,
}: {
  botName: string;
  authUrl: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !botName || !authUrl) return;

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
  }, [botName, authUrl]);

  return <div ref={hostRef} className="telegram-widget-mount" aria-label="Telegram 로그인" />;
}
