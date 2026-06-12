import 'server-only';

import { z } from 'zod';
import { type Collection, type Db, type IndexSpecification, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type {
  SabsmsCampaign,
  SabsmsConsentEvent,
  SabsmsConversation,
  SabsmsDrip,
  SabsmsLinkClick,
  SabsmsMessage,
  SabsmsNumber,
  SabsmsProviderAccount,
  SabsmsSettings,
  SabsmsShortLink,
  SabsmsSuppression,
  SabsmsTemplate,
  SabsmsWebhookDelivery,
  SabsmsWebhookOut,
} from '../types';

/**
 * Typed accessors for every collection owned by SabSMS.
 *
 * The Rust engine (`services/sabsms-engine/`) writes the canonical
 * documents — Next.js reads them and writes UX-layer state (campaigns
 * the user is composing, suppressions added through the dashboard,
 * webhook endpoints, etc.). All shared shapes live in `../types.ts` so
 * the Rust JSON contract and the TypeScript surface stay in sync.
 */

export const SABSMS_COLLECTIONS = {
  numbers: 'sabsms_numbers',
  providerAccounts: 'sabsms_provider_accounts',
  messages: 'sabsms_messages',
  conversations: 'sabsms_conversations',
  templates: 'sabsms_templates',
  campaigns: 'sabsms_campaigns',
  drips: 'sabsms_drips',
  suppressions: 'sabsms_suppressions',
  consentLog: 'sabsms_consent_log',
  webhooksOut: 'sabsms_webhooks_out',
  webhookDeliveries: 'sabsms_webhook_deliveries',
  shortLinks: 'sabsms_short_links',
  linkClicks: 'sabsms_link_clicks',
  settings: 'sabsms_settings',
  routingPolicies: 'sabsms_routing_policies',
} as const;

export type SabsmsCollectionName =
  (typeof SABSMS_COLLECTIONS)[keyof typeof SABSMS_COLLECTIONS];

export interface SabsmsCollections {
  numbers: Collection<SabsmsNumber>;
  providerAccounts: Collection<SabsmsProviderAccount>;
  messages: Collection<SabsmsMessage>;
  conversations: Collection<SabsmsConversation>;
  templates: Collection<SabsmsTemplate>;
  campaigns: Collection<SabsmsCampaign>;
  drips: Collection<SabsmsDrip>;
  suppressions: Collection<SabsmsSuppression>;
  consentLog: Collection<SabsmsConsentEvent>;
  webhooksOut: Collection<SabsmsWebhookOut>;
  webhookDeliveries: Collection<SabsmsWebhookDelivery>;
  shortLinks: Collection<SabsmsShortLink>;
  linkClicks: Collection<SabsmsLinkClick>;
  settings: Collection<SabsmsSettings>;
  routingPolicies: Collection<SabsmsRoutingPolicyDoc>;
}

export async function getSabsmsCollections(): Promise<{
  db: Db;
  cols: SabsmsCollections;
}> {
  const { db } = await connectToDatabase();
  const cols: SabsmsCollections = {
    numbers: db.collection<SabsmsNumber>(SABSMS_COLLECTIONS.numbers),
    providerAccounts: db.collection<SabsmsProviderAccount>(
      SABSMS_COLLECTIONS.providerAccounts,
    ),
    messages: db.collection<SabsmsMessage>(SABSMS_COLLECTIONS.messages),
    conversations: db.collection<SabsmsConversation>(
      SABSMS_COLLECTIONS.conversations,
    ),
    templates: db.collection<SabsmsTemplate>(SABSMS_COLLECTIONS.templates),
    campaigns: db.collection<SabsmsCampaign>(SABSMS_COLLECTIONS.campaigns),
    drips: db.collection<SabsmsDrip>(SABSMS_COLLECTIONS.drips),
    suppressions: db.collection<SabsmsSuppression>(
      SABSMS_COLLECTIONS.suppressions,
    ),
    consentLog: db.collection<SabsmsConsentEvent>(
      SABSMS_COLLECTIONS.consentLog,
    ),
    webhooksOut: db.collection<SabsmsWebhookOut>(SABSMS_COLLECTIONS.webhooksOut),
    webhookDeliveries: db.collection<SabsmsWebhookDelivery>(
      SABSMS_COLLECTIONS.webhookDeliveries,
    ),
    shortLinks: db.collection<SabsmsShortLink>(SABSMS_COLLECTIONS.shortLinks),
    linkClicks: db.collection<SabsmsLinkClick>(SABSMS_COLLECTIONS.linkClicks),
    settings: db.collection<SabsmsSettings>(SABSMS_COLLECTIONS.settings),
    routingPolicies: db.collection<SabsmsRoutingPolicyDoc>(
      SABSMS_COLLECTIONS.routingPolicies,
    ),
  };
  return { db, cols };
}

/**
 * Index spec executed at boot (idempotent — `createIndexes` is a no-op if
 * the index already exists with the same definition).
 *
 * Tuple form is `[spec, options?]`.
 */
const INDEXES: Record<
  keyof SabsmsCollections,
  Array<[IndexSpecification, Record<string, unknown>?]>
> = {
  numbers: [
    [{ workspaceId: 1, status: 1 }],
    [{ e164: 1 }, { unique: true }],
  ],
  providerAccounts: [
    [{ workspaceId: 1, provider: 1 }],
    [{ workspaceId: 1, isDefault: 1 }],
  ],
  messages: [
    [{ workspaceId: 1, status: 1, queuedAt: -1 }],
    [
      { idempotencyKey: 1 },
      { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
    ],
    [
      { provider: 1, providerMessageId: 1 },
      { unique: true, partialFilterExpression: { providerMessageId: { $type: 'string' } } },
    ],
    [{ workspaceId: 1, conversationId: 1, createdAt: -1 }],
    [{ workspaceId: 1, campaignId: 1, status: 1 }],
  ],
  conversations: [
    [{ workspaceId: 1, status: 1, lastMessageAt: -1 }],
    [{ workspaceId: 1, contactId: 1, channel: 1 }, { unique: true }],
  ],
  templates: [
    [{ workspaceId: 1, status: 1, category: 1 }],
    [{ workspaceId: 1, name: 1 }, { unique: true }],
  ],
  campaigns: [
    [{ workspaceId: 1, status: 1, scheduledAt: 1 }],
    [{ workspaceId: 1, createdAt: -1 }],
  ],
  drips: [[{ workspaceId: 1, enabled: 1 }]],
  suppressions: [
    [{ workspaceId: 1, phoneHash: 1 }, { unique: true }],
    [{ workspaceId: 1, source: 1, createdAt: -1 }],
    [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
  ],
  consentLog: [
    [{ workspaceId: 1, phoneHash: 1, createdAt: -1 }],
    [{ workspaceId: 1, kind: 1, createdAt: -1 }],
  ],
  webhooksOut: [[{ workspaceId: 1, isActive: 1 }]],
  webhookDeliveries: [
    [{ workspaceId: 1, webhookId: 1, createdAt: -1 }],
    // TTL — drop webhook delivery records after 90 days.
    [{ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }],
  ],
  shortLinks: [
    [{ slug: 1 }, { unique: true }],
    [{ workspaceId: 1, campaignId: 1 }],
  ],
  linkClicks: [
    [{ shortLinkId: 1, clickedAt: -1 }],
    [{ workspaceId: 1, campaignId: 1, clickedAt: -1 }],
  ],
  settings: [[{ workspaceId: 1 }, { unique: true }]],
  routingPolicies: [[{ workspaceId: 1 }, { unique: true }]],
};

let indexesEnsured = false;

/**
 * Idempotently create every SabSMS index. Called once during the first
 * access; safe to call repeatedly.
 */
export async function ensureSabsmsIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const { cols } = await getSabsmsCollections();
  await Promise.all(
    (Object.entries(INDEXES) as Array<
      [keyof SabsmsCollections, Array<[IndexSpecification, Record<string, unknown>?]>]
    >).map(async ([name, specs]) => {
      const collection = cols[name];
      for (const [spec, options] of specs) {
        await collection.createIndex(spec, options ?? {});
      }
    }),
  );
  indexesEnsured = true;
}


export const SabsmsChannelSchema = z.enum(['sms', 'mms', 'rcs']);
export const SabsmsDirectionSchema = z.enum(['outbound', 'inbound']);
export const SabsmsMessageStatusSchema = z.enum([
  'queued',
  'sending',
  'sent',
  'delivered',
  'failed',
  'undelivered',
  'rejected',
  'suppressed',
]);
export const SabsmsMessageCategorySchema = z.enum([
  'transactional',
  'otp',
  'marketing',
  'alert',
  'service',
]);
export const SabsmsProviderIdSchema = z.enum([
  'twilio',
  'vonage',
  'messagebird',
  'plivo',
  'sinch',
  'infobip',
  'aws_sns',
  'telnyx',
  'msg91',
  'gupshup',
  'textlocal',
  'kaleyra',
  'karix',
]);
export const SabsmsNumberTypeSchema = z.enum([
  'longcode',
  'shortcode',
  'tollfree',
  'alphanumeric',
]);
export const SabsmsTemplateCategorySchema = z.enum([
  'transactional',
  'otp',
  'marketing',
  'alert',
  'service',
]);
export const SabsmsTemplateStatusSchema = z.enum([
  'draft',
  'submitted',
  'approved',
  'rejected',
]);
export const SabsmsCampaignStatusSchema = z.enum([
  'draft',
  'scheduled',
  'running',
  'paused',
  'completed',
  'cancelled',
  'failed',
]);
export const SabsmsConversationStatusSchema = z.enum(['open', 'snoozed', 'closed']);
export const SabsmsConsentKindSchema = z.enum([
  'opt_in_single',
  'opt_in_double',
  'opt_out_stop',
  'opt_out_manual',
  'opt_out_complaint',
  'opt_out_carrier_block',
  'opt_in_restart',
]);
export const SabsmsSuppressionSourceSchema = z.enum([
  'stop',
  'complaint',
  'bounce',
  'manual',
  'carrier_block',
  'import',
]);

export const SabsmsNumberSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  e164: z.string(),
  country: z.string(),
  type: SabsmsNumberTypeSchema,
  provider: SabsmsProviderIdSchema,
  providerNumberId: z.string().optional(),
  capabilities: z.object({
    sms: z.boolean(),
    mms: z.boolean(),
    rcs: z.boolean(),
    voice: z.boolean(),
  }),
  status: z.enum(['active', 'pending', 'releasing', 'released']),
  monthlyCost: z.number().optional(),
  webhookUrl: z.string().optional(),
  routingUrl: z.string().optional(),
  senderId: z.string().optional(),
  dltHeaderId: z.string().optional(),
  createdAt: z.date(),
  releasedAt: z.date().optional(),
});

