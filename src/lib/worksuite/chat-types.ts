/**
 * Worksuite internal chat / mentions / notifications / invitations / activity.
 *
 * Ported from Worksuite PHP/Laravel models:
 *   - UserChat          -> WsUserChat
 *   - UserchatFile      -> WsUserchatFile
 *   - MentionUser       -> WsMentionUser
 *   - UserActivity      -> WsUserActivity
 *   - Notification      -> WsNotification
 *   - UserInvitation    -> WsUserInvitation
 *
 * Tenant isolation uses `userId` (owning tenant ObjectId string on the wire).
 * Server-managed fields `_id`, `createdAt`, `updatedAt` are included for
 * client round-trip.
 */

export type WsChatDateLike = string | Date;

/* ──────────────────── 1:1 / Group chat ──────────────────── */

export interface WsUserChat {
  _id?: string;
  userId?: string;
  from_user_id: string;
  to_user_id: string;
  message: string;
  is_read: boolean;
  /** `null` for direct DMs; set for group chats. */
  group_id?: string | null;
  createdAt?: WsChatDateLike;
  updatedAt?: WsChatDateLike;
}

export interface WsUserchatFile {
  _id?: string;
  userId?: string;
  chat_id: string;
  filename: string;
  url: string;
  size: number;
  mime_type?: string;
  createdAt?: WsChatDateLike;
}

/* ──────────────────── Mentions ──────────────────── */

export type WsMentionResourceType =
  | 'task'
  | 'project'
  | 'lead'
  | 'deal'
  | 'discussion'
  | 'comment';

export interface WsMentionUser {
  _id?: string;
  userId?: string;
  resource_type: WsMentionResourceType;
  resource_id: string;
  mentioned_user_id: string;
  mentioner_user_id: string;
  body?: string;
  read_at?: WsChatDateLike | null;
  createdAt?: WsChatDateLike;
  updatedAt?: WsChatDateLike;
}

/* ──────────────────── User Activity Log ──────────────────── */

export interface WsUserActivity {
  _id?: string;
  userId?: string;
  actor_user_id: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  occurred_at: WsChatDateLike;
  createdAt?: WsChatDateLike;
  updatedAt?: WsChatDateLike;
}

/* ──────────────────── Notifications ──────────────────── */

export interface WsNotification {
  _id?: string;
  userId?: string;
  recipient_user_id: string;
  type: string;
  title: string;
  body?: string;
  resource_type?: string;
  resource_id?: string;
  read_at?: WsChatDateLike | null;
  createdAt?: WsChatDateLike;
  updatedAt?: WsChatDateLike;
}

/* ──────────────────── User Invitations ──────────────────── */

export type WsUserInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'expired'
  | 'revoked';

export interface WsUserInvitation {
  _id?: string;
  userId?: string;
  email: string;
  role_id?: string;
  invited_by_user_id: string;
  token: string;
  accepted_at?: WsChatDateLike | null;
  expires_at?: WsChatDateLike | null;
  status: WsUserInvitationStatus;
  createdAt?: WsChatDateLike;
  updatedAt?: WsChatDateLike;
}

/* ──────────────────── View-model helpers ──────────────────── */

/**
 * Derived shape used by `listConversations()` — one entry per distinct
 * peer with the most recent message and the unread-from-peer count.
 */
export interface WsConversationSummary {
  peer_user_id: string;
  last_message: string;
  last_message_at?: WsChatDateLike;
  last_from_user_id: string;
  unread_count: number;
}
