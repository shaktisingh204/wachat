/**
 * SabWa — Mongo collection types.
 *
 * Source of truth: `SABWA_PLAN.md` § 3 (Mongo data model).
 * All collections live under the `sabwa_` prefix and are scoped per
 * `projectId` for multi-tenancy.
 */

import type { Binary, ObjectId } from 'mongodb';

// ─── Shared primitives ──────────────────────────────────────────────────────

export type SabwaSessionStatus =
  | 'pending'
  | 'connected'
  | 'logged_out'
  | 'banned'
  | 'error';

export type SabwaPairMethod = 'qr' | 'code';

export type SabwaRateLimitProfile = 'safe' | 'normal' | 'aggressive';

export type SabwaChatType = 'individual' | 'group' | 'broadcast' | 'status';

export type SabwaMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'poll'
  | 'reaction'
  | 'system';

export type SabwaMessageStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export type SabwaScheduledKind = 'one_off' | 'recurring';

export type SabwaScheduledStatus = 'pending' | 'paused' | 'sent' | 'failed' | 'cancelled';

export type SabwaScheduledTargetType = 'individual' | 'group' | 'broadcast';

export type SabwaBroadcastStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted';

export type SabwaWebhookEvent =
  | 'message.received'
  | 'message.status'
  | 'chat.updated'
  | 'group.joined'
  | 'group.left'
  | 'session.connected'
  | 'session.disconnected'
  | 'scheduled.fired';

export type SabwaBanSignalKind =
  | 'delivery_failure'
  | 'blocked_by_recipient'
  | 'missing_ack'
  | 'stream_error'
  | 'logout_remote'
  | 'velocity_breach';

export interface SabwaBanSignal {
  ts: Date;
  kind: SabwaBanSignalKind;
  detail?: string;
}

export interface SabwaDeviceMeta {
  platform?: string;
  appVersion?: string;
  batteryLevel?: number;
}

// ─── sabwa_sessions ─────────────────────────────────────────────────────────

