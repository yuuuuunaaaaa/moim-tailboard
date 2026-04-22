import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import VercelSpeedInsights from "@/components/VercelSpeedInsights";

export const metadata: Metadata = {
  title: "꼬리달기",
  description: "꼬리달러 가보자고",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8f6f3",
};

const PRETENDARD_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css";

/**
 * Pretendard CSS는 렌더-블로킹이 되지 않도록 동적으로 삽입한다.
 * - `preconnect` + `preload`로 빠르게 시작
 * - 실제 stylesheet 태그는 CSR 이후 주입(또는 `<noscript>` 폴백)
 * 그동안 시스템 폰트(Apple SD Gothic Neo, system-ui)가 사용된다.
 */
const LOAD_PRETENDARD = `
(function(){
  var l=document.createElement('link');
  l.rel='stylesheet';
  l.href=${JSON.stringify(PRETENDARD_CSS)};
  l.media='all';
  document.head.appendChild(l);
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="preload" href={PRETENDARD_CSS} as="style" />
        <link rel="stylesheet" href="/style.css" />
        <noscript>
          <link rel="stylesheet" href={PRETENDARD_CSS} />
        </noscript>
      </head>
      <body>
        {children}
        <script
          async
          // 최초 페인트 이후 비동기로 Pretendard CSS를 붙여 TTFB·FCP 영향을 최소화
          dangerouslySetInnerHTML={{ __html: LOAD_PRETENDARD }}
        />
        <VercelSpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
