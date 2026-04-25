export interface Tenant {
  id: number;
  slug: string;
  name: string;
  /** 참가/취소 등 기본 알림 전용 채팅방 ID */
  chat_room_id: string | null;
  /** 꼬리달기 생성 알림 전용 채팅방 ID. null/빈 문자열이면 chat_room_id로 폴백 */
  event_notice_chat_room_id: string | null;
}

export interface Admin {
  id: number;
  telegram_id: number | null;
  username: string;
  tenant_id: number;
  name: string | null;
  is_superadmin: boolean;
}

export interface Event {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  /** DATE (YYYY-MM-DD) */
  event_date: Date | string;
  is_active: number;
  /** 화면 표시 순서. 작을수록 위. 관리 화면 드래그앤드롭으로 갱신 */
  event_order: number;
  /** 참가 신청 방 알림 말머리. null/빈 문자열이면 기본 👤 */
  telegram_participant_join_prefix?: string | null;
  /** 참가 취소 방 알림 말머리. null/빈 문자열이면 기본 👤 */
  telegram_participant_leave_prefix?: string | null;
}

export interface OptionGroup {
  id: number;
  event_id: number;
  name: string;
  multiple_select: number;
  sort_order: number;
}

export interface OptionItem {
  id: number;
  option_group_id: number;
  name: string;
  limit_enabled: number;
  limit_count: number | null;
  sort_order: number;
}

export interface Participant {
  id: number;
  event_id: number;
  name: string;
  student_no: string | null;
  username: string;
}

export interface ParticipantOption {
  id: number;
  participant_id: number;
  option_item_id: number;
  option_group_id: number;
}

/** JWT 클레임 (로그인 API는 username만 저장) */
export interface JwtPayload {
  username: string;
  iat?: number;
  exp?: number;
}
