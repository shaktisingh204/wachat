/**
 * SabSMS — shared types.
 *
 * These are the source-of-truth shapes for everything that crosses
 * process boundaries between Next.js and the Rust engine. The Rust side
 * mirrors these in `services/sabsms-engine/src/types.rs` — keep them in
 * sync (the JSON wire format is `camelCase`).
 */

import type { ObjectId } from 'mongodb';

// ─── Primitive enums ──────────────────────────────────────────────────────

export type SabsmsChannel = 'sms' | 'mms' | 'rcs';

export type SabsmsDirection = 'outbound' | 'inbound';

export type SabsmsMessageStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'undelivered'
  | 'rejected'
  | 'suppressed';

export type SabsmsMessageCategory =
  | 'transactional'
  | 'otp'
  | 'marketing'
  | 'alert'
  | 'service';

export type SabsmsProviderId =
  | 'twilio'
  | 'vonage'
  | 'messagebird'
  | 'plivo'
  | 'sinch'
  | 'infobip'
  | 'aws_sns'
  | 'telnyx'
  | 'msg91'
  | 'gupshup'
  | 'textlocal'
  | 'kaleyra'
  | 'karix';

export type SabsmsNumberType =
  | 'longcode'
  | 'shortcode'
  | 'tollfree'
  | 'alphanumeric';

export type SabsmsTemplateCategory =
  | 'transactional'
  | 'otp'
  | 'marketing'
  | 'alert'
  | 'service';

export type SabsmsTemplateStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected';

export type SabsmsCampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type SabsmsConversationStatus = 'open' | 'snoozed' | 'closed';

export type SabsmsConsentKind =
  | 'opt_in_single'
  | 'opt_in_double'
  | 'opt_out_stop'
  | 'opt_out_manual'
  | 'opt_out_complaint'
  | 'opt_out_carrier_block'
  | 'opt_in_restart';

export type SabsmsSuppressionSource =
  | 'stop'
  | 'complaint'
  | 'bounce'
  | 'manual'
  | 'carrier_block'
  | 'import';

// ─── Documents ────────────────────────────────────────────────────────────

export interface SabsmsNumber {
  _id?: ObjectId;
  workspaceId: string;
  e164: string;
  country: string; // ISO 3166-1 alpha-2
  type: SabsmsNumberType;
  provider: SabsmsProviderId;
  providerNumberId?: string;
  capabilities: {
    sms: boolean;
    mms: boolean;
    rcs: boolean;
    voice: boolean;
  };
  status: 'active' | 'pending' | 'releasing' | 'released';
  monthlyCost?: number; // in cents, USD
  createdAt: Date;
  releasedAt?: Date;
}

