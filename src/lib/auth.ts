import { cookies } from "next/headers";
import { pool } from "./db";
import { verifyToken } from "./jwt";
import type { Admin, JwtPayload } from "@/types";

export async function getAuthUser(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function loadAdminByUsername(username: string): Promise<Admin | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows] = await pool.query<any[]>(
    "SELECT id, telegram_id, username, tenant_id, name, is_superadmin FROM admin WHERE username = ? LIMIT 1",
    [username.trim()],
  );
  const row = rows[0] as Admin | undefined;
  if (!row) return null;
  return { ...row, is_superadmin: !!row.is_superadmin };
}

export async function getPageContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  const usernameCookie = cookieStore.get("username")?.value?.trim() || null;

  let authUser: JwtPayload | null = null;
  if (token) authUser = verifyToken(token);

  const effectiveUsername = authUser?.username ?? usernameCookie ?? null;
  const admin = effectiveUsername ? await loadAdminByUsername(effectiveUsername) : null;

  const isAdmin = !!admin;
  const canChooseTenant = isAdmin && !!admin?.is_superadmin;

  return {
    authUser,
    admin,
    username: effectiveUsername,
    isAdmin,
    canChooseTenant,
  };
}
