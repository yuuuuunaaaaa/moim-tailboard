# moim-tailboard

교회·지역 커뮤니티에서 텔레그램으로 하던 **"이름 꼬리 참여 신청"** 을 웹으로 옮긴 멀티 테넌트 꼬리달기 보드입니다.  
테넌트(예: 인천청년, 서울청년)별로 꼬리달기·참여자·옵션 데이터를 분리해 운영합니다.

---

## 기술 스택

| 분류 | 사용 기술 |
|---|---|
| 프레임워크 | Next.js 15 (App Router) + React 19 + TypeScript |
| DB | MySQL (`mysql2`) |
| 인증 | Telegram Login Widget / Telegram Mini App + JWT 쿠키 (`jose`) |
| 배포 | Vercel |

---

## 주요 URL

| 경로 | 설명 |
|---|---|
| `/{tenantSlug}` | 테넌트 단축 URL → `/t/{slug}/events` 로 리다이렉트 |
| `/t/{tenantSlug}/events` | 꼬리달기 목록 |
| `/t/{tenantSlug}/events/{eventId}` | 꼬리달기 상세 / 참여 신청 |
| `/admin` | 관리자 메인 (꼬리달기 목록·등록·순서 변경) |
| `/admin/events/{eventId}/edit` | 꼬리달기 수정·옵션·참여자 관리 |
| `/admin/tenants/{tenantSlug}` | 관리자 추가·삭제 (최고관리자 전용) |
| `/admin/tenants/{tenantSlug}/settings` | 텔레그램 채팅방 설정 (최고관리자 전용) |
| `/admin/tenants/{tenantSlug}/logs` | 테넌트 활동 로그 (최고관리자 전용) |
| `/login` | 텔레그램 로그인 |
| `/api/health` | 헬스체크 |

---

## 로컬 개발 환경 설정

### 1. 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사해 `.env.local`을 만들고 값을 채웁니다.

```bash
cp .env.example .env.local
```

| 변수 | 필수 | 설명 |
|---|---|---|
| `DB_HOST` | ✅ | MySQL 호스트 |
| `DB_PORT` | | MySQL 포트 (기본 3306) |
| `DB_USER` | ✅ | DB 사용자 |
| `DB_PASSWORD` | ✅ | DB 비밀번호 |
| `DB_NAME` | ✅ | DB 이름 |
| `DB_SSL_CA_CONTENT` | | SSL CA 인증서 내용 (PEM, managed MySQL 등 SSL 필수 환경) |
| `JWT_SECRET` | ✅ | JWT 서명 비밀키 (충분히 긴 랜덤 문자열 권장) |
| `TELEGRAM_BOT_TOKEN` | ✅ | BotFather에서 발급받은 봇 토큰 |
| `NEXT_PUBLIC_TELEGRAM_BOT_NAME` | ✅ | 봇 사용자명 (`@` 없이, 예: `TailboardBot`) |
| `NEXT_PUBLIC_APP_URL` | ✅ | 앱 배포 URL (텔레그램 Mini App URL로 사용) |
| `NEXT_PUBLIC_TELEGRAM_MINI_APP_SHORT_NAME` | | Mini App 짧은 이름 (BotFather 등록 시 발급) |
| `ADMIN_CACHE_REVALIDATE_SECONDS` | | 관리자 정보 캐시 TTL(초). `0` 이면 캐시 비활성. 기본 `300` |
| `ALLOW_LOCAL_WITHOUT_AUTH` | | `1` 이면 로컬에서 텔레그램 로그인 없이 개발 가능 |
| `DEV_DEFAULT_USERNAME` | | `ALLOW_LOCAL_WITHOUT_AUTH=1` 사용 시 기본 텔레그램 username |
| `DEV_DEFAULT_TENANT_SLUG` | | `ALLOW_LOCAL_WITHOUT_AUTH=1` 사용 시 기본 테넌트 slug |

### 3. DB 초기화

MySQL에 `schema.sql`을 적용합니다.

```bash
mysql -u <user> -p <db_name> < schema.sql
```

최소 1개의 테넌트와 최고관리자를 삽입합니다.

```sql
-- 테넌트 생성
INSERT INTO tenant (slug, name, chat_room_id)
VALUES ('incheon', '인천청년', '-100123456789');

-- 최고관리자 등록 (telegram username으로 로그인)
INSERT INTO admin (username, name, tenant_id, is_superadmin)
VALUES ('your_telegram_username', '홍길동', (SELECT id FROM tenant WHERE slug = 'incheon'), 1);
```

