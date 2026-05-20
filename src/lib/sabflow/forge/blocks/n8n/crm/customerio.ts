/**
 * Forge block: Customer.io
 *
 * Source: n8n-master/packages/nodes-base/nodes/CustomerIo/CustomerIo.node.ts
 *   (+ GenericFunctions.ts, descriptions/*)
 * Credential type: 'customerio' — fields: { siteId, apiKey, appApiKey?, region? }
 *   - Tracking API (track.customer.io | track-eu.customer.io): HTTP Basic
 *     auth with `siteId:apiKey`. Used for customer / event upserts.
 *   - App API (api.customer.io | api-eu.customer.io): Bearer `appApiKey`.
 *     Used for transactional sends, campaign triggers, etc.
 *
 * Operations covered:
 *   - customer.upsert         PUT    /api/v1/customers/{id}                 (tracking)
 *   - customer.delete         DELETE /api/v1/customers/{id}                 (tracking)
 *   - event.track             POST   /api/v1/customers/{id}/events          (tracking)
 *   - event.track_anonymous   POST   /api/v1/events                         (tracking)
 *   - segment.add_customers   POST   /api/v1/segments/{id}/add_customers    (tracking)
 *   - segment.remove_customers POST  /api/v1/segments/{id}/remove_customers (tracking)
 *   - campaign.trigger        POST   /v1/api/campaigns/{id}/triggers        (app)
 *   - campaign.get            GET    /v1/campaigns/{id}                     (app)
 *   - campaign.list           GET    /v1/campaigns                          (app)
 *   - campaign.get_metrics    GET    /v1/campaigns/{id}/metrics             (app)
 *
 * Out of scope: transactional message sends, manual/segment-triggered
 * journeys, app-side reporting, push subscription management.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

// btoa is available in modern Node.js runtimes and the Edge runtime.
declare const btoa: (raw: string) => string;
function toBase64(s: string): string {
  if (typeof btoa === 'function') return btoa(s);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const B = (globalThis as any).Buffer as { from: (input: string) => { toString: (enc: string) => string } } | undefined;
  if (B) return B.from(s).toString('base64');
  throw new Error('No base64 encoder available in this runtime');
}

type RegionTag = 'us' | 'eu';

function pickRegion(ctx: ForgeActionContext): RegionTag {
  const cred = requireCredential('Customer.io', ctx.credential);
  const r = (cred.region || 'us').toLowerCase();
  return r === 'eu' || r.includes('eu') ? 'eu' : 'us';
}

function trackingHostFor(region: RegionTag): string {
  return region === 'eu' ? 'https://track-eu.customer.io' : 'https://track.customer.io';
}

function appHostFor(region: RegionTag): string {
  return region === 'eu' ? 'https://api-eu.customer.io' : 'https://api.customer.io';
}

function basicHeader(ctx: ForgeActionContext): { Authorization: string } {
  const cred = requireCredential('Customer.io', ctx.credential);
  if (!cred.siteId) throw new Error('Customer.io: credential is missing `siteId`');
  if (!cred.apiKey) throw new Error('Customer.io: credential is missing `apiKey`');
  const token = toBase64(`${cred.siteId}:${cred.apiKey}`);
  return { Authorization: `Basic ${token}` };
}

function bearerHeader(ctx: ForgeActionContext): { Authorization: string } {
  const cred = requireCredential('Customer.io', ctx.credential);
  if (!cred.appApiKey) {
    throw new Error('Customer.io: this action needs `appApiKey` on the credential record');
  }
  return { Authorization: `Bearer ${cred.appApiKey}` };
}

async function trackApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const region = pickRegion(ctx);
  const res = await apiRequest({
    service: 'Customer.io',
    method,
    url: `${trackingHostFor(region)}/api/v1${path}`,
    headers: basicHeader(ctx),
    json,
  });
  return res.data;
}

async function appApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const region = pickRegion(ctx);
  const res = await apiRequest({
    service: 'Customer.io',
    method,
    url: `${appHostFor(region)}/v1${path}`,
    headers: bearerHeader(ctx),
    json,
  });
  return res.data;
}

function parseAttributes(raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error('Customer.io: attributes must be a JSON object');
}

// ── Customer ───────────────────────────────────────────────────────────────

async function customerUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.customerId);
  if (!id) throw new Error('Customer.io: customerId is required');
  const body: Record<string, unknown> = parseAttributes(ctx.options.attributes);
  if (asString(ctx.options.email)) body.email = asString(ctx.options.email);
  if (asString(ctx.options.createdAt)) body.created_at = Number(asString(ctx.options.createdAt));

  await trackApi(ctx, 'PUT', `/customers/${encodeURIComponent(id)}`, body);
  return { outputs: { id, success: true }, logs: [`Customer.io customer upsert → ${id}`] };
}

async function customerDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.customerId);
  if (!id) throw new Error('Customer.io: customerId is required');
  await trackApi(ctx, 'DELETE', `/customers/${encodeURIComponent(id)}`);
  return { outputs: { id, success: true }, logs: [`Customer.io customer delete → ${id}`] };
}

// ── Event ──────────────────────────────────────────────────────────────────

async function eventTrack(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const customerId = asString(ctx.options.customerId);
  const name = asString(ctx.options.name);
  if (!customerId) throw new Error('Customer.io: customerId is required');
  if (!name) throw new Error('Customer.io: event name is required');
  const body: Record<string, unknown> = { name, data: parseAttributes(ctx.options.data) };
  if (asString(ctx.options.type)) body.type = asString(ctx.options.type);

  await trackApi(ctx, 'POST', `/customers/${encodeURIComponent(customerId)}/events`, body);
  return { outputs: { success: true, customerId, name }, logs: [`Customer.io event → ${customerId}/${name}`] };
}

async function eventTrackAnonymous(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Customer.io: event name is required');
  const body: Record<string, unknown> = { name, data: parseAttributes(ctx.options.data) };
  await trackApi(ctx, 'POST', '/events', body);
  return { outputs: { success: true, name }, logs: [`Customer.io anonymous event → ${name}`] };
}

// ── Campaign ───────────────────────────────────────────────────────────────

async function campaignTrigger(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const campaignId = asString(ctx.options.campaignId);
  if (!campaignId) throw new Error('Customer.io: campaignId is required');
  const body: Record<string, unknown> = {};
  const ids = asString(ctx.options.ids);
  if (ids) body.ids = ids.split(',').map((s) => s.trim()).filter(Boolean);
  if (asString(ctx.options.data)) body.data = parseAttributes(ctx.options.data);
  if (asString(ctx.options.recipients)) {
    body.recipients = parseAttributes(ctx.options.recipients);
  }

  const data = (await appApi(
    ctx,
    'POST',
    `/api/campaigns/${encodeURIComponent(campaignId)}/triggers`,
    body,
  )) as { id?: number | string } | null;
  return {
    outputs: { trigger: data, id: data?.id ?? null },
    logs: [`Customer.io campaign trigger → ${campaignId}`],
  };
}

// ── Segment ────────────────────────────────────────────────────────────────

async function segmentAddCustomers(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const segmentId = asString(ctx.options.segmentId);
  const ids = asString(ctx.options.customerIds);
  if (!segmentId) throw new Error('Customer.io: segmentId is required');
  if (!ids) throw new Error('Customer.io: customerIds is required');
  const idList = ids.split(',').map((s) => s.trim()).filter(Boolean);
  await trackApi(ctx, 'POST', `/segments/${encodeURIComponent(segmentId)}/add_customers`, { ids: idList });
  return {
    outputs: { success: true, segmentId, count: idList.length },
    logs: [`Customer.io segment add → ${segmentId} (${idList.length})`],
  };
}

async function segmentRemoveCustomers(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const segmentId = asString(ctx.options.segmentId);
  const ids = asString(ctx.options.customerIds);
  if (!segmentId) throw new Error('Customer.io: segmentId is required');
  if (!ids) throw new Error('Customer.io: customerIds is required');
  const idList = ids.split(',').map((s) => s.trim()).filter(Boolean);
  await trackApi(ctx, 'POST', `/segments/${encodeURIComponent(segmentId)}/remove_customers`, { ids: idList });
  return {
    outputs: { success: true, segmentId, count: idList.length },
    logs: [`Customer.io segment remove → ${segmentId} (${idList.length})`],
  };
}

// ── Campaign read ──────────────────────────────────────────────────────────

async function campaignGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const campaignId = asString(ctx.options.campaignId);
  if (!campaignId) throw new Error('Customer.io: campaignId is required');
  const data = (await appApi(ctx, 'GET', `/campaigns/${encodeURIComponent(campaignId)}`)) as {
    campaign?: unknown;
  } | null;
  return { outputs: { campaign: data?.campaign ?? data }, logs: [`Customer.io campaign get → ${campaignId}`] };
}

async function campaignList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = (await appApi(ctx, 'GET', '/campaigns')) as { campaigns?: unknown[] } | null;
  const campaigns = data?.campaigns ?? [];
  return { outputs: { campaigns, count: Array.isArray(campaigns) ? campaigns.length : 0 }, logs: ['Customer.io campaign list'] };
}

async function campaignGetMetrics(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const campaignId = asString(ctx.options.campaignId);
  if (!campaignId) throw new Error('Customer.io: campaignId is required');
  const period = asString(ctx.options.period);
  const qs = period && period !== 'days' ? `?period=${encodeURIComponent(period)}` : '';
  const data = (await appApi(
    ctx,
    'GET',
    `/campaigns/${encodeURIComponent(campaignId)}/metrics${qs}`,
  )) as { metric?: unknown } | null;
  return { outputs: { metric: data?.metric ?? data }, logs: [`Customer.io campaign metrics → ${campaignId}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_customerio',
  name: 'Customer.io',
  description: 'Upsert customers, track events and trigger Customer.io campaigns.',
  iconName: 'LuMailWarning',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'customerio' },
  actions: [
    {
      id: 'customer_upsert',
      label: 'Upsert customer',
      description: 'Create or update a customer profile (tracking API).',
      fields: [
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'createdAt', label: 'Created at (epoch s)', type: 'text' },
        { id: 'attributes', label: 'Attributes (JSON)', type: 'json' },
      ],
      run: customerUpsert,
    },
    {
      id: 'customer_delete',
      label: 'Delete customer',
      description: 'Delete a customer profile by id.',
      fields: [{ id: 'customerId', label: 'Customer ID', type: 'text', required: true }],
      run: customerDelete,
    },
    {
      id: 'event_track',
      label: 'Track event',
      description: 'Track an event for a customer.',
      fields: [
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
        { id: 'name', label: 'Event name', type: 'text', required: true },
        { id: 'type', label: 'Event type', type: 'text', placeholder: 'event | page | screen' },
        { id: 'data', label: 'Event data (JSON)', type: 'json' },
      ],
      run: eventTrack,
    },
    {
      id: 'event_track_anonymous',
      label: 'Track anonymous event',
      description: 'Track an event with no associated customer.',
      fields: [
        { id: 'name', label: 'Event name', type: 'text', required: true },
        { id: 'data', label: 'Event data (JSON)', type: 'json' },
      ],
      run: eventTrackAnonymous,
    },
    {
      id: 'campaign_trigger',
      label: 'Trigger campaign (broadcast)',
      description: 'Trigger an API-triggered broadcast/campaign. Requires `appApiKey`.',
      fields: [
        { id: 'campaignId', label: 'Campaign ID', type: 'text', required: true },
        { id: 'ids', label: 'Customer IDs (comma-separated)', type: 'text' },
        { id: 'data', label: 'Liquid data (JSON)', type: 'json' },
        { id: 'recipients', label: 'Recipients filter (JSON)', type: 'json' },
      ],
      run: campaignTrigger,
    },
    {
      id: 'segment_add_customers',
      label: 'Add customers to segment',
      description: 'Manually add a list of customers to a manual segment.',
      fields: [
        { id: 'segmentId', label: 'Segment ID', type: 'text', required: true },
        { id: 'customerIds', label: 'Customer IDs (comma-separated)', type: 'textarea', required: true },
      ],
      run: segmentAddCustomers,
    },
    {
      id: 'segment_remove_customers',
      label: 'Remove customers from segment',
      description: 'Manually remove a list of customers from a manual segment.',
      fields: [
        { id: 'segmentId', label: 'Segment ID', type: 'text', required: true },
        { id: 'customerIds', label: 'Customer IDs (comma-separated)', type: 'textarea', required: true },
      ],
      run: segmentRemoveCustomers,
    },
    {
      id: 'campaign_get',
      label: 'Get campaign',
      description: 'Fetch a campaign by id. Requires `appApiKey`.',
      fields: [{ id: 'campaignId', label: 'Campaign ID', type: 'text', required: true }],
      run: campaignGet,
    },
    {
      id: 'campaign_list',
      label: 'List campaigns',
      description: 'List all campaigns. Requires `appApiKey`.',
      fields: [],
      run: campaignList,
    },
    {
      id: 'campaign_get_metrics',
      label: 'Get campaign metrics',
      description: 'Fetch metrics for a campaign. Requires `appApiKey`.',
      fields: [
        { id: 'campaignId', label: 'Campaign ID', type: 'text', required: true },
        {
          id: 'period',
          label: 'Period',
          type: 'select',
          options: [
            { label: 'Days (default)', value: 'days' },
            { label: 'Hours', value: 'hours' },
            { label: 'Weeks', value: 'weeks' },
            { label: 'Months', value: 'months' },
          ],
          defaultValue: 'days',
        },
      ],
      run: campaignGetMetrics,
    },
  ],
};

registerForgeBlock(block);
export default block;
