## moim-tailboard

교회/지역에서 텔레그램으로 관리하던 “이름 꼬리 참여 신청”을 웹으로 옮긴 작은 웹 서비스입니다.  
여러 지역 지역(테넌트)이 하나의 서비스에서 각자 이벤트와 참여자를 관리할 수 있도록 만든 **멀티 테넌트 이벤트 참여 보드**입니다.

### 주요 기능

- **멀티 테넌트 지원**
  - `tenant`(예: 인천청년, 서울청년) 별로 이벤트/참여자/옵션 데이터를 분리 저장
  - URL 예시: `/t/{tenant_slug}/events`, `/t/{tenant_slug}/events/{eventId}`

- **이벤트 관리**
  - 제목, 설명, 일시, 활성 여부 필드
  - 각 이벤트에 여러 개의 **옵션 그룹**(식사, 이동, 파트, 스태프 등)을 가질 수 있음

- **옵션 그룹 / 옵션**
  - 옵션 그룹: 단일/다중 선택 여부(`multiple_select`), 정렬 순서 관리
  - 옵션: 이름, 제한 인원 여부(`limit_enabled`), 제한 인원 수, 정렬 순서

- **참여자 관리**
  - 누구나 이름을 입력해서 참여 등록 가능
  - 같은 이름이 여러 명 있을 수 있으므로, 필요 시 학번(`student_no`)로 추가 구분
  - 한 사람이 여러 사람을 대신 등록할 수 있음
  - 각 참여자는 텔레그램 ID(`telegram_id`)를 함께 저장
  - 본인이 등록한 항목만 텔레그램 ID로 인증 후 **이름/학번 수정** 또는 **삭제(물리 삭제)** 가능

- **옵션 선택**
  - 각 참여자는 옵션 그룹별로 선택 (예: 식사 O, 자차 이동, 테너 파트 등)

- **관리자 기능**
  - 관리자는 텔레그램 ID 기반으로 식별되는 것을 전제로 설계
  - 관리자 페이지에서 이벤트 생성, 옵션 그룹/옵션 생성 가능

- **액션 로그**
  - `LOGIN`, `JOIN_EVENT`, `CANCEL_EVENT`, `UPDATE_PARTICIPANT`, `ADMIN_CREATE_EVENT` 등 주요 행동을 `action_log` 테이블에 기록
  - 실제 데이터는 단순하게 유지하고, 과거 히스토리는 로그로 추적

### 기술 스택

- **Backend**: Node.js, Express
- **DB**: MySQL (+ `mysql2` 드라이버, 생 SQL)
- **Frontend**: EJS(Server-Side Rendering)
- **Infra**: Docker (Node 컨테이너, MySQL 컨테이너)

### 디렉토리 구조

- `backend/`  
  - `src/server.js` – 진입점  
  - `src/db/mysql.js` – MySQL 풀 및 `getTenantOr404`  
  - `src/routes/events.js`, `participants.js`, `admin.js` – 라우트  
  - `src/views/` – EJS 템플릿 (event-list, event-detail, admin)
- `docker/`  
  - `docker-compose.yml`, `node.Dockerfile`
- `schema.sql`  
  - MySQL용 DDL. 실제 운영에 사용하는 테이블 정의

### 텔레그램 봇 채팅방 설정

봇 채팅방에서 **참여하기** 버튼을 누르면 Web App(참여 페이지)이 열리도록 하려면 아래처럼 설정하면 됩니다.

#### 1. 봇 만들기 및 토큰

