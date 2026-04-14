"use client";

import { useEffect, useState } from "react";

interface TelegramAuthProps {
  tenantSlug?: string;
  /** true: /login 페이지 — 텔레그램 위젯은 부모에서 삽입 */
  loginPage?: boolean;
  /** 설정 시 일반 브라우저에서 /login 접속 → t.me 미니 앱으로 이동 */
  webAppOpenUrl?: string | null;
  /** true면 자동 t.me 이동 안 함(수동 링크만) */
  skipWebAppRedirect?: boolean;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: { start_param?: string };
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

function resolveEffectiveTenant(tenantSlug: string | undefined, tg: Window["Telegram"]): string {
  const fromUrl = tenantSlug?.trim() ?? "";
  const sp =
    typeof tg?.WebApp?.initDataUnsafe?.start_param === "string"
      ? tg.WebApp.initDataUnsafe.start_param.trim()
      : "";
  return fromUrl || sp;
}

export default function TelegramAuth({
  tenantSlug,
  loginPage = false,
  webAppOpenUrl,
  skipWebAppRedirect = false,
}: TelegramAuthProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [mounted, setMounted] = useState(false);
  const [browserStuck, setBrowserStuck] = useState(false);

  const inTelegramWebApp =
    mounted &&
    typeof window !== "undefined" &&
    Boolean(window.Telegram?.WebApp?.initData);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const tg = window.Telegram?.WebApp;
    const slugFromUrl = tenantSlug?.trim() ?? "";
    const loginQs = slugFromUrl ? `?tenantSlug=${encodeURIComponent(slugFromUrl)}` : "";
    const effectiveTenant = resolveEffectiveTenant(tenantSlug, window.Telegram);

    if (tg?.initData) {
      if (loginPage) {
        setStatus("loading");
        tg.ready?.();
        fetch("/api/auth/telegram-webapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ initData: tg.initData, tenantSlug: effectiveTenant }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (!data.success || typeof data.username !== "string") {
              setStatus("error");
              return;
            }
            const slug = effectiveTenant.trim();
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
          body: JSON.stringify({ initData: tg.initData, tenantSlug: effectiveTenant }),
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
      return;
    }

    if (loginPage && webAppOpenUrl && !skipWebAppRedirect) {
      try {
        const u = new URL(webAppOpenUrl);
        if (slugFromUrl) u.searchParams.set("startapp", slugFromUrl);
        window.location.replace(u.toString());
      } catch {
        setBrowserStuck(true);
      }
      const t = window.setTimeout(() => setBrowserStuck(true), 12000);
      return () => window.clearTimeout(t);
    }

    if (!loginPage) {
      window.location.href = `/login${loginQs}`;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, loginPage, webAppOpenUrl, skipWebAppRedirect, tenantSlug]);

  if (!loginPage) return null;

  if (!mounted) {
    return (
      <p className="login-webapp-status" style={{ margin: "0 0 12px", color: "#6b7280" }}>
        연결 확인 중…
      </p>
    );
  }

  let manualOpenUrl = webAppOpenUrl ?? "";
  try {
    if (webAppOpenUrl) {
      const u = new URL(webAppOpenUrl);
      const slug = tenantSlug?.trim() ?? "";
      if (slug) u.searchParams.set("startapp", slug);
      manualOpenUrl = u.toString();
    }
  } catch {
    /* keep */
  }

  return (
    <>
      {inTelegramWebApp && status !== "error" && (
        <p className="login-webapp-status">로그인 중…</p>
      )}

      {inTelegramWebApp && status === "error" && (
        <div className="login-error-box">
          <p className="login-error-title">
            텔레그램에 <strong>공개 사용자명(username)</strong>이 없으면 자동 로그인이 되지 않습니다.
          </p>
          <p className="login-error-hint">
            텔레그램 설정 → 사용자명에서 공개 사용자명을 만든 뒤, 봇 메뉴에서 미니 앱을 다시 열어 주세요.
          </p>
        </div>
      )}

      {!inTelegramWebApp && webAppOpenUrl && !skipWebAppRedirect && !browserStuck && (
        <p className="login-webapp-status">텔레그램 미니 앱으로 이동합니다…</p>
      )}

      {!inTelegramWebApp && webAppOpenUrl && (skipWebAppRedirect || browserStuck) && (
        <div className="login-webapp-manual">
          <p className="login-webapp-manual-lead">
            로그인은 <strong>텔레그램 미니 앱</strong>에서 진행됩니다. 아래 버튼으로 텔레그램을 여세요.
          </p>
          <a className="login-webapp-open-btn" href={manualOpenUrl}>
            텔레그램에서 열기
          </a>
        </div>
      )}

      {!inTelegramWebApp && !webAppOpenUrl && (
        <div className="login-error-box" style={{ textAlign: "left" }}>
          <p className="login-error-title" style={{ marginBottom: 8 }}>
            미니 앱 주소가 설정되어 있지 않습니다.
          </p>
          <p className="login-error-hint" style={{ margin: 0 }}>
            배포 환경에 <code>NEXT_PUBLIC_TELEGRAM_WEBAPP_OPEN_URL</code> 또는{" "}
            <code>NEXT_PUBLIC_TELEGRAM_MINI_APP_SHORT_NAME</code>을 설정해 주세요.
          </p>
        </div>
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
        .login-webapp-manual {
          width: 100%;
          margin: 0 0 20px;
        }
        .login-webapp-manual-lead {
          margin: 0 0 14px;
          text-align: left;
          font-size: 0.95rem;
          line-height: 1.55;
          color: #4b5563;
        }
        .login-webapp-open-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 48px;
          padding: 12px 16px;
          box-sizing: border-box;
          background: #2481cc;
          color: #fff !important;
          font-weight: 600;
          font-size: 1rem;
          border-radius: 10px;
          text-decoration: none;
        }
        .login-webapp-open-btn:active {
          opacity: 0.92;
        }
      `}</style>
    </>
  );
}
