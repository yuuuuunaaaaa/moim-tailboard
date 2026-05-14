/**
 * 로그인 후 돌아갈 상대 경로와 tenantSlug 복원에 사용.
 * open redirect 방지를 위해 반드시 동일 출처 상대 경로만 허용한다.
 */
const MAX_RETURN_PATH_LEN = 2048;

export function sanitizeInternalReturnPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.length > MAX_RETURN_PATH_LEN) return null;
  if (trimmed.includes("\\") || trimmed.includes("\n") || trimmed.includes("\r")) return null;
  try {
    const u = new URL(trimmed, "https://internal.invalid");
    if (!u.href.startsWith("https://internal.invalid/")) return null;
    return u.pathname + u.search;
  } catch {
    return null;
  }
}

/** `/t/{slug}/…` 또는 `?tenant=` / `?tenantSlug=` 에서 지역 slug 추출 */
export function extractTenantSlugFromReturnPath(pathWithSearch: string): string {
  const trimmed = pathWithSearch.trim();
  const q = trimmed.indexOf("?");
  const path = q >= 0 ? trimmed.slice(0, q) : trimmed;
  const search = q >= 0 ? trimmed.slice(q) : "";
  const m = path.match(/^\/t\/([^/]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  const qs = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(qs);
  return (
    params.get("tenant")?.trim() ||
    params.get("tenantSlug")?.trim() ||
    ""
  );
}

function returnPathTenantMatchesSlug(path: string, slug: string): boolean {
  const fromPath = extractTenantSlugFromReturnPath(path);
  if (!fromPath) return true;
  return fromPath === slug;
}

/** init-tenant 의 `next` 로 쓸 안전한 경로(테넌트와 불일치하면 이벤트 목록으로 폴백) */
export function pickPostLoginPath(
  tenantSlug: string,
  returnPath: string | null | undefined,
): string {
  const slug = tenantSlug.trim();
  if (!slug) return "/";
  const safe = returnPath ? sanitizeInternalReturnPath(returnPath) : null;
  if (safe !== null && returnPathTenantMatchesSlug(safe, slug)) return safe;
  return `/t/${encodeURIComponent(slug)}/events`;
}
