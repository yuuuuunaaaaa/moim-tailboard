"use client";

import { useLayoutEffect, useRef } from "react";

declare global {
  interface Window {
    /** 텔레그램 위젯 iframe이 부모 창에서 호출 (data-onauth) */
    moimOnTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

/**
 * 텔레그램 Login Widget — 스크립트를 이 컨테이너 안에만 넣어 카드 레이아웃이 깨지지 않게 함.
 *
 * data-auth-url(리다이렉트)만 쓰면 oauth.telegram.org iframe 안에서 인증 후
 * 부모 창으로 넘어가지 못하고 “메시지를 보냈습니다…” 화면에서 멈추는 경우가 많다(특히 모바일).
 * data-onauth 로 부모 페이지에서 POST /api/auth/telegram 한 뒤 이동한다.
 *
 * `data-request-access="write"`는 로그인 검증과 무관하며, OAuth 단계에서 봇 DM 권한까지 묻는다.
 * 승인 알림이 늦거나 막히는 환경이 있어 기본은 생략한다. 필요 시 env로만 켠다.
 *
 * @see https://core.telegram.org/widgets/login
 */
export default function TelegramLoginWidget({
  botName,
  tenantSlug,
  requestAccess,
}: {
  botName: string;
  /** 로그인 성공 후 init-tenant / 이벤트 목록 이동에 사용 — 선택 */
  tenantSlug?: string;
  /** `"write"`일 때만 data-request-access 설정 (봇이 사용자에게 메시지 보낼 권한 요청) */
  requestAccess?: "write";
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const tenantRef = useRef(tenantSlug);
  tenantRef.current = tenantSlug;

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !botName || typeof window === "undefined") return;

    window.moimOnTelegramAuth = async (user: Record<string, unknown>) => {
      try {
        const slug = tenantRef.current?.trim() ?? "";
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ...user, tenantSlug: slug }),
        });
        const data = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !data.success) {
          window.alert(data.error || "로그인에 실패했습니다. 공개 사용자명(username)이 있는지 확인해 주세요.");
          return;
        }
        if (slug) {
          const nextPath = `/t/${encodeURIComponent(slug)}/events`;
          window.location.href = `/api/init-tenant?slug=${encodeURIComponent(slug)}&next=${encodeURIComponent(nextPath)}`;
          return;
        }
        window.location.href = "/";
      } catch {
        window.alert("로그인 요청 중 오류가 발생했습니다.");
      }
    };

    host.replaceChildren();
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "moimOnTelegramAuth(user)");
    if (requestAccess === "write") {
      script.setAttribute("data-request-access", "write");
    }
    host.appendChild(script);

    return () => {
      delete window.moimOnTelegramAuth;
      host.replaceChildren();
    };
  }, [botName, tenantSlug, requestAccess]);

  return <div ref={hostRef} className="telegram-widget-mount" aria-label="Telegram 로그인" />;
}
