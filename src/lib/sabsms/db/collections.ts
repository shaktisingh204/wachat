import 'server-only';

import { type Collection, type Db, type IndexSpecification } from 'mongodb';
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
