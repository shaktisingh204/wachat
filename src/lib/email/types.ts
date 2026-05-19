/**
 * Email Suite — domain types for the Mailchimp-parity rebuild.
 *
 * Each `EmailX` matches a Mongo collection (see plan/EMAIL_APP_REBUILD_PLAN.md §5).
 * `EmailXInput` is the create-time shape (omits `_id`, `createdAt`).
 *
 * Legacy types (`EmailSettings`, `EmailCampaign`, `EmailConversation`, `EmailContact`,
 * `CrmEmailTemplate`) live in `src/lib/definitions.ts` and are referenced here.
 */

import type { ObjectId } from 'mongodb';

// -----------------------------------------------------------------------------
// Shared primitives
// -----------------------------------------------------------------------------

export type EmailRecipientAddress = {
  email: string;
  name?: string;
};

export type EmailMergeTag = {
  key: string;
  fallback?: string;
};

export type EmailFilterOp =
  | 'eq' | 'ne' | 'in' | 'nin'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'starts_with' | 'ends_with' | 'matches'
  | 'exists' | 'not_exists'
  | 'within_days' | 'before' | 'after';

export type EmailFilterLeaf = {
  field: string;        // e.g. 'tags', 'engagement.openCount', 'customFields.country'
  op: EmailFilterOp;
  value?: unknown;
};

export type FilterCombinator = 'AND' | 'OR';

export type EmailFilterNode = EmailFilterLeaf | EmailFilterGroup;

export type EmailFilterGroup = {
  combinator: FilterCombinator;
  filters: Array<EmailFilterNode>;
};

export type EmailFilterTree = EmailFilterGroup;

export type EmailSubscriberStatus =
  | 'subscribed'
  | 'unsubscribed'
  | 'pending'
  | 'bounced'
  | 'complained'
  | 'archived';

// -----------------------------------------------------------------------------
// Segments — saved dynamic audience filters
// -----------------------------------------------------------------------------

export type EmailSegment = {
  _id: ObjectId;
  userId: ObjectId;
  listId?: ObjectId;          // null = across all lists
  name: string;
  description?: string;
  filter: EmailFilterTree;
  cachedCount?: number;
  cachedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type EmailSegmentInput = Omit<EmailSegment, '_id' | 'createdAt' | 'updatedAt' | 'cachedCount' | 'cachedAt'>;

// -----------------------------------------------------------------------------
// Journeys — visual builder + per-contact runs
// -----------------------------------------------------------------------------

export type EmailJourneyNodeType =
  | 'trigger'
  | 'email'
  | 'wait'
  | 'condition'
  | 'action'
  | 'split'
  | 'exit';

export type EmailJourneyTriggerKind =
  | 'list_join'
  | 'tag_added'
  | 'tag_removed'
  | 'segment_enter'
  | 'campaign_open'
  | 'campaign_click'
  | 'field_changed'
  | 'date_anniversary'
  | 'webhook';

export type EmailJourneyNode = {
  id: string;
  type: EmailJourneyNodeType;
  position: { x: number; y: number };
  data: {
    label?: string;
    trigger?: { kind: EmailJourneyTriggerKind; config?: Record<string, unknown> };
    emailTemplateId?: string;
    emailSubject?: string;
    waitFor?: { value: number; unit: 'minutes' | 'hours' | 'days' };
    condition?: EmailFilterTree;
    action?: {
      kind: 'tag_add' | 'tag_remove' | 'list_move' | 'webhook' | 'update_field' | 'unsubscribe';
      config?: Record<string, unknown>;
    };
    splitWeights?: number[]; // for A/B split
  };
};

export type EmailJourneyEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;     // 'true' / 'false' / 'a' / 'b'
};

export type EmailJourney = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  nodes: EmailJourneyNode[];
  edges: EmailJourneyEdge[];
  trigger: { kind: EmailJourneyTriggerKind; config?: Record<string, unknown> };
  reentryPolicy: 'never' | 'after_exit' | 'always';
  goal?: { kind: 'campaign_click' | 'segment_enter' | 'tag_added'; config?: Record<string, unknown> };
  stats?: {
    entered: number;
    completed: number;
    active: number;
    goalReached: number;
  };
  createdAt: Date;
  updatedAt: Date;
};

export type EmailJourneyRun = {
  _id: ObjectId;
  userId: ObjectId;
  journeyId: ObjectId;
  subscriberId: ObjectId;
  currentNodeId: string;
  status: 'active' | 'waiting' | 'completed' | 'exited' | 'errored';
  nextStepAt?: Date;
  enteredAt: Date;
  completedAt?: Date;
  history: Array<{
    nodeId: string;
    enteredAt: Date;
    exitedAt?: Date;
    decision?: string;
    error?: string;
  }>;
};

// -----------------------------------------------------------------------------
// Template builder — block-based + saved blocks + brand kit
// -----------------------------------------------------------------------------

