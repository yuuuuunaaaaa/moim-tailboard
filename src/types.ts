export interface Tenant {
  id: number;
  slug: string;
  name: string;
  chat_room_id: string | null;
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
  event_date: Date | string;
  is_active: number;
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

export interface JwtPayload {
  username: string;
  via_webapp?: boolean;
  is_admin?: boolean;
  iat?: number;
  exp?: number;
}