/** Mirrors `SabsmsAvailableNumber` — one `POST /v1/numbers/search` result. */
export const SabsmsAvailableNumberSchema = z.object({
  phoneNumber: z.string(),
  friendlyName: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  type: z.enum(['longcode', 'tollfree', 'mobile']),
  capabilities: z.object({
    sms: z.boolean(),
    mms: z.boolean(),
    rcs: z.boolean(),
    voice: z.boolean(),
  }),
  monthlyCost: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
});

export const SabsmsProviderAccountSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  provider: SabsmsProviderIdSchema,
  credentialsCipher: z.string(),
  region: z.string().optional(),
  isDefault: z.boolean(),
  webhookSecret: z.string().optional(),
  status: z.enum(['active', 'disabled', 'error']),
  lastErrorAt: z.date().optional(),
  lastError: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SabsmsMediaSchema = z.object({
  sabFileId: z.string(),
  mime: z.string(),
  bytes: z.number(),
});

export const SabsmsMessageSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  idempotencyKey: z.string().optional(),
  direction: SabsmsDirectionSchema,
  channel: SabsmsChannelSchema,
  from: z.string(),
  to: z.string(),
  body: z.string(),
  media: z.array(SabsmsMediaSchema).optional(),
  mediaUrls: z.array(z.string()).optional(),
  category: SabsmsMessageCategorySchema,
  status: SabsmsMessageStatusSchema,
  errorCode: z.string().optional(),
  normalizedCode: z.string().optional(),
  errorMessage: z.string().optional(),
  provider: SabsmsProviderIdSchema,
  providerAccountId: z.string().optional(),
  providerMessageId: z.string().optional(),
  templateId: z.string().optional(),
  campaignId: z.string().optional(),
  conversationId: z.string().optional(),
  contactId: z.string().optional(),
  eventKey: z.string().optional(),
  senderId: z.string().optional(),
  dltEntityId: z.string().optional(),
  dltTemplateId: z.string().optional(),
  segmentsCount: z.number().optional(),
  price: z.number().optional(),
  cost: z.number().optional(),
  tags: z.array(z.string()).optional(),
  queuedAt: z.date().optional(),
  sentAt: z.date().optional(),
  deliveredAt: z.date().optional(),
  failedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SabsmsConversationSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  contactId: z.string(),
  channel: SabsmsChannelSchema,
  status: SabsmsConversationStatusSchema,
  unreadCount: z.number(),
  assignedAgentId: z.string().optional(),
  labels: z.array(z.string()).optional(),
  lastMessagePreview: z.string().optional(),
  lastMessageAt: z.date().optional(),
  snoozedUntil: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SabsmsTemplateBodySchema = z.object({
  locale: z.string(),
  body: z.string(),
});

