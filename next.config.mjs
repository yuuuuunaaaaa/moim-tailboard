/** @type {import("next").NextConfig} */
const nextConfig = {
  serverExternalPackages: ["mysql2"],
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
