import { jwtVerify } from "jose/jwt/verify";

const ALG = "HS256" as const;

function getSecretKey(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

/**
 * JWT 검증 (HS256). Middleware 등 Edge에서도 사용 — `jose/jwt/verify`만 로드.
 */
export async function verifyToken(token: string): Promise<{ username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: [ALG] });
    const username = typeof payload.username === "string" ? payload.username.trim() : "";
    if (!username) return null;
    return { username };
  } catch {
    return null;
  }
}