export interface SabsmsProviderAccount {
  _id?: ObjectId;
  workspaceId: string;
  provider: SabsmsProviderId;
  /** Encrypted credential blob (envelope encryption per workspace). */
  credentialsCipher: string;
  region?: string;
  /** When true, this account is the default sender for the provider. */
  isDefault: boolean;
  status: 'active' | 'disabled' | 'error';
  lastErrorAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SabsmsMedia {
  /** SabFiles file id or share token — never a free-text URL. */
  sabFileId: string;
  mime: string;
  bytes: number;
}

export interface SabsmsMessage {
  _id?: ObjectId;
  workspaceId: string;
  /** Stable client-supplied or engine-generated key. */
  idempotencyKey?: string;
  direction: SabsmsDirection;
  channel: SabsmsChannel;
  from: string;
  to: string;
  body: string;
  media?: SabsmsMedia[];
  category: SabsmsMessageCategory;
  status: SabsmsMessageStatus;
  errorCode?: string;
  errorMessage?: string;
  provider: SabsmsProviderId;
  providerAccountId?: string;
  providerMessageId?: string;
  templateId?: string;
  campaignId?: string;
  conversationId?: string;
  contactId?: string;
  /** Generic correlation key, e.g. for CRM dispatches. */
  eventKey?: string;
  segmentsCount?: number;
  /** Customer-facing price in cents (USD). */
  price?: number;
  /** Wholesale cost in cents (USD) — for margin reporting. */
  cost?: number;
  tags?: string[];
  queuedAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SabsmsConversation {
  _id?: ObjectId;
  workspaceId: string;
  contactId: string;
  channel: SabsmsChannel;
  status: SabsmsConversationStatus;
  unreadCount: number;
  assignedAgentId?: string;
  labels?: string[];
  lastMessagePreview?: string;
  lastMessageAt?: Date;
  snoozedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SabsmsTemplateBody {
  locale: string; // e.g. 'en', 'hi'
  body: string;
}

export interface SabsmsTemplate {
  _id?: ObjectId;
  workspaceId: string;
  name: string;
  category: SabsmsTemplateCategory;
  bodies: SabsmsTemplateBody[];
  variables?: string[];
  status: SabsmsTemplateStatus;
  reviewerNotes?: string;
  /** India — DLT registration fields. */
  dlt?: {
    principalEntityId?: string;
    templateId?: string;
    headerId?: string;
    contentCategory?: string;
  };
  /** US — 10DLC fields. */
  tendlc?: {
    brandId?: string;
    campaignId?: string;
    useCase?: string;
    sampleMessages?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SabsmsCampaign {
  _id?: ObjectId;
  workspaceId: string;
  name: string;
  templateId: string;
  audience:
    | { kind: 'segment'; segmentId: string }
    | { kind: 'contacts'; contactIds: string[] }
    | { kind: 'csv'; sabFileId: string };
  schedule:
    | { kind: 'immediate' }
    | { kind: 'scheduled'; sendAt: Date }
    | { kind: 'recurring'; cron: string }
    | { kind: 'drip'; dripId: string };
  throttlePerSecond?: number;
  senderStrategy: 'single' | 'pool' | 'sticky_per_recipient';
  senderNumberIds?: string[];
  category: SabsmsMessageCategory;
  status: SabsmsCampaignStatus;
  stats: {
    total: number;
    queued: number;
    sent: number;
    delivered: number;
    failed: number;
    replied: number;
    clicked: number;
    unsubscribed: number;
  };
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SabsmsDripStep {
  templateId: string;
  waitSeconds: number;
  conditions?: Array<{ kind: 'replied' | 'clicked' | 'opened'; within: number }>;
}

export interface SabsmsDrip {
  _id?: ObjectId;
  workspaceId: string;
  name: string;
  steps: SabsmsDripStep[];
  entryTrigger:
    | { kind: 'manual' }
    | { kind: 'segment_join'; segmentId: string }
    | { kind: 'event'; eventKey: string };
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SabsmsSuppression {
  _id?: ObjectId;
  workspaceId: string;
  /** SHA-256 of the E.164 phone, lowercase hex. Storing only the hash keeps
   *  the suppression list usable after a GDPR erasure request. */
  phoneHash: string;
  source: SabsmsSuppressionSource;
  reason?: string;
  createdAt: Date;
}

export interface SabsmsConsentEvent {
  _id?: ObjectId;
  workspaceId: string;
  phoneHash: string;
  kind: SabsmsConsentKind;
  /** Where the consent (or opt-out) was captured. */
  captureMethod: 'web_form' | 'api' | 'import' | 'verbal' | 'inbound_keyword';
  source?: string;
  ip?: string;
  userAgent?: string;
  doubleOptInVerifiedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface SabsmsWebhookOut {
  _id?: ObjectId;
  workspaceId: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SabsmsWebhookDelivery {
  _id?: ObjectId;
  workspaceId: string;
  webhookId: string;
  event: string;
  payload: unknown;
  attempts: Array<{
    attemptedAt: Date;
    status: number;
    responseSnippet?: string;
    error?: string;
  }>;
  status: 'pending' | 'delivered' | 'failed';
  createdAt: Date;
  deliveredAt?: Date;
}

export interface SabsmsShortLink {
  _id?: ObjectId;
  workspaceId: string;
  slug: string;
  target: string;
  campaignId?: string;
  contactId?: string;
  messageId?: string;
  clickCount: number;
  createdAt: Date;
}

export interface SabsmsLinkClick {
  _id?: ObjectId;
  workspaceId: string;
  shortLinkId: string;
  campaignId?: string;
  contactId?: string;
  ip?: string;
  userAgent?: string;
  clickedAt: Date;
}

// ─── HTTP contract: Next ↔ Rust engine ────────────────────────────────────

export interface EnqueueSendInput {
  workspaceId: string;
  to: string;
  body: string;
  category: SabsmsMessageCategory;
  channel?: SabsmsChannel;
  from?: string;
  /** When supplied, the engine looks the credential up by provider+account. */
  providerAccountId?: string;
  provider?: SabsmsProviderId;
  senderId?: string;
  templateId?: string;
  templatePrefix?: string;
  campaignId?: string;
  contactId?: string;
  eventKey?: string;
  media?: SabsmsMedia[];
  idempotencyKey?: string;
  tags?: string[];
}

export interface EnqueueSendResult {
  id: string;
  status: SabsmsMessageStatus;
  segments?: number;
  estimatedCost?: number;
}

export interface CreditReserveRequest {
  workspaceId: string;
  messageId: string;
  segments: number;
  estimatedCost: number;
  category: SabsmsMessageCategory;
  destinationCountry: string;
}

export interface CreditReserveResponse {
  /** Token returned to the engine — must be presented to finalise/release. */
  reservationToken: string;
  approved: boolean;
  reason?: string;
}

export interface CreditFinaliseRequest {
  workspaceId: string;
  messageId: string;
  reservationToken: string;
  actualCost: number;
  /** When false, the reservation is released (no charge). */
  charge: boolean;
}
