"use client";

import { useEffect, useState } from "react";

interface TelegramAuthProps {
  tenantSlug?: string;
  /** true: /login 페이지 — 텔레그램 위젯은 부모에서 삽입 */
  loginPage?: boolean;
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
            const slug = tenantSlug?.trim();
            if (slug) {
              const nextPath = `/t/${encodeURIComponent(slug)}/events`;
              window.location.href = `/api/init-tenant?slug=${encodeURIComponent(slug)}&next=${encodeURIComponent(nextPath)}`;
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
        <p className="login-webapp-status">로그인 중…</p>
      )}

      {isWebApp && status === "error" && (
        <div className="login-error-box">
          <p className="login-error-title">
            텔레그램에 <strong>공개 사용자명(username)</strong>이 없으면 자동 로그인이 되지 않습니다.
          </p>
          <p className="login-error-hint">
            아래 <strong>Log in with Telegram</strong> 버튼으로 로그인하거나, 설정 → 사용자명에서 공개
            사용자명을 만든 뒤 이 페이지를 새로고침해 주세요.
          </p>
        </div>
      )}

      {!isWebApp && (
        <p className="login-browser-hint">
          아래 버튼으로 텔레그램에 로그인해 주세요. (공개 사용자명 필요)
        </p>
      )}
      <style>{`
        .login-webapp-status {
          margin: 0 0 12px;
          color: #6b7280;
          font-size: 0.95rem;
        }
        .login-error-box {
          margin: 0 0 16px;
          text-align: left;
          padding: 14px 16px;
          background: #fef2f2;
          border-radius: 10px;
          border: 1px solid #fecaca;
        }
        .login-error-title {
          color: #b91c1c;
          margin: 0 0 10px;
          font-size: 0.95rem;
          line-height: 1.45;
        }
        .login-error-hint {
          color: #57534e;
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.5;
        }
        .login-browser-hint {
          margin: 0 0 16px;
          color: #6b7280;
          font-size: 0.95rem;
          line-height: 1.5;
        }
      `}</style>
    </>
  );
}
