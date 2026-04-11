"use client";

import { useEffect, useState } from "react";

interface TelegramAuthProps {
  tenantSlug?: string;
  /** true: /login 페이지 — 텔레그램 위젯은 부모에서 Script로 삽입 */
  loginPage?: boolean;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
        openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
      };
    };
  }
}

export default function TelegramAuth({ tenantSlug, loginPage = false }: TelegramAuthProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [isWebApp, setIsWebApp] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const loginQs = tenantSlug ? `?tenantSlug=${encodeURIComponent(tenantSlug)}` : "";

    if (tg?.initData) {
      setIsWebApp(true);
      if (loginPage) {
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
    } else if (!loginPage) {
      window.location.href = `/login${loginQs}`;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loginPage) return null;

  return (
    <>
      {isWebApp && status === "loading" && (
        <p style={{ margin: "0 0 16px", color: "#6b7280" }}>로그인 중…</p>
      )}

      {isWebApp && status === "error" && (
        <div style={{ margin: "0 0 20px", textAlign: "left" }}>
          <p style={{ color: "var(--danger)", marginBottom: "12px" }}>
            텔레그램에 <strong>공개 사용자명(username)</strong>이 없으면 자동 로그인이 되지 않습니다.
          </p>
          <p style={{ color: "#4b5563", fontSize: "0.95rem", lineHeight: 1.5, marginBottom: "16px" }}>
            아래 <strong>Log in with Telegram</strong> 버튼을 누르거나, 설정 → 사용자명에서 공개 사용자명을 만든 뒤
            새로고침해 주세요. 미니 앱 안에서 버튼이 보이지 않으면 외부 브라우저에서 열어 주세요.
          </p>
          <button
            type="button"
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: "0.95rem",
              cursor: "pointer",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#f9fafb",
            }}
            onClick={() => {
              const url = window.location.href;
              if (window.Telegram?.WebApp?.openLink) {
                window.Telegram.WebApp.openLink(url, { try_instant_view: false });
              } else {
                window.open(url, "_blank", "noopener,noreferrer");
              }
            }}
          >
            외부 브라우저에서 이 페이지 열기
          </button>
        </div>
      )}

      {!isWebApp && (
        <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: "0.95rem" }}>
          아래 버튼으로 텔레그램에 로그인해 주세요. (공개 사용자명 필요)
        </p>
      )}
    </>
  );
}
