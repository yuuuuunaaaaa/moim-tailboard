/**
 * 브라우저 /login 에서 텔레그램 미니 앱을 열 때 사용하는 t.me 링크.
 *
 * NEXT_PUBLIC_TELEGRAM_WEBAPP_OPEN_URL 은 **반드시** `https://t.me/...` (또는 telegram.me) 이어야 한다.
 * 자체 사이트 도메인을 넣으면 같은 /login 으로만 돌거나 무한 새로고침에 가까운 동작이 난다.
 *
 * 실제 미니 앱이 로드할 **웹 페이지 주소**(예: https://당신도메인/login)는 BotFather의 Mini App URL에 넣는다.
 *
 * @see https://core.telegram.org/bots/webapps#direct-link-mini-apps
 */
export type TelegramWebAppOpenConfig = {
  openUrl: string | null;
  /** OPEN_URL을 사이트 도메인으로 잘못 넣었을 때만 채워짐 */
  invalidOpenUrlHint?: string;
};

export function resolveTelegramWebAppOpenConfig(botName: string): TelegramWebAppOpenConfig {
  const full = process.env.NEXT_PUBLIC_TELEGRAM_WEBAPP_OPEN_URL?.trim();
  if (full) {
    try {
      const u = new URL(full);
      const host = u.hostname.toLowerCase();
      const isTelegramDeepLink =
        host === "t.me" || host === "telegram.me" || host === "www.telegram.me";
      if (!isTelegramDeepLink) {
        return {
          openUrl: null,
          invalidOpenUrlHint:
            "NEXT_PUBLIC_TELEGRAM_WEBAPP_OPEN_URL은 자체 도메인 주소가 아니라 https://t.me/봇사용자명/미니앱짧은이름 처럼 텔레그램 직접 링크만 넣어야 합니다. 지금 열리게 하려는 웹 주소(HTTPS)는 BotFather의 Mini App URL에 따로 등록합니다.",
        };
      }
      return { openUrl: full };
    } catch {
      return {
        openUrl: null,
        invalidOpenUrlHint: "NEXT_PUBLIC_TELEGRAM_WEBAPP_OPEN_URL이 올바른 URL 형식이 아닙니다.",
      };
    }
  }

  const short = process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_SHORT_NAME?.trim();
  const bot = botName.trim();
  if (short && bot) {
    return {
      openUrl: `https://t.me/${encodeURIComponent(bot)}/${encodeURIComponent(short)}`,
    };
  }
  return { openUrl: null };
}

/** @deprecated 호환용 — openUrl만 필요할 때 */
export function resolveTelegramWebAppOpenUrl(botName: string): string | null {
  return resolveTelegramWebAppOpenConfig(botName).openUrl;
}
