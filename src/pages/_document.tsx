import { Html, Head, Main, NextScript } from "next/document";

/**
 * App Router만 쓰는 프로젝트지만, Next가 내부 오류 UI를 Pages 경로로 렌더할 때
 * `.next/server/pages/_document.js`를 요구한다. 최소 Document를 두면 dev/빌드 산출물이 안정적으로 생긴다.
 */
export default function Document() {
  return (
    <Html lang="ko">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