export const SabsmsTemplateSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  name: z.string(),
  category: SabsmsTemplateCategorySchema,
  bodies: z.array(SabsmsTemplateBodySchema),
  variables: z.array(z.string()).optional(),
  status: SabsmsTemplateStatusSchema,
  reviewerNotes: z.string().optional(),
  dlt: z.object({
    principalEntityId: z.string().optional(),
    templateId: z.string().optional(),
    headerId: z.string().optional(),
    contentCategory: z.string().optional(),
  }).optional(),
  tendlc: z.object({
    brandId: z.string().optional(),
    campaignId: z.string().optional(),
    useCase: z.string().optional(),
    sampleMessages: z.array(z.string()).optional(),
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SabsmsCampaignSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  name: z.string(),
  templateId: z.string(),
  audience: z.union([
    z.object({ kind: z.literal('segment'), segmentId: z.string() }),
    z.object({ kind: z.literal('list'), listId: z.string() }),
    z.object({ kind: z.literal('contacts'), contactIds: z.array(z.string()) }),
    z.object({ kind: z.literal('phones'), phones: z.array(z.string()) }),
    z.object({
      kind: z.literal('csv'),
      sabFileId: z.string().optional(),
      importId: z.string().optional(),
    }),
  ]),
  schedule: z.union([
    z.object({ kind: z.literal('immediate') }),
    z.object({ kind: z.literal('scheduled'), sendAt: z.date() }),
    z.object({ kind: z.literal('recurring'), cron: z.string() }),
    z.object({ kind: z.literal('drip'), dripId: z.string() }),
  ]),
  throttlePerSecond: z.number().optional(),
  senderStrategy: z.enum(['single', 'pool', 'sticky_per_recipient']),
  senderNumberIds: z.array(z.string()).optional(),
  category: SabsmsMessageCategorySchema,
  status: SabsmsCampaignStatusSchema,
  stats: z.object({
    total: z.number(),
    queued: z.number(),
    sent: z.number(),
    delivered: z.number(),
    failed: z.number(),
    replied: z.number(),
    clicked: z.number(),
    unsubscribed: z.number(),
  }),
  scheduledAt: z.date().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SabsmsDripStepSchema = z.object({
  templateId: z.string(),
  waitSeconds: z.number(),
  conditions: z.array(z.object({
    kind: z.enum(['replied', 'clicked', 'opened']),
    within: z.number(),
  })).optional(),
});

export const SabsmsDripSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  name: z.string(),
  steps: z.array(SabsmsDripStepSchema),
  entryTrigger: z.union([
    z.object({ kind: z.literal('manual') }),
    z.object({ kind: z.literal('segment_join'), segmentId: z.string() }),
    z.object({ kind: z.literal('event'), eventKey: z.string() }),
  ]),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SabsmsSuppressionSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  phoneHash: z.string(),
  source: SabsmsSuppressionSourceSchema,
  reason: z.string().optional(),
  createdAt: z.date(),
  expiresAt: z.date().optional(),
});

