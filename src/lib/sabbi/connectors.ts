/**
 * SabBI connector registry — prebuilt semantic models over other SabNode
 * modules' Mongo collections.
 *
 * Each connector seeds a governed `BiModel` (measures + dimensions + segments)
 * with the CORRECT tenant scoping for that collection. Tenant fields and types
 * were verified against the actual module code:
 *   - SabCRM   `sabcrm_records` / `sabcrm_activities` → `projectId` (string)
 *   - SabPay   `sabpay_payments`                      → `userId`    (ObjectId)
 *   - WaChat   `messages`                             → `projectId` (ObjectId)
 *   - SabChat  `sabchat_conversations`                → `tenantId`  (ObjectId)
 *   - SabMail  `email_campaigns`                       → `userId`    (ObjectId)
 *   - SabSign  `esign_envelopes`                       → `tenantId`  (string)
 *   - Billing  `usage_events` / `subscriptions`        → `tenantId`  (string)
 *   - SabSites `sites`                                  → `userId`    (ObjectId)
 *
 * Deliberately EXCLUDED (cannot be safely/usefully scoped via the Mongo engine):
 *   - SabSMS `sabsms_messages` — lives in a SQL (SeaORM) store, not Mongo.
 *   - SabFlow `sabflow_executions` — no direct tenant field (scoped indirectly
 *     via `flowId` → `sabflows.userId`); needs a join the engine can't express yet.
 *   - `utm_links` / `ab_tests` — no tenant field at all.
 */
import type { BiModelCreateInput } from '@/lib/rust-client/bi-models';

export interface ConnectorDef {
  /** Stable connector key (also stored on the model's `connector` field). */
  key: string;
  label: string;
  description: string;
  /** Display grouping. */
  group: 'CRM' | 'Payments' | 'Comms' | 'Documents' | 'Web';
  /** The model seeded when this connector is "connected". */
  model: BiModelCreateInput;
}

