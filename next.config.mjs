import path from "path";
import { fileURLToPath } from "url";

// 여러 package-lock.json(예: backend/, 상위 폴더)이 있으면 Next가 루트를 잘못 잡아 배포 시 404·트레이싱 오류가 날 수 있음.
const appRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  serverExternalPackages: ["mysql2"],
  outputFileTracingRoot: appRoot,
};

export default nextConfig;
