## moim-tailboard

교회/지역 커뮤니티에서 텔레그램으로 하던 “이름 꼬리 참여 신청”을 웹으로 옮긴 **멀티 테넌트 이벤트 참여 보드**입니다.  
테넌트(예: 인천청년/서울청년)별로 이벤트/참여/옵션 데이터를 분리해 운영합니다.

### 기술 스택

- **Web**: Next.js (App Router) + React + TypeScript
- **DB**: MySQL (`mysql2`)
- **Auth**: Telegram Login Widget / Telegram WebApp + JWT 쿠키

### 사용 방법 (로컬 개발)

#### 1) 설치

```bash
npm install
```

#### 2) 환경변수 설정

- 로컬에서는 `.env.local`을 사용합니다.
- 템플릿: `.env.local.example`

```env
# DB (서버 전용)
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_SSL_CA_CONTENT=
# DB_SSL_CA=/path/to/ca.pem

# Auth (서버 전용)
JWT_SECRET=
JWT_EXPIRY=90d
TELEGRAM_BOT_TOKEN=

# 공개 변수 (클라이언트·서버 공용)
NEXT_PUBLIC_APP_URL=https://moim-tailboard.vercel.app
NEXT_PUBLIC_TELEGRAM_BOT_NAME=TailboardBot

# 로컬 개발 시 인증 우회 (선택)
# ALLOW_LOCAL_WITHOUT_AUTH=1
```

#### 3) DB 준비 (필수)

MySQL에 `schema.sql`을 적용한 뒤, 최소 1개의 `tenant`와 `admin`을 넣어야 정상적으로 사용할 수 있습니다.

```bash
mysql -u <user> -p <db_name> < schema.sql
```

예시(직접 값은 환경에 맞게 변경):

```sql
INSERT INTO tenant (slug, name, chat_room_id) VALUES ('incheon', '인천청년', '-1');
INSERT INTO admin (telegram_id, username, name, tenant_id)
VALUES (NULL, 'your_telegram_username', '관리자', (SELECT id FROM tenant WHERE slug='incheon'));
```

#### 4) 실행

```bash
npm run dev
```

- `http://localhost:3000`

### 사용 방법 (주요 화면/URL)

- 테넌트 이벤트 목록: `/t/{tenantSlug}/events`
- 이벤트 상세/참여: `/t/{tenantSlug}/events/{eventId}`
- 관리자: `/admin`
- 헬스체크: `/api/health`

### 텔레그램(Web App) 연동 요약

- **BotFather 도메인 등록(필수)**: `/setdomain`으로 Web App을 열 도메인을 등록해야 “Bot domain invalid”를 피할 수 있습니다. (`https://` 없이 호스트만)
- **메뉴 버튼 URL 권장**
  - `https://moim-tailboard.vercel.app/t/{tenantSlug}` (이벤트 목록으로 이동)
  - `https://moim-tailboard.vercel.app/t/{tenantSlug}/events/{eventId}` (특정 이벤트 바로 열기)
- **로컬 테스트**: Telegram WebApp은 HTTPS만 열 수 있어 ngrok 같은 터널이 필요합니다. 이때 `NEXT_PUBLIC_APP_URL`도 ngrok HTTPS 주소로 맞추세요.

### 배포

- **Railway**: `railway.toml`이 `npm run build` / `npm run start`로 설정되어 있습니다.
- **온프렘 배포 문서**: `DEPLOY_ONPREM.md` (일부 내용은 과거 구조 기준일 수 있어, 실제 실행 커맨드는 이 README의 Next.js 기준을 우선으로 봐주세요)

### 문서

- `MIGRATE_NEXTJS.md`: Next.js(App Router)로의 구조/의도 정리
- `schema.sql`: MySQL DDL
