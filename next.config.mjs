import path from "path";
import { fileURLToPath } from "url";

// 여러 package-lock.json(예: backend/, 상위 폴더)이 있으면 Next가 루트를 잘못 잡아 배포 시 404·트레이싱 오류가 날 수 있음.
const appRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // mysql2 같은 Node 네이티브 의존 패키지는 번들링하지 않고 서버에서 그대로 사용
  serverExternalPackages: ["mysql2"],

  outputFileTracingRoot: appRoot,

  compiler: {
    // 프로덕션 빌드에서 console.log 제거 (error/warn은 유지)
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  // optimizePackageImports는 transpile을 수반해 serverExternalPackages와 충돌한다.
  // mysql2는 네이티브 바인딩이 있어 serverExternalPackages 쪽이 우선.

  async headers() {
    // 정적 에셋 (/style.css 등)은 긴 캐시 + SWR 전략
    return [
      {
        source: "/style.css",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
