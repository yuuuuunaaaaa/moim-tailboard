import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mysql2"],
  // ESM 로드 시 __dirname 미정의 → cwd 사용 (빌드는 항상 프로젝트 루트에서 실행)
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