export const CONNECTORS: ConnectorDef[] = [
  {
    key: 'crm_leads',
    label: 'SabCRM — Pipeline',
    description: 'Deal value by stage, win rate, lead source & velocity.',
    group: 'CRM',
    model: {
      name: 'CRM Pipeline',
      collection: 'sabcrm_records',
      description: 'Leads/deals pipeline from SabCRM.',
      baseFilter: { object: 'leads' },
      scopeField: 'projectId',
      scopeBy: 'project',
      scopeString: true,
      source: 'connector',
      connector: 'crm_leads',
      measures: [
        { key: 'deal_count', label: 'Deals', agg: 'count' },
        { key: 'pipeline_value', label: 'Pipeline value', agg: 'sum', column: 'data.amount', format: 'currency' },
        { key: 'avg_deal', label: 'Avg deal size', agg: 'avg', column: 'data.amount', format: 'currency' },
      ],
      dimensions: [
        { key: 'stage', label: 'Stage', column: 'data.stage', kind: 'string' },
        { key: 'source', label: 'Source', column: 'data.source', kind: 'string' },
        { key: 'priority', label: 'Priority', column: 'data.priority', kind: 'string' },
        { key: 'owner', label: 'Owner', column: 'data.owner', kind: 'string' },
        { key: 'created', label: 'Created', column: 'createdAt', kind: 'date', timeGrain: 'month' },
      ],
      segments: [
        { key: 'won', label: 'Won', filters: [{ column: 'data.stage', op: 'eq', value: 'CUSTOMER' }] },
      ],
    },
  },
  {
    key: 'crm_activities',
    label: 'SabCRM — Activities',
    description: 'Tasks, calls, meetings & notes by type and status.',
    group: 'CRM',
    model: {
      name: 'CRM Activities',
      collection: 'sabcrm_activities',
      description: 'Activity timeline from SabCRM.',
      scopeField: 'projectId',
      scopeBy: 'project',
      scopeString: true,
      source: 'connector',
      connector: 'crm_activities',
      measures: [{ key: 'activity_count', label: 'Activities', agg: 'count' }],
      dimensions: [
        { key: 'type', label: 'Type', column: 'type', kind: 'string' },
        { key: 'status', label: 'Status', column: 'status', kind: 'string' },
        { key: 'target', label: 'Target object', column: 'targetObject', kind: 'string' },
        { key: 'created', label: 'Created', column: 'createdAt', kind: 'date', timeGrain: 'week' },
      ],
      segments: [],
    },
  },
  {
    key: 'pay_payments',
    label: 'SabPay — Revenue',
    description: 'Revenue, success rate & payment mix (amounts in paise).',
    group: 'Payments',
    model: {
      name: 'SabPay Payments',
      collection: 'sabpay_payments',
      description: 'Payments from SabPay (amount stored in paise).',
      scopeField: 'userId',
      scopeBy: 'user',
      scopeString: false,
      source: 'connector',
      connector: 'pay_payments',
      measures: [
        { key: 'payment_count', label: 'Payments', agg: 'count' },
        { key: 'revenue', label: 'Revenue (paise)', agg: 'sum', column: 'amount', format: 'currency' },
      ],
      dimensions: [
        { key: 'status', label: 'Status', column: 'status', kind: 'string' },
        { key: 'mode', label: 'Mode', column: 'mode', kind: 'string' },
        { key: 'currency', label: 'Currency', column: 'currency', kind: 'string' },
        { key: 'method', label: 'Method', column: 'providerPaymentMode', kind: 'string' },
        { key: 'created', label: 'Created', column: 'createdAt', kind: 'date', timeGrain: 'day' },
      ],
      segments: [
        { key: 'succeeded', label: 'Succeeded', filters: [{ column: 'status', op: 'eq', value: 'succeeded' }] },
      ],
    },
  },
  {
    key: 'wachat_messages',
    label: 'WaChat — Messages',
    description: 'WhatsApp volume, delivery status & agent response time.',
    group: 'Comms',
    model: {
      name: 'WaChat Messages',
      collection: 'messages',
      description: 'WhatsApp messages from WaChat.',
      scopeField: 'projectId',
      scopeBy: 'project',
      scopeString: false,
      source: 'connector',
      connector: 'wachat_messages',
      measures: [
        { key: 'message_count', label: 'Messages', agg: 'count' },
        { key: 'avg_response_ms', label: 'Avg response (ms)', agg: 'avg', column: 'responseTimeMs', format: 'duration' },
      ],
      dimensions: [
        { key: 'status', label: 'Status', column: 'status', kind: 'string' },
        { key: 'direction', label: 'Direction', column: 'direction', kind: 'string' },
        { key: 'type', label: 'Type', column: 'type', kind: 'string' },
        { key: 'agent', label: 'Agent', column: 'agentId', kind: 'string' },
        { key: 'sent', label: 'Sent', column: 'timestamp', kind: 'date', timeGrain: 'day' },
      ],
      segments: [],
    },
  },
  {
    key: 'chat_conversations',
    label: 'SabChat — Conversations',
    description: 'Live-chat volume by status, inbox, channel & agent.',
    group: 'Comms',
    model: {
      name: 'SabChat Conversations',
      collection: 'sabchat_conversations',
      description: 'Conversations from SabChat.',
      scopeField: 'tenantId',
      scopeBy: 'project',
      scopeString: false,
      source: 'connector',
      connector: 'chat_conversations',
      measures: [{ key: 'conversation_count', label: 'Conversations', agg: 'count' }],
      dimensions: [
        { key: 'status', label: 'Status', column: 'status', kind: 'string' },
        { key: 'inbox', label: 'Inbox', column: 'inboxId', kind: 'string' },
        { key: 'channel', label: 'Channel', column: 'channelType', kind: 'string' },
        { key: 'agent', label: 'Agent', column: 'agentId', kind: 'string' },
        { key: 'created', label: 'Created', column: 'createdAt', kind: 'date', timeGrain: 'day' },
      ],
      segments: [],
    },
  },
  {
    key: 'mail_campaigns',
    label: 'SabMail — Campaigns',
    description: 'Email campaign volume by status and type.',
    group: 'Comms',
    model: {
      name: 'SabMail Campaigns',
      collection: 'email_campaigns',
      description: 'Email campaigns from SabMail.',
      scopeField: 'userId',
      scopeBy: 'user',
      scopeString: false,
      source: 'connector',
      connector: 'mail_campaigns',
      measures: [{ key: 'campaign_count', label: 'Campaigns', agg: 'count' }],
      dimensions: [
        { key: 'status', label: 'Status', column: 'status', kind: 'string' },
        { key: 'kind', label: 'Kind', column: 'kind', kind: 'string' },
        { key: 'created', label: 'Created', column: 'createdAt', kind: 'date', timeGrain: 'week' },
      ],
      segments: [],
    },
  },
  {
    key: 'sign_envelopes',
    label: 'SabSign — Envelopes',
    description: 'E-signature completion rate and status mix.',
    group: 'Documents',
    model: {
      name: 'SabSign Envelopes',
      collection: 'esign_envelopes',
      description: 'Signature envelopes from SabSign.',
      scopeField: 'tenantId',
      scopeBy: 'project',
      scopeString: true,
      source: 'connector',
      connector: 'sign_envelopes',
      measures: [{ key: 'envelope_count', label: 'Envelopes', agg: 'count' }],
      dimensions: [
        { key: 'status', label: 'Status', column: 'status', kind: 'string' },
        { key: 'created', label: 'Created', column: 'createdAt', kind: 'date', timeGrain: 'week' },
      ],
      segments: [
        { key: 'completed', label: 'Completed', filters: [{ column: 'status', op: 'eq', value: 'completed' }] },
      ],
    },
  },
  {
    key: 'billing_usage',
    label: 'Billing — Usage',
    description: 'Metered usage (units) by feature over time.',
    group: 'Payments',
    model: {
      name: 'Billing Usage',
      collection: 'usage_events',
      description: 'Metered usage events.',
      scopeField: 'tenantId',
      scopeBy: 'project',
      scopeString: true,
      source: 'connector',
      connector: 'billing_usage',
      measures: [
        { key: 'usage_events', label: 'Events', agg: 'count' },
        { key: 'units', label: 'Units', agg: 'sum', column: 'units', format: 'number' },
      ],
      dimensions: [
        { key: 'feature', label: 'Feature', column: 'feature', kind: 'string' },
        { key: 'ts', label: 'When', column: 'ts', kind: 'date', timeGrain: 'day' },
      ],
      segments: [],
    },
  },
  {
    key: 'sites',
    label: 'SabSites — Sites',
    description: 'Sites created over time.',
    group: 'Web',
    model: {
      name: 'SabSites',
      collection: 'sites',
      description: 'Websites from the site builder.',
      scopeField: 'userId',
      scopeBy: 'user',
      scopeString: false,
      source: 'connector',
      connector: 'sites',
      measures: [{ key: 'site_count', label: 'Sites', agg: 'count' }],
      dimensions: [{ key: 'created', label: 'Created', column: 'createdAt', kind: 'date', timeGrain: 'month' }],
      segments: [],
    },
  },
];

export function getConnector(key: string): ConnectorDef | undefined {
  return CONNECTORS.find((c) => c.key === key);
}
