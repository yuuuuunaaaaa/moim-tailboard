## moim-tailboard

교회/공동체에서 텔레그램으로 관리하던 “이름 꼬리 참여 신청”을 웹으로 옮긴 작은 웹 서비스입니다.  
여러 지역 공동체(테넌트)가 하나의 서비스에서 각자 이벤트와 참여자를 관리할 수 있도록 만든 **멀티 테넌트 이벤트 참여 보드**입니다.

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
  - `JOIN_EVENT`, `CANCEL_EVENT`, `UPDATE_PARTICIPANT`, `ADMIN_CREATE_EVENT` 등 주요 행동을 `action_log` 테이블에 기록
  - 실제 데이터는 단순하게 유지하고, 과거 히스토리는 로그로 추적

### 기술 스택

- **Backend**: Node.js, Express
- **DB**: MySQL, Prisma ORM
- **Frontend**: EJS(Server-Side Rendering)
- **Infra**: Docker (Node 컨테이너, MySQL 컨테이너)

### 디렉토리 구조

- `backend/`  
  - Express 서버, EJS 템플릿, 라우트, Prisma Client 사용
- `prisma/`  
  - `schema.prisma` (Prisma 스키마 정의)
- `docker/`  
  - `docker-compose.yml`, `node.Dockerfile`
- `schema.sql`  
  - MySQL용 DDL. Prisma 스키마를 기반으로 한 실제 테이블 정의

### 로컬 개발 환경 설정

1. 저장소 클론 후, 루트에서 `.env` 파일 생성

   - 예시: `.env.example` 참고

2. 의존성 설치

   ```bash
   cd backend
   npm install
   ```

3. DB 마이그레이션 및 Prisma Client 생성

   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. 개발 서버 실행

   ```bash
   npm run dev
   ```

5. 브라우저에서 접속

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

- `tenant`: 테넌트(공동체) 정보
- `admin`: 관리자 계정 (텔레그램 ID, 테넌트 FK)
- `event`: 이벤트 (제목, 설명, 일시, 활성 여부, 테넌트 FK)
- `option_group`: 이벤트 내 옵션 그룹 (식사, 이동, 파트 등)
- `option_item`: 각 옵션 그룹에 속한 개별 옵션
- `participant`: 이벤트 참여자 (이름, 학번, 텔레그램 ID)
- `participant_option`: 참여자와 옵션 간 매핑 (다대다 관계)
- `action_log`: 주요 액션 로그 (참여/취소/수정/관리자 작업 등)

### 설계 목표

- 100~200명 정도 규모의 작은 커뮤니티에서 편하게 쓸 수 있도록 **단순하지만 깔끔한 구조**를 지향
- 멀티 테넌트 구조를 통해 다른 공동체가 쉽게 붙을 수 있도록 설계
- 복잡한 기능보다는
  - 이해하기 쉬운 스키마
  - 읽기 쉬운 코드
  - 배포하기 쉬운 인프라
  에 우선순위를 둡니다.