1. 텔레그램에서 [@BotFather](https://t.me/BotFather) 연다.
2. `/newbot` → 봇 이름·사용자명 입력해 봇 생성.
3. 발급된 **토큰**을 `backend/.env`에 넣는다.
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHI...
   TELEGRAM_BOT_NAME=여기봇사용자명
   APP_URL=https://your-domain.com
   ```

#### 2. 도메인 연결 (필수 – "Bot domain invalid" 해결)

**로그인 위젯**이나 **Web App**을 쓰는 **도메인**을 봇에 연결해야 합니다. 연결하지 않으면 "Bot domain invalid" 오류가 나고 로그인이 되지 않습니다.

1. 텔레그램에서 [@BotFather](https://t.me/BotFather) 연다.
2. **`/setdomain`** 명령을 입력한다.
3. 사용할 **봇**을 선택한다.
4. **도메인**을 입력한다. (`https://` 없이 **호스트만** 입력)
   - **실서비스**: `your-domain.com`  
   - **로컬 테스트(ngrok)**: ngrok 실행 시 나온 주소만. 예: `abc12-def3.ngrok-free.app`

한 번에 하나의 도메인만 연결됩니다. ngrok으로 테스트할 때는 ngrok 주소를, 배포할 때는 실제 도메인을 `/setdomain`으로 다시 설정하면 됩니다.

#### 3. 메뉴 버튼(채팅방 버튼)으로 Web App 열기

**봇 링크에는 테넌트를 넣어 두는 것을 권장합니다.**  
같은 봇이라도 지역별로 다른 링크를 쓰면, 사용자가 눌렀을 때 해당 지역 이벤트 목록으로 바로 들어갑니다.

| 링크 형식 | 설명 |
|-----------|------|
| `https://your-domain.com/t/{테넌트_slug}` | 짧은 링크. 해당 테넌트 이벤트 목록으로 자동 이동 |
| `https://your-domain.com/t/{테넌트_slug}/events` | 테넌트 이벤트 목록 (예: 인천청년 → `/t/incheon/events`) |
| `https://your-domain.com/t/{테넌트_slug}/events/{이벤트ID}` | 특정 이벤트 참여 페이지 |

**방법 A – BotFather에서 한 번에 설정 (권장)**

1. [@BotFather](https://t.me/BotFather)에서 해당 봇 선택.
2. **Bot Settings** → **Menu Button** → **Configure menu button**.
3. **Send URL** 선택 후, **테넌트가 포함된 URL**을 입력합니다.
   - **인천청년 전용 봇이라면:**  
     `https://your-domain.com/t/incheon`  
     또는  
     `https://your-domain.com/t/incheon/events`
   - **특정 이벤트만 바로 열기:**  
     `https://your-domain.com/t/incheon/events/3`
   - (테넌트 없이) 지역 선택 화면부터 열기:  
     `https://your-domain.com/`

이제 사용자가 봇 채팅방에서 **메뉴 버튼**을 누르면, 입력한 URL이 Web App으로 열립니다.  
참여 페이지(`/t/.../events/:id`)로 열면 **텔레그램 로그인(자동 입력)** 이 동작합니다.

**방법 B – Bot API로 메뉴 버튼 설정**

지역별로 다른 URL을 쓰려면 `url`만 해당 테넌트로 바꾸면 됩니다.

```bash
# 인천 테넌트용 메뉴 버튼 (테넌트 정보 포함)
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{"menu_button":{"type":"web_app","text":"참여하기","web_app":{"url":"https://your-domain.com/t/incheon/events"}}}'
```

#### 4. 채팅방에서 링크로 열기

- 봇이 **메시지**나 **인라인 버튼**으로 **테넌트가 포함된 링크**를 보내면 됩니다.
  - 이벤트 목록: `https://your-domain.com/t/incheon/events` 또는 짧게 `https://your-domain.com/t/incheon`
  - 특정 이벤트: `https://your-domain.com/t/incheon/events/3`
- 사용자가 링크를 누르면 Telegram이 **Web App**으로 열고, 참여 페이지에서는 **자동 로그인**이 동작합니다.

#### 5. 정리

| 목표 | 설정 |
|------|------|
| 봇 링크에 테넌트 포함 | URL을 `https://your-domain.com/t/{tenant_slug}` 또는 `.../t/{tenant_slug}/events` 로 설정 |
| 짧은 주소만 쓰기 | `/t/incheon` 만 넣어도 이벤트 목록(`/t/incheon/events`)으로 리다이렉트됨 |
| 특정 이벤트만 열기 | `https://your-domain.com/t/{tenant}/events/{eventId}` 로 지정 |
| 버튼 문구 바꾸기 | Bot API `setChatMenuButton`의 `text` 사용 (예: "참여하기") |

#### 6. 로컬에서 채팅방 Web App 테스트하기

Telegram은 Web App을 **HTTPS** URL로만 엽니다. 로컬(`http://localhost:3000`)을 그대로 넣으면 동작하지 않으므로, **ngrok**으로 로컬 서버를 HTTPS 주소로 노출한 뒤 테스트합니다.

**1) ngrok 설치**

- [ngrok 가입](https://ngrok.com/) 후 설치.
- macOS: `brew install ngrok` 또는 [다운로드](https://ngrok.com/download).

**2) 백엔드 실행**

```bash
cd backend
npm run dev
```

**3) 터미널 하나 더 열어서 ngrok 실행**

```bash
ngrok http 3000
```

실행하면 예시처럼 **HTTPS 주소**가 나옵니다.

```
Forwarding   https://abc12-def3.ngrok-free.app -> http://localhost:3000
```

이 `https://...ngrok-free.app` 주소를 복사합니다.

**4) 봇 메뉴 버튼에 ngrok URL 넣기**

- [@BotFather](https://t.me/BotFather) → 해당 봇 → **Bot Settings** → **Menu Button** → **Configure menu button** → **Send URL**.
- URL에 **테넌트 포함**해서 입력합니다.  
  예: `https://abc12-def3.ngrok-free.app/t/incheon`  
  (실제로 나온 ngrok 주소로 바꿔서 사용.)

**5) 채팅방에서 테스트하는 방법**

아래 순서대로 하면 **봇과의 채팅방**에서 Web App을 열 수 있습니다.

- **5-1. 봇 채팅방 열기**
  - 텔레그램 앱(휴대폰 또는 데스크톱)을 연다.
  - 검색에서 **자기가 만든 봇 이름**을 찾아 들어간다. (예: `@moim_tailboard_bot`)
  - 봇과의 **1:1 채팅방**이 열린 상태로 둔다.

