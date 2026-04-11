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
  /** WebApp 자동 로그인 시도 중에는 숨기고, 일반 브라우저·실패 시에는 위젯 표시 */
  const isLoginPage = !!(botName && authUrl);
  const [showLoginWidget, setShowLoginWidget] = useState(isLoginPage);

  // Login Widget 스크립트 주입
  useEffect(() => {
    if (!showLoginWidget || !botName || !authUrl) return;
    const root = document.getElementById("tg-widget-root");
    if (!root) return;
    root.innerHTML = "";
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-auth-url", authUrl);
    script.setAttribute("data-request-access", "write");
    root.appendChild(script);
    return () => {
      if (script.parentNode === root) root.removeChild(script);
      root.innerHTML = "";
    };
  }, [showLoginWidget, botName, authUrl]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const loginQs = tenantSlug ? `?tenantSlug=${encodeURIComponent(tenantSlug)}` : "";

    if (tg?.initData) {
      setIsWebApp(true);
      if (isLoginPage) {
        setShowLoginWidget(false);
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
              setShowLoginWidget(true);
              return;
            }
            window.location.href = "/";
          })
          .catch(() => {
            setStatus("error");
            setShowLoginWidget(true);
          });
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
      setShowLoginWidget(true);
    } else {
      window.location.href = `/login${loginQs}`;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isLoginPage) return null;

  return (
    <>
      {isWebApp && status === "loading" && (
        <p style={{ margin: "24px 0", color: "#6b7280" }}>로그인 중...</p>
      )}

      {isWebApp && status === "error" && (
        <div style={{ margin: "20px 0", textAlign: "left" }}>
          <p style={{ color: "var(--danger)", marginBottom: "12px" }}>
            텔레그램에 <strong>공개 사용자명(username)</strong>이 없으면 자동 로그인이 되지 않습니다.
          </p>
          <p style={{ color: "#4b5563", fontSize: "0.95rem", lineHeight: 1.5 }}>
            아래 <strong>Telegram으로 로그인</strong> 버튼을 눌러 로그인하거나, 텔레그램 설정 → 사용자명에서
            공개 사용자명을 만든 뒤 이 페이지를 새로고침해 주세요.
          </p>
        </div>
      )}

      {showLoginWidget && (
        <div id="login-widget-section">
          {!isWebApp && (
            <p style={{ margin: "8px 0 16px", color: "#6b7280", fontSize: "0.95rem" }}>
              아래 버튼으로 텔레그램 계정에 로그인해 주세요. (공개 사용자명이 있어야 합니다.)
            </p>
          )}
          <div className="login-widget-wrap" id="tg-widget-root" />
          <p style={{ marginTop: "16px" }}>
            <a href="/">← 돌아가기</a>
          </p>
        </div>
      )}
    </>
  );
}
