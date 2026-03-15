const COOKIE_NAME = "allowed_tenant_slug";
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60 * 1000;

/**
 * 비관리자는 최초 접속한 공동체(tenantSlug)만 사용 가능.
 * 다른 공동체 URL로 접근하면 403.
 * 관리자는 제한 없음.
 *
 * @param {object} req
 * @param {object} res
 * @param {string} tenantSlug - 현재 요청의 공동체 slug
 * @returns {boolean} - true면 다음 처리 진행, false면 이미 응답 보냄
 */
function ensureTenantAllowed(req, res, tenantSlug) {
  if (req.admin) return true;

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
