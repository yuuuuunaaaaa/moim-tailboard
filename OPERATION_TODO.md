# moim-tailboard 운영 투두리스트

프로젝트를 실제 서비스로 운영하기까지 필요한 작업 체크리스트입니다.

---

## 1. 환경 변수 및 설정

- [x] **backend/.env** 작성
  - [x] `DB_HOST` – MySQL 호스트 (Aiven 등)
  - [x] `DB_PORT` – MySQL 포트
  - [x] `DB_USER` – DB 사용자
  - [x] `DB_PASSWORD` – DB 비밀번호
  - [x] `DB_NAME` – DB 이름
  - [x] `DB_SSL_CA` – (로컬) SSL CA 인증서 **파일 경로** (예: `./ca.pem`)
  - [x] `DB_SSL_CA_CONTENT` – (Railway 등) SSL CA 인증서 **PEM 전체 문자열** (파일 없이 env에 붙여넣기)
  - [x] `TELEGRAM_BOT_TOKEN` – BotFather에서 발급한 봇 토큰
  - [x] `TELEGRAM_BOT_NAME` – 봇 사용자명 (예: `TailboardBot`)
  - [x] `APP_URL` – 서비스 공개 URL (예: `https://tailboard.example.com`)
  - [x] `JWT_SECRET` – 32자 이상 랜덤 문자열 (JWT 서명용)
  - [x] `JWT_EXPIRY` – (선택) 토큰 유효기간, 기본 `90d`
- [x] **.env.example** 과 동기화 여부 확인 (민감 정보 제외)
- [ ] 프로덕션용 **NODE_ENV=production** 설정

---

## 2. 데이터베이스

- [x] MySQL 서버 준비 (Aiven / RDS / 로컬 등)
- [x] **schema.sql** 로 DB 생성
  - [x] `tenant` 테이블
  - [x] `admin` 테이블
  - [x] `event`, `option_group`, `option_item`
  - [x] `participant`, `participant_option`
  - [x] `action_log`
- [x] SSL 연결 시 **ca.pem** 등 인증서 파일 위치 확인 및 권한 설정
- [x] 최소 1개 **tenant** INSERT (예: `slug`, `name`)
- [x] 각 테넌트별 **admin** 1명 이상 등록 (username = 텔레그램 사용자명)

---

## 3. 텔레그램 봇

