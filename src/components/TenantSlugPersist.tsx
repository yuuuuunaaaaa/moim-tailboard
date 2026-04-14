"use client";

import { useEffect } from "react";

/** localStorage 키: 딥링크·관리 URL에 tenant 쿼리가 없을 때 클라이언트가 힌트로 쓸 수 있음(서버 권한은 DB·쿠키로 검증). */
export const MOIM_TENANT_SLUG_STORAGE_KEY = "moim_tenant_slug";

export default function TenantSlugPersist({ slug }: { slug: string }) {
  useEffect(() => {
    const s = slug.trim();
    if (!s) return;
    try {
      localStorage.setItem(MOIM_TENANT_SLUG_STORAGE_KEY, s);
    } catch {
      /* ignore */
    }
  }, [slug]);
  return null;
}
