const COOKIE_NAME = "allowed_tenant_slug";
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60 * 1000;

/**
 * 테넌트 접근 허용 여부.
 * 1) superadmin → 모든 테넌트 허용
 * 2) admin(소속 테넌트만) → req.admin.tenant_id와 일치할 때만 허용
 * 3) 비관리자 → 최초 접속한 공동체(쿠키)만 허용
 *
 * @param {object} req
 * @param {object} res
 * @param {{ id: number, slug: string }} tenant - 현재 요청의 테넌트 (id, slug 필요)
 * @returns {boolean} - true면 다음 처리 진행, false면 이미 응답 보냄
 */
function ensureTenantAllowed(req, res, tenant) {
  const tenantSlug = tenant.slug;

  if (req.admin) {
    if (req.admin.is_superadmin) return true;
    if (req.admin.tenant_id === tenant.id) return true;
    res.status(403).send("소속 공동체만 접근할 수 있습니다.");
    return false;
  }

  const allowed = req.cookies && req.cookies[COOKIE_NAME];

  if (allowed && allowed !== tenantSlug) {
    res.status(403).send("다른 공동체에는 접근할 수 없습니다.");
    return false;
  }

  if (!allowed) {
    res.cookie(COOKIE_NAME, tenantSlug, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
    });
  }

  return true;
}

module.exports = { ensureTenantAllowed };