export const SabsmsConsentEventSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  phoneHash: z.string(),
  kind: SabsmsConsentKindSchema,
  captureMethod: z.enum(['web_form', 'api', 'import', 'verbal', 'inbound_keyword']),
  source: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  doubleOptInVerifiedAt: z.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.date(),
});

export const SabsmsWebhookOutSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  url: z.string(),
  secret: z.string(),
  events: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SabsmsWebhookDeliverySchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  webhookId: z.string(),
  event: z.string(),
  payload: z.unknown(),
  attempts: z.array(z.object({
    attemptedAt: z.date(),
    status: z.number(),
    responseSnippet: z.string().optional(),
    error: z.string().optional(),
  })),
  status: z.enum(['pending', 'delivered', 'failed']),
  createdAt: z.date(),
  deliveredAt: z.date().optional(),
});

export const SabsmsShortLinkSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  slug: z.string(),
  target: z.string(),
  campaignId: z.string().optional(),
  contactId: z.string().optional(),
  messageId: z.string().optional(),
  clickCount: z.number(),
  createdAt: z.date(),
});

export const SabsmsLinkClickSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  shortLinkId: z.string(),
  campaignId: z.string().optional(),
  contactId: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  clickedAt: z.date(),
});

export const SabsmsSettingsSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  shortLinkDomain: z.string().optional(),
  updatedAt: z.date(),
});

