import { cache } from "react";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { pool } from "./db";
import { verifyToken } from "./jwt-verify";
import type { Admin } from "@/types";
import { getDevDefaultUsername, isDevBypassEnabled } from "@/lib/dev";

/** 0이면 캐시 비활성(개발 시 DB 변경 즉시 반영). 미설정 시 300초. */
function adminCacheRevalidateSeconds(): number {
  const raw = process.env.ADMIN_CACHE_REVALIDATE_SECONDS;
  if (raw === undefined || raw === "") return 300;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 300;
}

/**
 * Route Handler에서 쿠키의 JWT를 검증해 username을 얻습니다.
 * 로그인 API가 DB를 쓰지 않으므로, 이후 API에서 username으로 DB 작업을 수행합니다.
 *
 * @returns 검증 실패 시 null
 */
export async function getUserFromRequest(
  request: NextRequest,
): Promise<{ username: string } | null> {
  const token = request.cookies.get("auth_token")?.value;
  if (token) return verifyToken(token);
  if (isDevBypassEnabled()) {
    const u = getDevDefaultUsername();
    if (u) return { username: u };
  }
  return null;
}

/** Server Component / Server Action: 쿠키에서 JWT 검증 */
export async function getAuthUser(): Promise<{ username: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (token) return verifyToken(token);
  if (isDevBypassEnabled()) {
    const u = getDevDefaultUsername();
    if (u) return { username: u };
  }
  return null;
}

const ADMIN_SELECT_WITH_SUPER =
  "SELECT id, telegram_id, username, tenant_id, name, is_superadmin FROM admin WHERE username = ? LIMIT 1";
const ADMIN_SELECT_BASE =
  "SELECT id, telegram_id, username, tenant_id, name FROM admin WHERE username = ? LIMIT 1";

/**
 * MySQL BIT(1) 등은 mysql2가 Buffer로 돌려줄 수 있음. Buffer는 바이트가 0이어도 객체로 truthy라
 * `!!row.is_superadmin`만 쓰면 비-superadmin도 전원 superadmin처럼 동작할 수 있다.
 */
function normalizeIsSuperadmin(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return value.length > 0 && value[0] === 1;
  }
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "1" || s === "true";
  }
  return false;
}

/** username으로 관리자 행 조회 (서비스 로직 전용; 로그인 시에는 호출하지 않음) */
export async function loadAdminByUsername(username: string): Promise<Admin | null> {
  const u = username.trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRow = (row: any): Admin => ({
    ...row,
    is_superadmin: normalizeIsSuperadmin(row?.is_superadmin),
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [rows] = await pool.query<any[]>(ADMIN_SELECT_WITH_SUPER, [u]);
    const row = rows[0] as Admin | undefined;
    if (!row) return null;
    return mapRow(row);
  } catch (err: unknown) {
    const e = err as { code?: string; errno?: number };
    // MySQL: ER_BAD_FIELD_ERROR — 기존 DB에 is_superadmin 컬럼이 없을 때
    if (e?.code === "ER_BAD_FIELD_ERROR" || e?.errno === 1054) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [rows] = await pool.query<any[]>(ADMIN_SELECT_BASE, [u]);
      const row = rows[0] as Admin | undefined;
      if (!row) return null;
      return { ...row, is_superadmin: false };
    }
    throw err;
  }
}

/**
 * 관리자 행 조회 + Full Route Cache(데이터 캐시).
 * 동일 username은 TTL 동안 DB를 다시 보지 않음(요청 간·서버리스 인스턴스 재사용 시 유효).
 */
export const loadAdminByUsernameCached = cache(async (username: string): Promise<Admin | null> => {
  const u = username.trim();
  if (!u) return null;
  const ttl = adminCacheRevalidateSeconds();
  if (ttl === 0) return loadAdminByUsername(u);
  return unstable_cache(
    async () => loadAdminByUsername(u),
    ["loadAdminByUsername", u],
    { revalidate: ttl },
  )();
});

export const getPageContext = cache(async () => {
  const authUser = await getAuthUser();
  const effectiveUsername = authUser?.username ?? null;
  const admin = effectiveUsername ? await loadAdminByUsernameCached(effectiveUsername) : null;
  const isAdmin = !!admin;
  const canChooseTenant = isAdmin && !!admin?.is_superadmin;

  return {
    authUser,
    admin,
    username: effectiveUsername,
    isAdmin,
    canChooseTenant,
  };
});