export type EmailBuilderBlockType =
  | 'text' | 'image' | 'button' | 'columns' | 'divider'
  | 'spacer' | 'social' | 'video' | 'footer' | 'html' | 'amp';

export type EmailBuilderBlock = {
  id: string;
  type: EmailBuilderBlockType;
  props: Record<string, unknown>;
  children?: EmailBuilderBlock[];
};

export type EmailBuilderDocument = {
  version: 1;
  settings: {
    backgroundColor?: string;
    contentBackgroundColor?: string;
    fontFamily?: string;
    width?: number;
    preheader?: string;
  };
  blocks: EmailBuilderBlock[];
};

export type EmailTemplateV2 = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  subject?: string;
  category?: string;
  builderJson?: EmailBuilderDocument;
  mjml?: string;
  html?: string;
  amp?: string;
  thumbnailUrl?: string;          // SabFiles URL
  isLibrary?: boolean;            // curated gallery flag
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type EmailTemplateBlock = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  block: EmailBuilderBlock;
  thumbnailUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type EmailBrandKit = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  logo?: { url: string; alt?: string };       // SabFiles
  palette: {
    primary: string;
    secondary?: string;
    background?: string;
    text?: string;
    muted?: string;
  };
  fonts: {
    heading?: string;
    body?: string;
  };
  social?: Array<{ network: string; url: string }>;
  footer: {
    companyName: string;
    address: string;
    unsubscribeText?: string;
    preferencesText?: string;
  };
  createdAt: Date;
  updatedAt: Date;
};

// -----------------------------------------------------------------------------
// Forms — signup, popup, landing
// -----------------------------------------------------------------------------

export type EmailFormField = {
  key: string;                   // maps to subscriber field / customField
  label: string;
  type: 'text' | 'email' | 'number' | 'select' | 'checkbox' | 'phone' | 'date';
  required?: boolean;
  options?: string[];            // for select
  placeholder?: string;
};

export type EmailForm = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  kind: 'embed' | 'popup' | 'landing';
  listId: ObjectId;
  fields: EmailFormField[];
  consent: {
    required: boolean;
    text: string;
  };
  design: {
    theme?: 'light' | 'dark';
    brandKitId?: ObjectId;
    title?: string;
    description?: string;
    submitLabel?: string;
    successMessage?: string;
  };
  slug?: string;                 // for landing pages → /p/[slug]
  status: 'draft' | 'published' | 'archived';
  submissions?: number;
  createdAt: Date;
  updatedAt: Date;
};

// -----------------------------------------------------------------------------
// Inbox — threads + messages + assignments (replaces EmailConversation)
// -----------------------------------------------------------------------------