- [x] [@BotFather](https://t.me/BotFather)에서 봇 생성 및 **토큰** 발급
- [x] **도메인 연결** (`/setdomain`)
  - 운영 도메인 1개만 입력 (예: `tailboard.example.com`, `https` 없이)
  - 로컬 테스트 시 ngrok 주소로 설정 후, 배포 시 실제 도메인으로 변경
- [x] **메뉴 버튼** 설정 (BotFather 또는 Bot API)
  - [x] Menu Button → Configure → **Send URL**
  - [x] URL에 **테넌트 포함** (예: `https://도메인/t/incheon` 또는 `.../t/incheon/events`)
- [ ] (선택) Bot API로 버튼 문구/URL 지역별 설정
  ```bash
  curl "https://api.telegram.org/bot<TOKEN>/setChatMenuButton" \
    -H "Content-Type: application/json" \
    -d '{"menu_button":{"type":"web_app","text":"참여하기","web_app":{"url":"https://도메인/t/테넌트slug/events"}}}'
  ```

---

## 4. 보안

- [x] **JWT_SECRET** 을 강한 랜덤 값으로 설정 (32자 이상)
- [x] **.env**, **ca.pem** 등이 저장소/이미지에 포함되지 않도록 확인 (.gitignore, .dockerignore)
- [ ] 프로덕션에서는 **HTTPS** 만 사용 (리버스 프록시 또는 로드밸런서에서 SSL 종료)
- [x] 쿠키 옵션 검토 (httpOnly, sameSite, secure in production)
- [ ] (선택) rate limiting, helmet 등 보안 미들웨어 적용

---

## 5. 배포 인프라

- [ ] 서버 또는 PaaS 선택 (VPS, AWS, GCP, Railway, Render 등)
- [ ] **Node.js 18** 런타임 준비
- [ ] **backend** 디렉토리 기준으로 실행
  ```bash
  cd backend && npm ci --omit=dev && node src/server.js
  ```
- [ ] **PORT** 환경 변수로 포트 지정 (기본 3000)
- [ ] 리버스 프록시 설정 (Nginx 등)
  - [ ] HTTPS 설정
  - [ ] `APP_URL` 과 동일한 호스트로 프록시
- [ ] (선택) **Docker** 사용 시
  - [ ] `docker/node.Dockerfile` 빌드
  - [ ] `docker/docker-compose.yml` 에 DB/앱 연동 후 실행
  - [ ] DB는 외부 MySQL(Aiven 등) 사용 시 compose 에서 제외 가능

---

## 6. 초기 운영 데이터

- [x] 테넌트(지역) 추가
  - [x] `tenant` 테이블에 `slug`, `name` INSERT
- [x] 각 테넌트별 관리자 추가
  - [x] `/admin` 로그인 후 **해당 지역 관리자** 페이지에서 **사용자명** 추가
  - [x] 또는 DB에 직접 `admin` INSERT (username, tenant_id)
- [ ] (선택) 첫 이벤트 생성 후 메뉴 버튼 URL을 특정 이벤트로 설정

---

## 7. 배포 후 확인

- [x] **APP_URL** 로 접속 시 홈/로그인/이벤트 목록 정상 노출
- [x] **관리자**: PC에서 `/login` → 텔레그램 로그인 위젯 → 로그인 후 `/admin` 접근 가능
- [x] **참여자**: 텔레그램 봇 메뉴 버튼(또는 링크) → Web App → 이벤트 목록/참여 페이지 동작
- [x] 참여 페이지에서 **이름/사용자명 자동 입력** (Web App 로그인) 확인
- [x] 다른 지역 URL 직접 입력 시 **비관리자는 403** 인지 확인
- [x] **지역 선택** 링크/헤더가 비관리자에게 안 보이는지 확인

---

## 8. 모니터링·운영

- [ ] 로그 수집 (stdout/stderr 또는 파일 로그)
- [ ] DB 연결 실패, 5xx 발생 시 알림 경로 정리 (선택)
- [ ] **action_log** 로 참여/취소/관리자 작업 이력 확인 가능한지 점검
- [ ] 정기 백업: MySQL 덤프 또는 관리형 DB 백업 설정
- [ ] JWT 만료, 쿠키 정책 변경 시 사용자 재로그인 필요함을 문서화

---

## 9. 문서·공유

- [ ] **README.md** 의 APP_URL, 도메인 예시를 실제 운영 값으로 갱신 (또는 placeholder 유지)
- [ ] 지역별 **봇 링크/메뉴 버튼 URL** 정리 (테넌트 slug 별로)
- [ ] 관리자에게 **로그인 방법**(PC: /login, 모바일: Web App 자동 로그인) 안내
- [ ] 새 지역 추가 절차: tenant INSERT → admin 추가 → 봇 메뉴 URL 설정

---

## 요약 체크

| 구분           | 항목 | 상태 |
|----------------|------|------|
| 필수 환경 변수 | DB_*, TELEGRAM_BOT_TOKEN, JWT_SECRET, APP_URL | [x] |
| DB             | schema.sql 적용, tenant·admin 최소 1건 | [x] |
| 텔레그램       | /setdomain, 메뉴 버튼 URL(테넌트 포함) | [x] |
| 배포           | Node 18, HTTPS, APP_URL과 동일 도메인 | [ ] |
| 보안           | JWT_SECRET 강한 값, .env 노출 금지 | [x] |

위 항목을 순서대로 진행하면 서비스를 운영할 수 있습니다.
