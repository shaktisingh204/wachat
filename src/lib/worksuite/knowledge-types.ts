/**
 * Worksuite Knowledge & Collaboration — type definitions.
 *
 * Ported from Worksuite PHP/Laravel models into SabNode. Each entity
 * is scoped to a tenant via `userId` (ObjectId in Mongo, string on
 * the wire after serialize()). Optional server-managed fields like
 * `_id`, `createdAt`, `updatedAt` are included for client round-trip.
 */

export type WsDateLike = string | Date;

/* ───────────────── Knowledge Base ───────────────── */

export type WsKnowledgeBaseType =
  | 'article'
  | 'video'
  | 'audio'
  | 'image'
  | 'document';

export interface WsKnowledgeBase {
  _id?: string;
  userId?: string;
  title: string;
  description?: string;
  category_id?: string;
  category_name?: string;
  type: WsKnowledgeBaseType;
  to_do: 'yes' | 'no';
  pinned: boolean;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export interface WsKnowledgeBaseCategory {
  _id?: string;
  userId?: string;
  name: string;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export interface WsKnowledgeBaseFile {
  _id?: string;
  userId?: string;
  kb_id: string;
  filename: string;
  url: string;
  size: number;
  createdAt?: WsDateLike;
}

/* ───────────────── Notices ───────────────── */

export type WsNoticeAudience = 'all' | 'department' | 'employee';

export interface WsNotice {
  _id?: string;
  userId?: string;
  heading: string;
  description: string;
  notice_to: WsNoticeAudience;
  department_id?: string;
  employee_ids?: string[];
  file_attached: boolean;
  pinned?: boolean;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export interface WsNoticeFile {
  _id?: string;
  userId?: string;
  notice_id: string;
  filename: string;
  url: string;
  size: number;
  createdAt?: WsDateLike;
}

export interface WsNoticeView {
  _id?: string;
  userId?: string;
  notice_id: string;
  user_id: string;
  viewed_at: WsDateLike;
}

/* ───────────────── Events ───────────────── */

export type WsRepeatType = 'day' | 'week' | 'month' | 'year';
export type WsRemindType = 'hour' | 'day';

export interface WsEvent {
  _id?: string;
  userId?: string;
  event_name: string;
  description?: string;
  where?: string;
  start_date_time: WsDateLike;
  end_date_time: WsDateLike;
  label_color?: string;
  repeat: boolean;
  repeat_every?: number;
  repeat_cycles?: number;
  repeat_type?: WsRepeatType;
  send_reminder: boolean;
  remind_time?: number;
  remind_type?: WsRemindType;
  google_calendar: boolean;
  online_link?: string;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export type WsEventAttendeeStatus = 'yes' | 'no' | 'maybe' | 'pending';

export interface WsEventAttendee {
  _id?: string;
  userId?: string;
  event_id: string;
  user_id: string;
  user_name?: string;
  status: WsEventAttendeeStatus;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export interface WsEventFile {
  _id?: string;
  userId?: string;
  event_id: string;
  filename: string;
  url: string;
  size?: number;
  createdAt?: WsDateLike;
}

/* ───────────────── Discussions ───────────────── */

export interface WsDiscussion {
  _id?: string;
  userId?: string;
  title: string;
  description?: string;
  category_id?: string;
  category_name?: string;
  project_id?: string;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export interface WsDiscussionCategory {
  _id?: string;
  userId?: string;
  name: string;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export interface WsDiscussionReply {
  _id?: string;
  userId?: string;
  discussion_id: string;
  user_id: string;
  user_name: string;
  body: string;
  parent_reply_id?: string;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export interface WsDiscussionFile {
  _id?: string;
  userId?: string;
  discussion_id: string;
  filename: string;
  url: string;
  size?: number;
  createdAt?: WsDateLike;
}

/* ───────────────── Awards & Appreciations ───────────────── */

export type WsAwardFrequency = 'one-time' | 'monthly' | 'quarterly' | 'annual';

export interface WsAward {
  _id?: string;
  userId?: string;
  title: string;
  summary?: string;
  icon: string;
  frequency: WsAwardFrequency;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export interface WsAwardIcon {
  _id?: string;
  icon: string;
}

export interface WsAppreciation {
  _id?: string;
  userId?: string;
  award_id: string;
  award_title?: string;
  given_to_user_id: string;
  given_to_user_name?: string;
  given_by_user_id: string;
  given_by_user_name?: string;
  given_on: WsDateLike;
  summary?: string;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

/* ───────────────── Sticky Notes ───────────────── */

export type WsStickyNoteColour = 'yellow' | 'rose' | 'blue' | 'green';

export interface WsStickyNote {
  _id?: string;
  userId?: string;
  colour: WsStickyNoteColour;
  note_text: string;
  belongs_to_user_id: string;
  pinned?: boolean;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}