export interface SabwaSession {
  _id: ObjectId;
  projectId: ObjectId;
  userId: ObjectId;
  phoneE164?: string;
  pushName?: string;
  profilePicUrl?: string;
  status: SabwaSessionStatus;
  pairMethod: SabwaPairMethod;
  authState?: Binary;
  deviceMeta?: SabwaDeviceMeta;
  lastConnectedAt?: Date;
  lastSeenAt?: Date;
  workerNodeId?: string;
  banSignals: SabwaBanSignal[];
  rateLimitProfile: SabwaRateLimitProfile;
  warmupEnabled?: boolean;
  label?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── sabwa_chats ────────────────────────────────────────────────────────────

export interface SabwaChatLastMessage {
  id: string;
  body: string;
  ts: Date;
  fromMe: boolean;
}

export interface SabwaChat {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId: ObjectId;
  jid: string;
  type: SabwaChatType;
  name?: string;
  profilePicUrl?: string;
  lastMessage?: SabwaChatLastMessage;
  unreadCount: number;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  muteEndAt?: Date;
  labels: ObjectId[];
  isReadOnly?: boolean;
  participants?: number;
  updatedAt: Date;
}

// ─── sabwa_messages ─────────────────────────────────────────────────────────

export interface SabwaReaction {
  jid: string;
  emoji: string;
  ts: Date;
}

export interface SabwaMessage {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId: ObjectId;
  chatJid: string;
  messageId: string;
  fromJid: string;
  fromMe: boolean;
  type: SabwaMessageType;
  body?: string;
  mediaUrl?: string;
  mediaMime?: string;
  mediaSize?: number;
  caption?: string;
  quotedMessageId?: string;
  reactions: SabwaReaction[];
  status: SabwaMessageStatus;
  forwarded?: boolean;
  starred?: boolean;
  ts: Date;
  editedAt?: Date;
  deletedAt?: Date;
}

// ─── sabwa_groups ───────────────────────────────────────────────────────────

export interface SabwaGroupParticipant {
  jid: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  joinedAt?: Date;
}

export interface SabwaGroup {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId: ObjectId;
  jid: string;
  subject: string;
  description?: string;
  creator?: string;
  createdAt?: Date;
  participants: SabwaGroupParticipant[];
  inviteCode?: string;
  announcement?: boolean;
  restrict?: boolean;
  ephemeralDuration?: number;
  category?: string;
  updatedAt: Date;
}

// ─── sabwa_contacts ─────────────────────────────────────────────────────────

export interface SabwaContact {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId: ObjectId;
  jid: string;
  phoneE164?: string;
  name?: string;
  pushName?: string;
  profilePicUrl?: string;
  isBusiness: boolean;
  isBlocked: boolean;
  isMyContact: boolean;
  tags: string[];
  customFields?: Record<string, string>;
  notes?: string;
  lastInteractionAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── sabwa_scheduled ────────────────────────────────────────────────────────

export interface SabwaScheduledTarget {
  jid: string;
  type: SabwaScheduledTargetType;
}

export interface SabwaScheduledPayload {
  type: SabwaMessageType;
  body?: string;
  mediaSabFileId?: string;
  caption?: string;
  mentionAll?: boolean;
}

export interface SabwaScheduled {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId: ObjectId;
  kind: SabwaScheduledKind;
  scheduledFor: Date;
  cron?: string;
  timezone: string;
  targets: SabwaScheduledTarget[];
  payload: SabwaScheduledPayload;
  status: SabwaScheduledStatus;
  attemptCount: number;
  lastError?: string;
  sentAt?: Date;
  bullJobId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── sabwa_templates ────────────────────────────────────────────────────────

export type SabwaTemplateApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'UNMAPPED';

export interface SabwaTemplate {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId?: ObjectId;
  name: string;
  category?: string;
  body: string;
  variables: string[];
  mediaSabFileId?: string;
  usageCount: number;
  approvalStatus?: SabwaTemplateApprovalStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ─── sabwa_quick_replies ────────────────────────────────────────────────────

export interface SabwaQuickReply {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId?: ObjectId;
  shortcut: string;
  body: string;
  mediaSabFileId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── sabwa_auto_replies ─────────────────────────────────────────────────────

export type SabwaAutoReplyTriggerKind =
  | 'keyword'
  | 'contains'
  | 'contains_all'
  | 'contains_any'
  | 'regex'
  | 'time_window'
  | 'contact_label'
  | 'outside_business_hours'
  | 'first_message_from_new_contact';

export type SabwaAutoReplyActionKind =
  | 'send_template'
  | 'send_message'
  | 'forward_to_flow'
  | 'set_away_message'
  | 'add_label'
  | 'set_label';

export interface SabwaAutoReplyTrigger {
  kind: SabwaAutoReplyTriggerKind;
  value?: string;
  start?: string;
  end?: string;
  daysOfWeek?: number[];
}

export interface SabwaAutoReplyAction {
  kind: SabwaAutoReplyActionKind;
  templateId?: ObjectId | string;
  flowId?: ObjectId | string;
  labelId?: ObjectId | string;
  message?: string;
}

export interface SabwaAutoReply {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId: ObjectId;
  name: string;
  enabled: boolean;
  triggers: SabwaAutoReplyTrigger[];
  actions: SabwaAutoReplyAction[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── sabwa_broadcasts ───────────────────────────────────────────────────────

export interface SabwaBroadcastRecipientStatus {
  jid: string;
  status: SabwaMessageStatus | 'queued' | 'skipped';
  error?: string;
  sentAt?: Date;
}

export interface SabwaBroadcast {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId: ObjectId;
  name: string;
  status: SabwaBroadcastStatus;
  payload: SabwaScheduledPayload;
  recipients: SabwaBroadcastRecipientStatus[];
  perMinute?: number;
  jitterSec?: number;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── sabwa_labels ───────────────────────────────────────────────────────────

export interface SabwaLabel {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId?: ObjectId;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── sabwa_webhooks ─────────────────────────────────────────────────────────

export interface SabwaWebhook {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId?: ObjectId;
  url: string;
  events: SabwaWebhookEvent[];
  signingSecret: string;
  enabled: boolean;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── sabwa_audit_log ────────────────────────────────────────────────────────

export interface SabwaAuditLog {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId?: ObjectId;
  actorId: ObjectId;
  actorEmail?: string;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  ts: Date;
}

// ─── sabwa_api_keys ─────────────────────────────────────────────────────────

export interface SabwaApiKey {
  _id: ObjectId;
  projectId: ObjectId;
  name: string;
  keyHash: string;
  keyPreview: string;
  scopes: string[];
  lastUsedAt?: Date;
  revokedAt?: Date;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}


// ─── sabwa_statuses ────────────────────────────────────────────────────────
export interface SabwaStatus {
  _id: import('mongodb').ObjectId;
  projectId: import('mongodb').ObjectId;
  sessionId: import('mongodb').ObjectId;
  kind: 'text' | 'media';
  body?: string;
  bgColour?: string;
  mediaUrl?: string;
  mediaName?: string;
  audience: 'everyone' | 'except' | 'only';
  viewers: { jid: string; name: string; ts: Date }[];
  reposters: { jid: string; name: string }[];
  ts: Date;
}