// ---------------------------------------------------------------------------
// V2.6 cross-provider routing policies (`sabsms_routing_policies`).
//
// These zod schemas mirror the Rust structs in
// `services/sabsms-engine/src/routing/policy.rs` EXACTLY (camelCase
// wire form; the rule's conditions live under the literal key `match`).
// Change either side only together — the engine deserializes what the
// routing page writes.
// ---------------------------------------------------------------------------

export const SabsmsPoolStrategySchema = z.enum([
  'round_robin',
  'sticky',
  'least_used',
]);

export const SabsmsRoutingPoolSchema = z.object({
  /** `sabsms_numbers` ids the matched rule's sends pick a `from` out of. */
  numberIds: z.array(z.string()).default([]),
  strategy: SabsmsPoolStrategySchema,
});

export const SabsmsRoutingRouteSchema = z.object({
  providerAccountId: z.string().min(1),
  /** Higher weight = earlier in the failover order. */
  weight: z.number().int().min(0).max(1_000_000),
});

/** Present fields must ALL match; absent fields are wildcards. */
export const SabsmsRoutingMatchSchema = z.object({
  /** ISO-3166 alpha-2 (e.g. "US"). */
  country: z.string().min(2).max(2).optional(),
  category: SabsmsMessageCategorySchema.optional(),
  channel: SabsmsChannelSchema.optional(),
  /** E.164 string prefix (e.g. "+9198"). */
  prefix: z.string().min(1).max(16).optional(),
});

export const SabsmsRoutingRuleSchema = z.object({
  id: z.string().min(1),
  match: SabsmsRoutingMatchSchema.default({}),
  routes: z.array(SabsmsRoutingRouteSchema).min(1),
  stickySender: z.boolean().default(false),
  pool: SabsmsRoutingPoolSchema.optional(),
});

export const SabsmsRoutingPolicySchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  workspaceId: z.string(),
  rules: z.array(SabsmsRoutingRuleSchema).default([]),
  updatedAt: z.date(),
});

export type SabsmsRoutingRule = z.infer<typeof SabsmsRoutingRuleSchema>;
export type SabsmsRoutingPolicyDoc = z.infer<typeof SabsmsRoutingPolicySchema>;

