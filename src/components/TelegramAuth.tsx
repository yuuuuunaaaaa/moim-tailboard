"use client";

import { useEffect, useState } from "react";
import { pickPostLoginPath, sanitizeInternalReturnPath } from "@/lib/loginReturnPath";

interface TelegramAuthProps {
  tenantSlug?: string;
  /** 로그인 직후 복귀할 안전한 상대 경로(미들웨어가 넘긴 `next`) */
  postLoginNext?: string;
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
        initDataUnsafe?: { user?: Record<string, unknown>; start_param?: string };
        ready?: () => void;
        expand?: () => void;
        version?: string;
        platform?: string;
      };
    };
  }
}

/** 텔레그램 앱 내 WebView(미니 앱) — initData만으로 판별하면 빈 값일 때 t.me 무한 리다이렉트 발생 */
function isInsideTelegramClient(tg: Window["Telegram"] | undefined): boolean {
  const wa = tg?.WebApp;
  if (!wa) return false;
  if (String(wa.initData || "").length > 0) return true;
  const user = wa.initDataUnsafe?.user;
  if (user != null && typeof user === "object") return true;
  if (typeof navigator !== "undefined" && /\bTelegram\b/i.test(navigator.userAgent)) return true;
  return false;
}

function resolveEffectiveTenant(tenantSlug: string | undefined, tg: Window["Telegram"]): string {
  const fromUrl = tenantSlug?.trim() ?? "";
  const sp =
    typeof tg?.WebApp?.initDataUnsafe?.start_param === "string"
      ? tg.WebApp.initDataUnsafe.start_param.trim()
      : "";
  return fromUrl || sp;
}

const INIT_DATA_POLL_MS = 150;
const INIT_DATA_POLL_MAX = 45;

export default function TelegramAuth({
  tenantSlug,
  postLoginNext,
  loginPage = false,
  webAppOpenUrl,
  skipWebAppRedirect = false,
}: TelegramAuthProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [mounted, setMounted] = useState(false);
  const [browserStuck, setBrowserStuck] = useState(false);
  const [webViewNoInitData, setWebViewNoInitData] = useState(false);

  const insideTelegram = mounted && isInsideTelegramClient(window.Telegram);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const slugFromUrl = tenantSlug?.trim() ?? "";
    const buildLoginRedirectQs = (): string => {
      const p = new URLSearchParams();
      if (slugFromUrl) p.set("tenantSlug", slugFromUrl);
      if (postLoginNext) {
        const s = sanitizeInternalReturnPath(postLoginNext);
        if (s) p.set("next", s);
      }
      if (!loginPage && typeof window !== "undefined") {
        const cur = window.location.pathname + window.location.search;
        const safeCur = cur && cur !== "/login" ? sanitizeInternalReturnPath(cur) : null;
        if (safeCur) p.set("next", safeCur);
      }
      const qs = p.toString();
      return qs ? `?${qs}` : "";
    };
    const loginQs = buildLoginRedirectQs();

    const runLoginWithInitData = (initData: string) => {
      const effectiveTenant = resolveEffectiveTenant(tenantSlug, window.Telegram);
      setStatus("loading");
      window.Telegram?.WebApp?.ready?.();
      fetch("/api/auth/telegram-webapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ initData, tenantSlug: effectiveTenant }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (!data.success || typeof data.username !== "string") {
            setStatus("error");
            return;
          }
          const slug = effectiveTenant.trim();
          if (slug) {
            const nextPath = pickPostLoginPath(slug, postLoginNext);
            window.location.href = `/api/init-tenant?slug=${encodeURIComponent(slug)}&next=${encodeURIComponent(nextPath)}`;
            return;
          }
          window.location.href = "/";
        })
        .catch(() => {
          if (!cancelled) setStatus("error");
        });
    };

    const runEventPageWithInitData = (initData: string) => {
      const effectiveTenant = resolveEffectiveTenant(tenantSlug, window.Telegram);
      setStatus("loading");
      const tg = window.Telegram?.WebApp;
      tg?.ready?.();
      tg?.expand?.();
      fetch("/api/auth/telegram-webapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ initData, tenantSlug: effectiveTenant }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (!data.success || typeof data.username !== "string") {
            window.location.href = `/login${loginQs}`;
            return;
          }
          window.location.reload();
        })
        .catch(() => {
          if (!cancelled) window.location.href = `/login${loginQs}`;
        });
    };

    const tryConsumeInitData = (): boolean => {
      const id = String(window.Telegram?.WebApp?.initData || "");
      if (id.length === 0) return false;
      if (loginPage) runLoginWithInitData(id);
      else runEventPageWithInitData(id);
      return true;
    };

    if (tryConsumeInitData()) {
      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      };
    }

    if (isInsideTelegramClient(window.Telegram)) {
      let attempts = 0;
      const poll = () => {
        if (cancelled) return;
        if (tryConsumeInitData()) return;
        if (++attempts >= INIT_DATA_POLL_MAX) {
          if (!cancelled) setWebViewNoInitData(true);
          return;
        }
        timers.push(setTimeout(poll, INIT_DATA_POLL_MS));
      };
      poll();
      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      };
    }

    if (loginPage && webAppOpenUrl && !skipWebAppRedirect) {
      try {
        const u = new URL(webAppOpenUrl);
        if (slugFromUrl) u.searchParams.set("startapp", slugFromUrl);
        window.location.replace(u.toString());
      } catch {
        if (!cancelled) setBrowserStuck(true);
      }
      const t = setTimeout(() => {
        if (!cancelled) setBrowserStuck(true);
      }, 12000);
      timers.push(t);
      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      };
    }

    if (!loginPage) {
      window.location.href = `/login${loginQs}`;
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, loginPage, webAppOpenUrl, skipWebAppRedirect, tenantSlug, postLoginNext]);

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

  const showLoginProgress =
    insideTelegram && !webViewNoInitData && status !== "error";

  return (
    <>
      {showLoginProgress && (
        <p className="login-webapp-status">로그인 중…</p>
      )}

      {webViewNoInitData && (
        <div className="login-error-box">
          <p className="login-error-title">
            텔레그램 안에서 열렸지만 로그인 정보를 받지 못했습니다.
          </p>
        </div>
      )}

      {insideTelegram && status === "error" && (
        <div className="login-error-box">
          <p className="login-error-title">
            텔레그램에 <strong>공개 사용자명(username)</strong>이 없으면 자동 로그인이 되지 않습니다.
          </p>
        </div>
      )}

      {!insideTelegram && webAppOpenUrl && !skipWebAppRedirect && !browserStuck && (
        <p className="login-webapp-status">텔레그램으로 이동합니다…</p>
      )}

      {!insideTelegram && webAppOpenUrl && (skipWebAppRedirect || browserStuck) && (
        <div className="login-webapp-manual">
          <a className="login-webapp-open-btn" href={manualOpenUrl}>
            텔레그램에서 열기
          </a>
        </div>
      )}

      {!insideTelegram && !webAppOpenUrl && (
        <div className="login-error-box" style={{ textAlign: "left" }}>
          <p className="login-error-title">
            텔레그램에서 접근해주세요
          </p>
        </div>
      )}
    </>
  );
}