> `chat_room_id`: 참여·취소 알림을 받을 텔레그램 채팅방 ID (음수 형태의 그룹/채널 ID)

### 4. 개발 서버 실행

```bash
npm run dev
# → http://localhost:3000
```

로그인 없이 개발하려면 `.env.local`에 다음을 추가합니다.

```env
ALLOW_LOCAL_WITHOUT_AUTH=1
DEV_DEFAULT_USERNAME=your_telegram_username
DEV_DEFAULT_TENANT_SLUG=incheon
```

---

## 권한 구조

```
최고관리자 (is_superadmin = 1)
 └─ 관리자 추가·삭제
 └─ 텔레그램 채팅방 설정
 └─ 활동 로그 조회
 └─ 꼬리달기 등록·수정·삭제 (아래 권한 포함)

일반관리자
 └─ 꼬리달기 등록·수정·삭제
 └─ 참여자 옵션 수정·삭제
 └─ 공지 메시지 전송
```

- 한 텔레그램 계정이 여러 테넌트의 관리자로 등록될 수 있습니다 (멀티 테넌트).
- 여러 테넌트를 관리하는 경우, 관리 페이지에서 테넌트 전환 FAB 버튼이 표시됩니다.

---

## 세션 / 쿠키

| 쿠키 | 역할 | 만료 |
|---|---|---|
| `auth_token` | JWT (로그인 상태, `username` 포함) | 7일 |
| `allowed_tenant_slug` | 접근 허가된 테넌트 slug | 90일 |

- `allowed_tenant_slug`는 `/api/init-tenant`가 DB에서 slug를 검증한 뒤 발급합니다.
- 미들웨어(`middleware.ts`)는 `/t/{slug}/*` 접근 시 쿠키 유무를 확인하고 없으면 자동으로 init-tenant로 보냅니다.

---

## 텔레그램 연동

### BotFather 설정 (필수)

1. `/setdomain` — Login Widget을 허용할 도메인 등록 (`https://` 없이 호스트만 입력)
2. `/newapp` — Mini App 등록 후 `NEXT_PUBLIC_TELEGRAM_MINI_APP_SHORT_NAME` 발급

### Mini App URL 예시

| 목적 | URL |
|---|---|
| 꼬리달기 목록 | `https://t.me/TailboardBot/moim?startapp=t-incheon` |
| 특정 꼬리달기 | `https://t.me/TailboardBot/moim?startapp=...` |

> 로컬 테스트 시 텔레그램 Mini App은 HTTPS만 열 수 있으므로 ngrok 등 터널 도구가 필요합니다.  
> 이 경우 `NEXT_PUBLIC_APP_URL`도 ngrok HTTPS 주소로 맞추세요.

---

## 배포

### Vercel

`vercel.json` 기반으로 자동 빌드됩니다. 환경변수는 Vercel 대시보드에서 설정합니다.  
SSL이 필요한 MySQL이면 `DB_SSL_CA_CONTENT`에 PEM 내용을 통째로 붙여넣으세요.

### 온프레미스

`DEPLOY_ONPREM.md`를 참고하세요. Next.js standalone 빌드를 사용합니다.

---

## DB 스키마 주요 테이블

| 테이블 | 역할 |
|---|---|
| `tenant` | 테넌트(지역) 정보, 텔레그램 채팅방 ID |
| `admin` | 관리자 (테넌트별, `is_superadmin` 구분) |
| `event` | 꼬리달기 (제목·날짜·공개여부·표시순서) |
| `option_group` | 옵션 그룹 (식사, 이동 등) |
| `option_item` | 옵션 항목 (O/X, 자차/버스 등, 인원 제한 지원) |
| `participant` | 참여자 (이름·학번·텔레그램 username) |
| `participant_option` | 참여자 ↔ 옵션 항목 매핑 |
| `action_log` | 참여·취소·관리 작업 감사 로그 |

전체 DDL은 `schema.sql`을 참고하세요.

---

## 참고 문서

| 파일 | 내용 |
|---|---|
| `schema.sql` | MySQL DDL 전체 |
| `docs/tenant-context.md` | 테넌트 컨텍스트 설계 |
| `DEPLOY_ONPREM.md` | 온프레미스 배포 가이드 |
| `MIGRATE_NEXTJS.md` | App Router 구조 설계 배경 |
| `OPERATION_TODO.md` | 운영 체크리스트 |
