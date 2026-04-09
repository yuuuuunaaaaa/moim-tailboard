"use client";

import { useEffect, useState } from "react";

interface TelegramAuthProps {
  tenantSlug?: string;
  /** 로그인 페이지에서만 사용 (Telegram Login Widget 표시용) */
  botName?: string;
  authUrl?: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

export default function TelegramAuth({ tenantSlug, botName, authUrl }: TelegramAuthProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [isWebApp, setIsWebApp] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const isLoginPage = !!(botName && authUrl);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (tg?.initData) {
      setIsWebApp(true);
      if (isLoginPage) {
        // 로그인 페이지: WebApp 자동 로그인
        setStatus("loading");
        tg.ready?.();
        fetch("/api/auth/telegram-webapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: tg.initData, tenantSlug: tenantSlug || "" }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (!data.ok || !data.token) {
              setStatus("error");
              return;
            }
            const maxAge = 90 * 24 * 60 * 60;
            document.cookie = `auth_token=${data.token}; path=/; max-age=${maxAge}`;
            const uname = data.user?.username || String(data.user?.id || "");
            if (uname) document.cookie = `username=${uname}; path=/; max-age=${maxAge}`;
            window.location.href = "/";
          })
          .catch(() => setStatus("error"));
      } else {
        // 이벤트 상세: WebApp 자동 로그인 후 페이지 새로고침
        setStatus("loading");
        tg.ready?.();
        tg.expand?.();
        fetch("/api/auth/telegram-webapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: tg.initData, tenantSlug: tenantSlug || "" }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (!data.ok || !data.token) {
              window.location.href = `/login?tenant=${encodeURIComponent(tenantSlug || "")}`;
              return;
            }
            const maxAge = 90 * 24 * 60 * 60;
            document.cookie = `auth_token=${data.token}; path=/; max-age=${maxAge}`;
            const uname = data.user?.username || String(data.user?.id || "");
            if (uname) document.cookie = `username=${uname}; path=/; max-age=${maxAge}`;
            window.location.reload();
          })
          .catch(() => {
            window.location.href = `/login?tenant=${encodeURIComponent(tenantSlug || "")}`;
          });
      }
    } else if (isLoginPage) {
      // 로그인 페이지 + 비WebApp → 위젯 표시
      setIsDesktop(true);
    } else {
      // 이벤트 상세 + 비WebApp → 로그인 페이지로
      window.location.href = `/login?tenant=${encodeURIComponent(tenantSlug || "")}`;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isLoginPage) return null;

  return (
    <>
      {/* WebApp 자동 로그인 */}
      {isWebApp && (
        <div id="webapp-section">
          {status === "loading" && <p style={{ margin: "24px 0", color: "#6b7280" }}>로그인 중...</p>}
          {status === "error" && (
            <p style={{ margin: "24px 0", color: "var(--danger)" }}>
              로그인에 실패했습니다. 텔레그램에서 다시 열어 주세요.
            </p>
          )}
        </div>
      )}

      {/* PC 브라우저: Login Widget */}
      {isDesktop && (
        <div id="desktop-section">
          <div className="login-widget-wrap">
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <script
              async
              src="https://telegram.org/js/telegram-widget.js?22"
              data-telegram-login={botName}
              data-size="large"
              data-auth-url={authUrl}
              data-request-access="write"
            />
          </div>
          <p style={{ marginTop: "16px" }}>
            <a href="/">← 돌아가기</a>
          </p>
        </div>
      )}
    </>
  );
}