export type EmailInboxThread = {
  _id: ObjectId;
  userId: ObjectId;
  accountId: ObjectId;            // FK → email_settings
  subject: string;
  participants: EmailRecipientAddress[];
  status: 'open' | 'pending' | 'closed' | 'archived';
  unread: boolean;
  starred?: boolean;
  labels?: string[];
  campaignId?: ObjectId;           // FK → email_campaigns (if reply to campaign)
  contactId?: ObjectId;            // FK → crm_contacts or email_subscribers
  assignedTo?: ObjectId;           // FK → users
  slaDueAt?: Date;
  lastMessageAt: Date;
  lastMessagePreview: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type EmailInboxMessage = {
  _id: ObjectId;
  userId: ObjectId;
  threadId: ObjectId;
  direction: 'inbound' | 'outbound';
  from: EmailRecipientAddress;
  to: EmailRecipientAddress[];
  cc?: EmailRecipientAddress[];
  bcc?: EmailRecipientAddress[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  messageId?: string;              // RFC 822 Message-ID
  inReplyTo?: string;
  references?: string[];
  attachments?: Array<{ filename: string; contentType: string; size: number; url: string }>;
  sentBy?: ObjectId;               // user who sent (for outbound)
  createdAt: Date;
};

export type EmailInboxAssignment = {
  _id: ObjectId;
  userId: ObjectId;
  threadId: ObjectId;
  assignedTo: ObjectId;
  assignedBy: ObjectId;
  assignedAt: Date;
  releasedAt?: Date;
};

// -----------------------------------------------------------------------------
// Events — raw send/open/click/bounce/complaint ledger
// -----------------------------------------------------------------------------

export type EmailEventKind =
  | 'send' | 'delivered' | 'open' | 'click'
  | 'bounce_hard' | 'bounce_soft' | 'complaint' | 'unsubscribe'
  | 'dropped' | 'deferred';

export type EmailEvent = {
  _id: ObjectId;
  userId: ObjectId;
  kind: EmailEventKind;
  campaignId?: ObjectId;
  journeyId?: ObjectId;
  subscriberId?: ObjectId;
  messageId?: string;
  email: string;
  url?: string;                    // for click events
  userAgent?: string;
  ip?: string;
  geo?: { country?: string; region?: string; city?: string };
  reason?: string;                 // bounce/complaint reason
  provider: string;                // 'sendgrid' | 'mailgun' | 'ses' | 'postmark' | 'brevo' | 'smtp'
  occurredAt: Date;
  ingestedAt: Date;
};

// -----------------------------------------------------------------------------
// Deliverability — warmup, DNS snapshots
// -----------------------------------------------------------------------------

export type EmailWarmupRun = {
  _id: ObjectId;
  userId: ObjectId;
  domain: string;
  status: 'pending' | 'running' | 'paused' | 'completed';
  startedAt: Date;
  completedAt?: Date;
  schedule: Array<{
    day: number;
    cap: number;
    sentToday?: number;
  }>;
  currentDay: number;
  notes?: string;
};

export type EmailDnsSnapshot = {
  _id: ObjectId;
  userId: ObjectId;
  domain: string;
  records: {
    spf?: { record: string; valid: boolean; issues?: string[] };
    dkim?: { selector: string; record: string; valid: boolean; bits?: number };
    dmarc?: { record: string; policy?: 'none' | 'quarantine' | 'reject'; valid: boolean };
    mx?: { records: string[]; valid: boolean };
    bimi?: { record: string; valid: boolean };
  };
  score: number;                   // 0-100
  checkedAt: Date;
};

// -----------------------------------------------------------------------------
// API + Webhooks
// -----------------------------------------------------------------------------

export type EmailApiKey = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  keyHash: string;                 // hashed; raw shown once at creation
  prefix: string;                  // first 8 chars for UI
  scopes: string[];
  lastUsedAt?: Date;
  createdAt: Date;
  revokedAt?: Date;
};

export type EmailWebhookConfig = {
  _id: ObjectId;
  userId: ObjectId;
  url: string;
  secret: string;
  events: EmailEventKind[];
  active: boolean;
  failureCount?: number;
  lastDeliveredAt?: Date;
  lastFailedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

// -----------------------------------------------------------------------------
// Reports — pre-aggregated metrics
// -----------------------------------------------------------------------------

export type EmailReportsCache = {
  _id: ObjectId;
  userId: ObjectId;
  scope: 'campaign' | 'journey' | 'account' | 'tenant';
  scopeId?: ObjectId;
  bucket: 'day' | 'hour' | 'lifetime';
  bucketAt: Date;
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    uniqueOpens: number;
    clicked: number;
    uniqueClicks: number;
    bounced: number;
    complained: number;
    unsubscribed: number;
    revenue?: number;
  };
  updatedAt: Date;
};

// -----------------------------------------------------------------------------
// Extended campaign (adds A/B variants on top of legacy `EmailCampaign`)
// -----------------------------------------------------------------------------

export type EmailCampaignType = 'regular' | 'ab' | 'rss' | 'plain' | 'transactional';

export type EmailCampaignVariant = {
  id: string;                      // 'A' | 'B' | …
  subject: string;
  fromName: string;
  fromEmail: string;
  templateId?: ObjectId;
  body?: string;                   // HTML rendered
  scheduledAt?: Date;
  metrics?: {
    sent: number;
    opens: number;
    clicks: number;
  };
};

export type EmailCampaignAbConfig = {
  testWhat: 'subject' | 'from' | 'content' | 'send_time';
  sampleSize: number;              // % of audience for test
  winnerMetric: 'open_rate' | 'click_rate';
  winnerAfterHours: number;
  winnerVariantId?: string;
};

export type EmailCampaignV2Extension = {
  type: EmailCampaignType;
  variants?: EmailCampaignVariant[];
  abConfig?: EmailCampaignAbConfig;
  listIds?: ObjectId[];
  segmentIds?: ObjectId[];
  brandKitId?: ObjectId;
  preheader?: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
  unsubscribeFooter?: string;
};

// -----------------------------------------------------------------------------
// Collection names (single source of truth)
// -----------------------------------------------------------------------------

export const EMAIL_COLLECTIONS = {
  settings: 'email_settings',
  subscribers: 'email_subscribers',
  lists: 'email_lists',
  segments: 'email_segments',
  campaigns: 'email_campaigns',
  templates: 'email_templates',
  templateBlocks: 'email_template_blocks',
  brandKits: 'email_brand_kits',
  forms: 'email_forms',
  journeys: 'email_journeys',
  journeyRuns: 'email_journey_runs',
  threads: 'email_threads',
  messages: 'email_messages',
  assignments: 'email_assignments',
  events: 'email_events',
  suppressions: 'email_suppressions',
  warmupRuns: 'email_warmup_runs',
  dnsSnapshots: 'email_dns_snapshots',
  apiKeys: 'email_api_keys',
  webhookConfigs: 'email_webhook_configs',
  reportsCache: 'email_reports_cache',
} as const;

export type EmailCollectionName = (typeof EMAIL_COLLECTIONS)[keyof typeof EMAIL_COLLECTIONS];
