import { jwtVerify } from "jose";
import type { JwtPayload } from "@/types";

function secretKey(): Uint8Array | null {
  const s = process.env.JWT_SECRET?.trim();
  if (!s) return null;
  return new TextEncoder().encode(s);
}

/**
 * Edge 미들웨어용 JWT 검증 (HS256).
 * Route Handler 등 Node 런타임은 `@/lib/jwt`의 동기 `verifyToken` 사용.
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  const key = secretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    const username = payload.username;
    if (typeof username !== "string" || !username.trim()) return null;
    return {
      username: username.trim(),
      via_webapp: payload.via_webapp === true,
      is_admin: payload.is_admin === true,
      iat: typeof payload.iat === "number" ? payload.iat : undefined,
      exp: typeof payload.exp === "number" ? payload.exp : undefined,
    };
  } catch {
    return null;
  }
}
