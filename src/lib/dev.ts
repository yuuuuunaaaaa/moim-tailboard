export function isDevBypassEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.ALLOW_LOCAL_WITHOUT_AUTH === "1";
}

export function getDevDefaultUsername(): string | null {
  const u = process.env.DEV_DEFAULT_USERNAME;
  return u && u.trim() ? u.trim() : null;
}

export function getDevDefaultTenantSlug(): string | null {
  const s = process.env.DEV_DEFAULT_TENANT_SLUG;
  return s && s.trim() ? s.trim() : null;
}

