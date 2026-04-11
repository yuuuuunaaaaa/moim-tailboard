import { SignJWT } from "jose/jwt/sign";

export { verifyToken } from "./jwt-verify";

const ALG = "HS256" as const;

function getSecretKey(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

/** httpOnly 쿠키 maxAge(초) — JWT 만료와 맞춤 */
export const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

/**
 * JWT 발급. payload는 { username } 만 포함. 만료 7일.
 */
export async function signToken(username: string): Promise<string> {
  const u = username.trim();
  if (!u) throw new Error("username is required for signToken");
  return new SignJWT({ username: u })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}
