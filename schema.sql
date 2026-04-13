-- MySQL schema for moim-tailboard
-- 꼬리달기 서비스에서 사용하는 핵심 DB 스키마입니다.

-- 테넌트(지역) 정보
-- 예: 인천청년, 서울청년 등
CREATE TABLE tenant (
  -- PK
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- URL 에서 사용하는 짧은 텍스트 ID (예: 'incheon', 'seoul')
  slug VARCHAR(191) NOT NULL UNIQUE,
  -- 테넌트 표시 이름
  name VARCHAR(255) NOT NULL,
  -- 생성/수정 시각
  chat_room_id VARCHAR(20) NOT NULL DEFAULT '-1' COMMENT '텔레그램 채팅방 ID',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

-- 관리자 정보
-- 특정 테넌트에 속한 관리자, 텔레그램 ID 로 식별
create table admin
(
    id          int auto_increment
        primary key,
    tenant_id     int                                      not null,
    username      varchar(20)                              not null comment '텔레그램 아이디',
    telegram_id   int                                      null comment '텔레그램 사용자 ID (unique)',
    name          varchar(255)                             null comment '관리자 표시 이름 (선택)',
    created_at    datetime(3) default CURRENT_TIMESTAMP(3) not null,
    is_superadmin bit         default b'0'                 not null comment '최고 관리자 여부',
    constraint uq_admin_telegram_id
        unique (telegram_id),
    constraint fk_admin_tenant
        foreign key (tenant_id) references tenant (id)
            on delete cascade
);

create index idx_admin_tenant
    on admin (tenant_id);

-- 이벤트 정보
-- 예: 3/7 인천 수련회, 3/22 찬양 콘서트 등
CREATE TABLE event (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- 어떤 테넌트 소속 이벤트인지
  tenant_id INT NOT NULL,
  -- 이벤트 제목
  title VARCHAR(255) NOT NULL,
  -- 선택 설명
  description TEXT NULL,
  -- 실제 진행 일시
  event_date DATETIME(3) NOT NULL,
  -- 이벤트 노출/비노출 여부
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  -- 참가/취소 방 알림 말머리(이모지 등). NULL 이면 기본 👤
  telegram_participant_join_prefix VARCHAR(64) NULL DEFAULT NULL COMMENT '참가 신청 텔레그램 알림 말머리',
  telegram_participant_leave_prefix VARCHAR(64) NULL DEFAULT NULL COMMENT '참가 취소 텔레그램 알림 말머리',
  -- 생성/수정 시각
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_event_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(id)
    ON DELETE CASCADE,
  INDEX idx_event_tenant_date (tenant_id, event_date)
);

-- 옵션 그룹
-- 예: "식사", "이동", "파트", "스태프" 등의 그룹
CREATE TABLE option_group (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- 어느 이벤트에 속한 그룹인지
  event_id INT NOT NULL,
  -- 그룹 이름 (식사, 이동 등)
  name VARCHAR(255) NOT NULL,
  -- 다중 선택 허용 여부 (1: 여러 개 가능, 0: 단일 선택)
  multiple_select TINYINT(1) NOT NULL DEFAULT 0,
  -- 화면에서의 정렬 순서
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_option_group_event
    FOREIGN KEY (event_id) REFERENCES event(id)
    ON DELETE CASCADE,
  INDEX idx_option_group_event_order (event_id, sort_order)
);

-- 옵션 항목
-- 예: 식사 O/식사 X, 자차/대중교통, 테너/소프라노 등
CREATE TABLE option_item (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- 어느 옵션 그룹에 속하는지
  option_group_id INT NOT NULL,
  -- 옵션 이름
  name VARCHAR(255) NOT NULL,
  -- 인원 제한 사용 여부
  limit_enabled TINYINT(1) NOT NULL DEFAULT 0,
  -- 인원 제한 수 (null 이면 제한 없음)
  limit_count INT NULL,
  -- 화면에서의 정렬 순서
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_option_item_group
    FOREIGN KEY (option_group_id) REFERENCES option_group(id)
    ON DELETE CASCADE,
  INDEX idx_option_item_group_order (option_group_id, sort_order)
);

-- 이벤트 참여자
-- 이름/학번/텔레그램 ID 기준으로 식별
CREATE TABLE participant (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- 어느 이벤트에 참여하는지
  event_id INT NOT NULL,
  -- 이름 (중복 가능)
  name VARCHAR(255) NOT NULL,
  -- 학번/기타 구분값 (동명이인 구분용)
  student_no VARCHAR(64) NULL,
  -- 등록 시 사용한 텔레그램 ID (본인 수정/삭제 검증용)
  username VARCHAR(191) NOT NULL,
  -- 생성 시각
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_participant_event
    FOREIGN KEY (event_id) REFERENCES event(id)
    ON DELETE CASCADE,
  INDEX idx_participant_event_name (event_id, name)
);

-- 참여자와 옵션의 매핑 테이블
-- 한 참여자가 여러 그룹/옵션을 선택할 수 있음
CREATE TABLE participant_option (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- 어떤 참여자인지
  participant_id INT NOT NULL,
  -- 어떤 옵션을 선택했는지
  option_item_id INT NOT NULL,
  CONSTRAINT fk_participant_option_participant
    FOREIGN KEY (participant_id) REFERENCES participant(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_participant_option_item
    FOREIGN KEY (option_item_id) REFERENCES option_item(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_participant_option UNIQUE (participant_id, option_item_id)
);

-- 액션 로그
-- JOIN_EVENT, CANCEL_EVENT, UPDATE_PARTICIPANT, ADMIN_CREATE_EVENT 등
-- 주로 감사/히스토리 확인용으로 사용
CREATE TABLE action_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- 어떤 테넌트에서 발생한 액션인지
  tenant_id INT NOT NULL,
  -- 어떤 이벤트에 대한 액션인지 (없을 수도 있음)
  event_id INT NULL,
  -- 어떤 참여자에 대한 액션인지 (없을 수도 있음)
  participant_id INT NULL,
  -- 액션 타입 문자열
  action VARCHAR(191) NOT NULL,
  -- 추가 정보(JSON) - 예: 변경 전/후 값, 옵션 선택 리스트 등
  metadata JSON NULL,
  -- 로그 생성 시각
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_action_log_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_action_log_event
    FOREIGN KEY (event_id) REFERENCES event(id),
  CONSTRAINT fk_action_log_participant
    FOREIGN KEY (participant_id) REFERENCES participant(id),
  INDEX idx_action_log_tenant_created (tenant_id, created_at)
);

