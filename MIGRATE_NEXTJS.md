# Next.js 마이그레이션 체크리스트

현재 스택: **Express.js + EJS + MySQL2**  
목표 스택: **Next.js (App Router) + React + MySQL2**

> **읽기 전에:** 각 Phase는 순서대로 진행합니다. Phase 0의 결정 사항에 따라 세부 구현 방식이 달라질 수 있습니다.

---

## Phase 0. 사전 결정 사항

- [ ] **(권장: 완전 교체 기본값)** 아래 결정으로 고정하고 진행 (이 프로젝트처럼 “한 번 만들고 이후엔 버그 수정 위주”일 때 추천)
  - **Router**: App Router
  - **API/폼 처리**: Route Handler 중심 (기존 Express 라우트 1:1 매핑), 폼은 `POST /api/...` 또는 `fetch`로 호출
  - **DB**: `mysql2` 유지 (ORM 도입 없음)
  - **CSS**: 기존 `style.css` 그대로 유지 (UI 재작성 최소화)
  - **TypeScript**: 사용
  - **배포**: Vercel + **Vercel 도메인 고정** + `NEXT_PUBLIC_APP_URL`도 해당 도메인으로 고정
  - **목표**: 마이그레이션 리스크/운영 복잡도 최소화

- [ ] **폼 처리 방식**: Server Actions vs Route Handler + `fetch`
  - Server Actions: 코드가 간결하고 Next.js 표준. 단, Telegram WebApp 환경(클라이언트 JS 위주)에서 호환성 확인 필요
  - Route Handler: 기존 Express 라우트와 1:1 대응. 초기 이전에 더 안전
- [ ] **CSS 전략**: 기존 `style.css` 유지
- [ ] **DB 클라이언트**: mysql2 그대로 유지
- [ ] **TypeScript 사용**
- [ ] **배포 플랫폼**: Vercel(권장) 
- [ ] **런타임 제약 확인**: Vercel Serverless/Node runtime에서 `mysql2` 커넥션 풀 전략(예: 낮은 connectionLimit, 재사용) 결정
- [ ] **도메인/HTTPS**: **Vercel 도메인으로 고정** (Telegram 로그인/웹앱 URL에 동일 도메인 사용)
  - 권장: 커스텀 도메인 없이 Vercel 도메인(`*.vercel.app`)을 최종 도메인으로 확정한 뒤 BotFather 설정에 반영
  - 주의: `*.vercel.app` 도메인이 바뀌면 Telegram 설정도 같이 바꿔야 하므로, 프로젝트/팀 이동 전에 도메인부터 확정

---

## Phase 1. 프로젝트 초기화

- [ ] 루트에 Next.js 앱 생성
  ```bash
  npx create-next-app@latest . --typescript --app --src-dir --no-tailwind
  ```
- [ ] 기존 `backend/` 폴더를 유지하면서 병행 개발하거나, 새 Next.js 앱으로 완전 교체 결정 -> 새 next.js로 완전 교체
- [ ] `package.json` 의존성 정리
  - **유지**: `mysql2`, `jsonwebtoken`, `crypto`(Node 내장)
  - **제거**: `express`, `ejs`, `express-async-errors`, `morgan`, `cookie-parser`, `nodemon`
  - **추가**: `next`, `react`, `react-dom`, `@types/jsonwebtoken`(TS 사용 시)
