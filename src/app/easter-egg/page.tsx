import type { Metadata } from "next";
import { cookies } from "next/headers";
import Header from "@/components/Header";
import { TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
import { getPageContext } from "@/lib/auth";

export const metadata: Metadata = {
  title: "🕹 비밀의 방",
  robots: { index: false, follow: false },
};

/**
 * 이스터에그: 인천 청대 짱!
 * 공통 헤더·뒤로가기 등 사이트 전체 CSS는 유지하고,
 * 본문 영역에만 레트로 CRT 연출(네온 텍스트 + 스캔라인 + 깜빡임 + 가로 전광판)을 넣는다.
 */
export default async function EasterEggPage() {
  const [ctx, cookieStore] = await Promise.all([getPageContext(), cookies()]);
  const tenantSlug = cookieStore.get(TENANT_COOKIE_NAME)?.value ?? undefined;
  const backHref = tenantSlug ? `/t/${tenantSlug}/events` : "/";

  return (
    <>
      <Header
        username={ctx.username}
        isAdmin={ctx.isAdmin}
        canChooseTenant={ctx.canChooseTenant}
        tenantSlug={tenantSlug}
      />
      <main className="container">
        <a href={backHref} className="back-link">← 돌아가기</a>

        <div className="egg-stage">
          <div className="egg-starfield" aria-hidden="true" />
          <div className="egg-scanlines" aria-hidden="true" />

          <div className="egg-crt">
            <div className="egg-sub egg-sub--top">★ SECRET LEVEL UNLOCKED ★</div>

            <div className="egg-poster">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/easter-egg/chungdae.jpg"
                alt="2026 인천 청년 대학생"
                width={640}
                height={640}
                decoding="async"
                loading="eager"
              />
            </div>

            <h1 className="egg-title egg-title--small">
              <span className="egg-glow egg-glow--pink">인천</span>
              <span className="egg-glow">청대</span>
              <span className="egg-glow egg-glow--yellow">짱!</span>
            </h1>

            <div className="egg-marquee" aria-hidden="true">
              <div className="egg-marquee-track">
                <span>♥ 인천 청대 짱 ♥ INCHEON FOREVER ♥ 2026 ♥</span>
                <span>♥ 인천 청대 짱 ♥ INCHEON FOREVER ♥ 2026 ♥</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