- **5-2. Web App 여는 버튼 찾기**
  - **휴대폰**: 채팅 화면 **입력창 왼쪽**에 있는 **☰ 메뉴 아이콘**을 누른다.  
    → 메뉴가 나오면 **"참여하기"**(또는 메뉴 버튼에 넣은 문구) 또는 **웹 앱을 여는 항목**을 누른다.
  - **데스크톱**: 입력창 왼쪽의 **메뉴(≡)** 버튼을 누르거나, 입력창 위쪽에 **Web App 버튼**이 있으면 그것을 누른다.
  - BotFather에서 **Menu Button**을 설정했다면, 이 버튼을 누를 때 위 4단계에서 넣은 **ngrok URL**이 Web App으로 열린다.

- **5-3. Web App이 열렸는지 확인**
  - 화면에 **우리 서비스 화면**(지역 이름, 이벤트 목록 등)이 뜨면 성공이다.  
    → 이때 보이는 페이지는 **로컬에서 돌리는 백엔드**가 ngrok을 통해 제공하는 페이지다.
  - 빈 화면이나 에러가 나오면: ngrok이 켜져 있는지, 백엔드가 `npm run dev`로 실행 중인지, BotFather 메뉴 버튼 URL이 **현재 ngrok 주소**와 일치하는지 다시 확인한다.

- **5-4. 참여 페이지에서 자동 로그인 확인**
  - 이벤트 목록에서 **이벤트 하나**를 눌러 **참여 신청 페이지**로 들어간다.
  - **텔레그램 ID**와 **이름** 입력란이 **이미 채워져 있으면** Web App 자동 로그인이 정상 동작하는 것이다. (비워져 있으면 같은 채팅방에서 메뉴 버튼으로 들어왔는지, HTTPS(ngrok)로 열렸는지 확인.)

**요약**: 봇 채팅방 → 입력창 왼쪽 메뉴(☰) → "참여하기"(또는 설정한 버튼) → Web App 열림 → 이벤트 선택 → 참여 페이지에서 이름/텔레그램 ID 자동 입력 확인.

**참고**

- ngrok을 끄면 해당 HTTPS 주소로 접속할 수 없으므로, 테스트하는 동안에는 **백엔드**와 **ngrok**을 둘 다 켜 두어야 한다.
- ngrok 무료 버전은 재시작할 때마다 URL이 바뀌므로, URL이 바뀔 때마다 BotFather에서 메뉴 버튼 URL을 새 주소로 다시 설정해야 한다.
- `backend/.env`의 `APP_URL`은 로그인 콜백 등에 쓰이므로, **로컬 + ngrok 테스트** 시에는 `APP_URL=https://abc12-def3.ngrok-free.app` 처럼 **현재 ngrok URL**로 두는 것이 좋다. (ngrok URL이 바뀌면 `.env`도 같이 수정.)

---

### 로컬 개발 환경 설정

1. 저장소 클론 후, 루트에서 `.env` 파일 생성

   - 예시: `.env.example` 참고

2. 의존성 설치

   ```bash
   cd backend
   npm install
   ```

3. 개발 서버 실행

   ```bash
   npm run dev
   ```

4. 브라우저에서 접속

   - `http://localhost:3000/admin`  
     - 테넌트 조회, 이벤트/옵션 그룹 생성
   - `http://localhost:3000/t/{tenant_slug}/events`  
     - 특정 테넌트의 이벤트 리스트

### Docker로 실행하기

1. 루트에서 `.env` 설정 (특히 `DATABASE_URL` 확인)
2. Docker Compose 실행

   ```bash
   cd docker
   docker compose up --build
   ```

3. 컨테이너 기동 후

   - 앱: `http://localhost:3000`
   - MySQL: `localhost:3306` (유저/비밀번호는 `docker-compose.yml` 참고)

### DB 스키마 개요

- `tenant`: 테넌트(지역) 정보
- `admin`: 관리자 계정 (텔레그램 ID, 테넌트 FK)
- `event`: 이벤트 (제목, 설명, 일시, 활성 여부, 테넌트 FK)
- `option_group`: 이벤트 내 옵션 그룹 (식사, 이동, 파트 등)
- `option_item`: 각 옵션 그룹에 속한 개별 옵션
- `participant`: 이벤트 참여자 (이름, 학번, 텔레그램 ID)
- `participant_option`: 참여자와 옵션 간 매핑 (다대다 관계)
- `action_log`: 주요 액션 로그 (참여/취소/수정/관리자 작업 등)

### 설계 목표

- 100~200명 정도 규모의 작은 커뮤니티에서 편하게 쓸 수 있도록 **단순하지만 깔끔한 구조**를 지향
- 멀티 테넌트 구조를 통해 다른 지역이 쉽게 붙을 수 있도록 설계
- 복잡한 기능보다는
  - 이해하기 쉬운 스키마
  - 읽기 쉬운 코드
  - 배포하기 쉬운 인프라
  에 우선순위를 둡니다.
