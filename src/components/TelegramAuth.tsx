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

  // PC: Login Widget 스크립트는 React 렌더 후 DOM에 주입 (위젯이 data 속성을 읽도록)
  useEffect(() => {
    if (!isDesktop || !botName || !authUrl) return;
    const root = document.getElementById("tg-widget-root");
    if (!root) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-auth-url", authUrl);
    script.setAttribute("data-request-access", "write");
    root.appendChild(script);
    return () => {
      root.removeChild(script);
    };
  }, [isDesktop, botName, authUrl]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const loginQs = tenantSlug ? `?tenantSlug=${encodeURIComponent(tenantSlug)}` : "";

    if (tg?.initData) {
      setIsWebApp(true);
      if (isLoginPage) {
        setStatus("loading");
        tg.ready?.();
        fetch("/api/auth/telegram-webapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ initData: tg.initData, tenantSlug: tenantSlug || "" }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (!data.success || typeof data.username !== "string") {
              setStatus("error");
              return;
            }
            window.location.href = "/";
          })
          .catch(() => setStatus("error"));
      } else {
        setStatus("loading");
        tg.ready?.();
        tg.expand?.();
        fetch("/api/auth/telegram-webapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ initData: tg.initData, tenantSlug: tenantSlug || "" }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (!data.success || typeof data.username !== "string") {
              window.location.href = `/login${loginQs}`;
              return;
            }
            window.location.reload();
          })
          .catch(() => {
            window.location.href = `/login${loginQs}`;
          });
      }
    } else if (isLoginPage) {
      setIsDesktop(true);
    } else {
      window.location.href = `/login${loginQs}`;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isLoginPage) return null;

  return (
    <>
      {isWebApp && (
        <div id="webapp-section">
          {status === "loading" && <p style={{ margin: "24px 0", color: "#6b7280" }}>로그인 중...</p>}
          {status === "error" && (
            <p style={{ margin: "24px 0", color: "var(--danger)" }}>
              로그인에 실패했습니다. 텔레그램에 공개 사용자명(username)이 있어야 하며, 앱에서 다시 열어
              주세요.
            </p>
          )}
        </div>
      )}

      {isDesktop && (
        <div id="desktop-section">
          <div className="login-widget-wrap" id="tg-widget-root" />
          <p style={{ marginTop: "16px" }}>
            <a href="/">← 돌아가기</a>
          </p>
        </div>
      )}
    </>
  );
}