- [ ] 환경변수 파일 정리
  - `backend/.env` → `.env.local` (Next.js 규칙)
  - 브라우저에 노출할 변수만 `NEXT_PUBLIC_` prefix 붙이기
    - `NEXT_PUBLIC_APP_URL` (클라이언트 JS에서 사용)
    - `NEXT_PUBLIC_TELEGRAM_BOT_NAME` (로그인 위젯에서 사용)
  - 서버 전용 유지: `DB_*`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`
- [ ] (선택) Railway를 계속 쓸 경우 `railway.toml` 빌드/시작 명령 업데이트
  ```toml
  [build]
  buildCommand = "npm run build"   # next build
  [deploy]
  startCommand = "npm run start"   # next start
  ```
- [ ] `public/` 에 `style.css` 복사 (`backend/src/public/style.css` → `public/style.css`)

---

## Phase 2. 공통 유틸·라이브러리 이전

기존 `backend/src/` 하위 유틸을 `src/lib/`으로 이전합니다.

- [ ] **DB 연결** `backend/src/db/mysql.js` → `src/lib/db.ts`
  - mysql2 pool 싱글턴 그대로 유지
  - `getTenantOr404` → Next.js에서는 `res` 객체가 없으므로 `null` 반환 헬퍼로 변경
    ```ts
    // 변경 전: getTenantOr404(slug, res)
    // 변경 후: findTenantBySlug(slug): Promise<Tenant | null>
    ```
- [ ] **Telegram WebApp 검증** `backend/src/auth/verifyTelegramWebApp.js` → `src/lib/verifyTelegramWebApp.ts`
- [ ] **Telegram Login Widget 검증** `backend/src/auth/verifyTelegramLogin.js` → `src/lib/verifyTelegramLogin.ts`
- [ ] **Telegram 봇 메시지 전송** `backend/src/lib/telegram.js` → `src/lib/telegram.ts`
- [ ] **JWT 유틸** `src/lib/jwt.ts` 신규 작성
  ```ts
  // signToken(payload), verifyToken(token)
  // Next.js cookies() API와 연동
  ```
- [ ] **인증 헬퍼** `src/lib/auth.ts` 신규 작성
  ```ts
  // 서버 컴포넌트·Route Handler에서 공통으로 쓰는:
  // getAuthUser(): { username: string } | null
  // getAdmin(): AdminRow | null
  ```
- [ ] **테넌트 접근 제한** `backend/src/middleware/tenantRestrict.js` → `src/lib/tenantRestrict.ts`
  - `allowed_tenant_slug` 쿠키 로직을 Next.js `cookies()` API 기반으로 재작성

---

## Phase 3. Next.js Middleware 이전

`backend/src/server.js`의 `requireTelegramAuth`와 `backend/src/middleware/auth.js`를 `src/middleware.ts`로 이전합니다.

- [ ] `src/middleware.ts` 작성
  - JWT 쿠키(`auth_token`) 검증
  - **비인증 접근 차단**: Telegram WebApp 또는 로그인한 쿠키가 없으면 `/login` 리다이렉트
  - **관리자 전용 경로 보호**: `/admin/*` 경로는 admin이 아니면 403
  - **예외 경로**: `/login`, `/api/auth/*`, `/health`, `/_next/*`, `/public/*`
  - `config.matcher` 설정으로 정적 파일 제외
  ```ts
  export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|style.css).*)'],
  }
  ```
- [ ] **주의**: Next.js Middleware는 Edge Runtime에서 실행 → mysql2 직접 사용 불가
  - DB 조회가 필요한 admin 권한 체크는 Middleware에서 제외하고 Route Handler / 서버 컴포넌트에서 처리

---

## Phase 4. API Route Handlers 이전

Express `POST` 라우트 → `app/api/.../route.ts`

### 4-1. 인증 (`backend/src/routes/auth.js`)

- [ ] `POST /auth/telegram-webapp` → `app/api/auth/telegram-webapp/route.ts`
- [ ] `POST /auth/telegram` → `app/api/auth/telegram/route.ts`
- [ ] `GET /auth/telegram` (Login Widget 리다이렉트 콜백) → 동일 파일에 `GET` handler 추가
  - 응답: JWT를 `Set-Cookie`로 세팅 후 `/` 리다이렉트 (`NextResponse.redirect`)
  - **주의**: `tenantSlug` 쿼리 파라미터는 Telegram 서명에서 제외하고 검증할 것

### 4-2. 참여자 (`backend/src/routes/participants.js`)

- [ ] `POST /participants` (참여 신청) → `app/api/participants/route.ts`
- [ ] `POST /participants/update` (수정/취소) → `app/api/participants/update/route.ts`

### 4-3. 관리자 이벤트 (`backend/src/routes/admin.js`)

- [ ] `POST /admin/events` (이벤트 생성) → `app/api/admin/events/route.ts`
- [ ] `POST /admin/events/:eventId/update` → `app/api/admin/events/[eventId]/update/route.ts`
- [ ] `POST /admin/events/:eventId/delete` → `app/api/admin/events/[eventId]/delete/route.ts`
- [ ] `POST /admin/events/:eventId/toggle` → `app/api/admin/events/[eventId]/toggle/route.ts`
- [ ] `POST /admin/option-groups/:groupId/delete` → `app/api/admin/option-groups/[groupId]/delete/route.ts`
- [ ] `POST /admin/options` (옵션 그룹 추가) → `app/api/admin/options/route.ts`

### 4-4. 관리자 테넌트 (`backend/src/routes/admin.js`)

- [ ] `POST /admin/tenants/:tenantSlug/admins` (관리자 추가) → `app/api/admin/tenants/[tenantSlug]/admins/route.ts`
- [ ] `POST /admin/tenants/:tenantSlug/admins/:adminId/delete` → `app/api/admin/tenants/[tenantSlug]/admins/[adminId]/delete/route.ts`

### 4-5. 기타

- [ ] `GET /health` → `app/api/health/route.ts`
- [ ] 모든 Route Handler에서 응답 전 **관리자 권한 재검증** (Middleware 미통과 시 대비)

---

## Phase 5. 페이지 컴포넌트 이전 (EJS → React 서버 컴포넌트)

| 기존 EJS | Next.js 경로 | 렌더링 |
|----------|-------------|--------|
| `home.ejs` | `app/page.tsx` | SSR |
| `login.ejs` | `app/login/page.tsx` | SSR + Client |
| `event-list.ejs` | `app/t/[tenantSlug]/events/page.tsx` | SSR |
| `event-detail.ejs` | `app/t/[tenantSlug]/events/[eventId]/page.tsx` | SSR + Client |
| `admin.ejs` | `app/admin/page.tsx` | SSR + Client |
| `admin-tenant.ejs` | `app/admin/tenants/[tenantSlug]/page.tsx` | SSR |

- [ ] **공통 레이아웃** `app/layout.tsx` 작성
  - `<html lang="ko">`, 공통 `<head>` (style.css, pretendard 폰트)
  - 공통 헤더 컴포넌트 `src/components/Header.tsx`
- [ ] **홈** `app/page.tsx`
  - 서버에서 tenant 목록 fetch 후 렌더링
- [ ] **로그인** `app/login/page.tsx`
  - Telegram WebApp 자동 로그인: `'use client'` 컴포넌트로 분리
  - Login Widget(PC): `<Script>` 컴포넌트로 `telegram-widget.js` 로드
- [ ] **이벤트 목록** `app/t/[tenantSlug]/events/page.tsx`
  - 서버 컴포넌트에서 DB 직접 조회
  - `allowed_tenant_slug` 쿠키 검사 (`tenantRestrict` 로직 통합)
- [ ] **이벤트 상세** `app/t/[tenantSlug]/events/[eventId]/page.tsx`
  - 참여 신청 폼: Client 컴포넌트로 분리 (Telegram WebApp 자동 로그인 포함)
  - 참여자 목록 (옵션별/전체 토글): `'use client'` 컴포넌트
  - 수정/삭제 폼
- [ ] **관리자 메인** `app/admin/page.tsx`
  - 이벤트 목록 + 수정 폼: Client 컴포넌트로 분리
  - 옵션 그룹 토글 UI
- [ ] **관리자 테넌트 설정** `app/admin/tenants/[tenantSlug]/page.tsx`
- [ ] **리다이렉트** `app/t/[tenantSlug]/page.tsx` → `/t/[tenantSlug]/events` 로 redirect

---

## Phase 6. 클라이언트 JS 로직 이전

기존 EJS 인라인 `<script>`를 React 컴포넌트로 분리합니다.

- [ ] **Telegram WebApp 자동 로그인** (`event-detail.ejs`, `login.ejs` 인라인 JS)
  - `src/components/TelegramAuth.tsx` (`'use client'`)
  - `useEffect`에서 `window.Telegram.WebApp.initData` 감지 → `/api/auth/telegram-webapp` 호출
- [ ] **참여 신청 폼** (`event-detail.ejs`)
  - `src/components/ParticipantForm.tsx` (`'use client'`)
  - 제출 후 `router.refresh()` 또는 revalidate
- [ ] **참여자 수정/삭제 폼** 인라인 토글 UI → `src/components/ParticipantEditForm.tsx`
- [ ] **옵션별/전체 참여자 보기 토글** → `src/components/ParticipantList.tsx`
- [ ] **관리자 이벤트 수정 폼** 토글 + 옵션 그룹 동적 추가 UI → `src/components/AdminEventEdit.tsx`

---

## Phase 7. 쿠키·세션 처리 통합

- [ ] 로그인 성공 시 `Set-Cookie` 방식 통일
  - `auth_token` (JWT, httpOnly)
  - `username` (표시용)
  - `allowed_tenant_slug` (테넌트 접근 제한용)
- [ ] 로그아웃 엔드포인트 (`/api/auth/logout`) 추가 — 쿠키 삭제
- [ ] 쿠키 설정 옵션 확인: `sameSite`, `secure` (HTTPS 환경), `httpOnly`

---

## Phase 8. 검증·테스트

- [ ] 각 페이지 SSR 렌더링 확인 (로그인 전/후)
- [ ] Telegram WebApp 환경(모바일)에서 자동 로그인 동작 확인
- [ ] Telegram Login Widget(PC)에서 관리자 로그인 동작 확인
- [ ] 참여 신청 → 참여자 목록 업데이트 확인
- [ ] 관리자 이벤트 생성/수정/삭제 확인
- [ ] 옵션 그룹 생성/삭제 확인
- [ ] 테넌트 접근 제한 (`allowed_tenant_slug`) 동작 확인
- [ ] `action_log` 로그인 로그 기록 확인

---

## Phase 9. 배포

- [ ] **Vercel 프로젝트 생성** (Git 연결)
  - Framework preset: Next.js
  - Build command: `next build` (기본값)
  - Output: `.next` (기본값)
- [ ] **환경변수 Vercel에 등록** (Project Settings → Environment Variables)
  - Server-only: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL_CA_CONTENT`(필요 시), `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`
  - Client-exposed: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_TELEGRAM_BOT_NAME`
  - `APP_URL`를 쓰던 코드는 Vercel에서는 보통 `NEXT_PUBLIC_APP_URL`(클라이언트) + 서버는 `process.env.VERCEL_URL`/`NEXT_PUBLIC_APP_URL`로 통일 고려
- [ ] **Telegram 설정 업데이트**
  - BotFather / Login Widget에서 허용 도메인/redirect URL이 있다면 Vercel 도메인으로 갱신
  - WebApp(미니앱) URL도 Vercel 도메인으로 갱신
  - `NEXT_PUBLIC_APP_URL`을 **정확히 Vercel 도메인**(예: `https://my-app.vercel.app`)으로 설정
- [ ] **DB 연결 안정화**
  - Vercel은 요청별 인스턴스가 늘 수 있으므로 `mysql2` pool 설정 재검토
  - 필요 시 연결 수 제한/타임아웃/keepalive 조정
- [ ] `next.config.ts` 설정 (필요 시)
  - 이미지 도메인 설정
  - (Vercel 기본 배포는 `output: 'standalone'` 불필요)
- [ ] **관측/로그 확인**
  - Vercel Logs에서 인증/옵션/참여 플로우 에러가 없는지 확인
- [ ] (선택) **Railway/Docker 배포를 유지할 경우**
  - `railway.toml` / Dockerfile(standalone) 유지 및 동기화
- [ ] **전환 계획**
  - 기존 Express 서버와 병행 운영 기간 결정 후, DNS/도메인 최종 전환

---

## 참고: 파일 경로 대응표

| 기존 (Express) | 이후 (Next.js) |
|----------------|---------------|
| `backend/src/server.js` | `src/middleware.ts` + `src/app/layout.tsx` |
| `backend/src/db/mysql.js` | `src/lib/db.ts` |
| `backend/src/auth/verifyTelegramWebApp.js` | `src/lib/verifyTelegramWebApp.ts` |
| `backend/src/auth/verifyTelegramLogin.js` | `src/lib/verifyTelegramLogin.ts` |
| `backend/src/lib/telegram.js` | `src/lib/telegram.ts` |
| `backend/src/middleware/auth.js` | `src/lib/auth.ts` + `src/middleware.ts` |
| `backend/src/middleware/tenantRestrict.js` | `src/lib/tenantRestrict.ts` |
| `backend/src/routes/auth.js` | `src/app/api/auth/*/route.ts` |
| `backend/src/routes/events.js` | `src/app/t/[tenantSlug]/*/page.tsx` |
| `backend/src/routes/participants.js` | `src/app/api/participants/*/route.ts` |
| `backend/src/routes/admin.js` | `src/app/api/admin/*/route.ts` + `src/app/admin/*/page.tsx` |
| `backend/src/views/*.ejs` | `src/app/**/page.tsx` + `src/components/*.tsx` |
| `backend/src/public/style.css` | `public/style.css` |
