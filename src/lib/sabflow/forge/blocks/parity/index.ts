/**
 * Step 29 — five net-new integrations that close obvious n8n-parity gaps.
 *
 *   1. Stripe Connect v2 (charges)
 *   2. Shopify Admin GraphQL
 *   3. Salesforce REST
 *   4. Microsoft Teams (post to channel)
 *   5. Bunny.net CDN (purge cache)
 *
 * Same ForgeBlock contract — each provides its primary action (the 80/20
 * cut).  Less-common actions are reachable via the HTTP Request block,
 * which is itself one of these patterns templated.
 */

import { registerForgeBlock } from '../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../types';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

async function jsonRequest(opts: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}): Promise<unknown> {
  const res = await fetch(opts.url, {
    method: opts.method,
    headers: { Accept: 'application/json', ...opts.headers },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  const data: unknown = text ? safeJsonParse(text) : null;
  if (!res.ok) {
    const detail =
      typeof data === 'string' ? data : data ? JSON.stringify(data).slice(0, 400) : '';
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${detail}`);
  }
  return data;
}
function safeJsonParse(s: string): unknown { try { return JSON.parse(s); } catch { return s; } }
function writeOutput(ctx: ForgeActionContext, value: unknown): Record<string, unknown> {
  const key = str(ctx.options.outputVariable);
  return key ? { [key]: value, result: value } : { result: value };
}

/* ── 1. Stripe Connect v2 — create a Charge ────────────────────────────── */

async function stripeCreateCharge(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secretKey = ctx.credential?.secretKey ?? ctx.credential?.apiKey;
  if (!secretKey) throw new Error('Stripe: select a credential (secret key)');
  const amount = Number(ctx.options.amount);
  const currency = str(ctx.options.currency) || 'usd';
  const source = str(ctx.options.source);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Stripe: amount must be a positive integer in the smallest currency unit');
  }
  if (!source) throw new Error('Stripe: source (token / payment method) is required');

  const params = new URLSearchParams({
    amount: String(Math.round(amount)),
    currency,
    source,
    description: str(ctx.options.description),
    receipt_email: str(ctx.options.receiptEmail),
  });
  // Stripe Connect on-behalf-of (optional).
  const onBehalfOf = str(ctx.options.connectedAccount);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (onBehalfOf) headers['Stripe-Account'] = onBehalfOf;

  const res = await fetch('https://api.stripe.com/v1/charges', {
    method: 'POST',
    headers,
    body: params.toString(),
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Stripe: charged ${amount} ${currency.toUpperCase()} via ${source}`],
  };
}

registerForgeBlock({
  id: 'forge_stripe_connect',
  name: 'Stripe (Connect)',
  description: 'Create charges on a Stripe account (Connect-aware).',
  iconName: 'LuCreditCard',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'stripe' },
  actions: [
    {
      id: 'create_charge',
      label: 'Create charge',
      description: 'Charge a source / payment method, optionally on a connected account.',
      fields: [
        { id: 'amount',           label: 'Amount (smallest unit, e.g. cents)', type: 'number', required: true },
        { id: 'currency',         label: 'Currency (ISO 4217)', type: 'text' },
        { id: 'source',           label: 'Source / Payment-method id', type: 'text', required: true },
        { id: 'description',      label: 'Description', type: 'text' },
        { id: 'receiptEmail',     label: 'Receipt email', type: 'text' },
        { id: 'connectedAccount', label: 'Connected account (Stripe-Account header)', type: 'text' },
        { id: 'outputVariable',   label: 'Save response to variable', type: 'text' },
      ],
      run: stripeCreateCharge,
    },
  ],
});

/* ── 2. Shopify Admin GraphQL ──────────────────────────────────────────── */

async function shopifyAdminGraphql(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = ctx.credential?.accessToken ?? ctx.credential?.apiKey;
  const shop = ctx.credential?.shop ?? str(ctx.options.shop);
  if (!accessToken || !shop) {
    throw new Error('Shopify: select a credential with accessToken + shop ({shop}.myshopify.com)');
  }
  const query = str(ctx.options.query);
  if (!query) throw new Error('Shopify: GraphQL query is required');
  const variablesRaw = ctx.options.variables;
  const variables =
    variablesRaw && typeof variablesRaw === 'object' && !Array.isArray(variablesRaw)
      ? (variablesRaw as Record<string, unknown>)
      : {};

  const data = await jsonRequest({
    method: 'POST',
    url: `https://${shop}/admin/api/2024-10/graphql.json`,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: { query, variables },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Shopify: GraphQL → ${shop}`],
  };
}

registerForgeBlock({
  id: 'forge_shopify_admin',
  name: 'Shopify Admin (GraphQL)',
  description: 'Run a GraphQL query/mutation against the Shopify Admin API.',
  iconName: 'LuShoppingBag',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'shopify' as never },
  actions: [
    {
      id: 'graphql',
      label: 'GraphQL request',
      description: 'Send a Shopify Admin GraphQL request.',
      fields: [
        { id: 'shop',      label: 'Shop ({shop}.myshopify.com — overrides credential)', type: 'text' },
        { id: 'query',     label: 'GraphQL query', type: 'json', required: true },
        { id: 'variables', label: 'Variables (JSON)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: shopifyAdminGraphql,
    },
  ],
});

/* ── 3. Salesforce REST ────────────────────────────────────────────────── */

async function salesforceRequest(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = ctx.credential?.accessToken ?? ctx.credential?.token;
  const instanceUrl = ctx.credential?.instanceUrl ?? str(ctx.options.instanceUrl);
  if (!accessToken || !instanceUrl) {
    throw new Error('Salesforce: credential must include accessToken + instanceUrl');
  }
  const path = str(ctx.options.path) || '/services/data/v60.0/sobjects/Account';
  const method =
    (str(ctx.options.method) || 'POST').toUpperCase() as
      | 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  const bodyRaw = ctx.options.body;
  const body =
    bodyRaw && typeof bodyRaw === 'object' && !Array.isArray(bodyRaw)
      ? (bodyRaw as Record<string, unknown>)
      : undefined;

  const data = await jsonRequest({
    method,
    url: `${instanceUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body,
  });
  return { outputs: writeOutput(ctx, data), logs: [`Salesforce: ${method} ${path}`] };
}

registerForgeBlock({
  id: 'forge_salesforce',
  name: 'Salesforce REST',
  description: 'Call any Salesforce REST endpoint on your connected org.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'oauth', credentialType: 'salesforce' as never },
  actions: [
    {
      id: 'request',
      label: 'REST request',
      description: 'Generic Salesforce REST call (create / update / query).',
      fields: [
        { id: 'instanceUrl', label: 'Instance URL (overrides credential)', type: 'text' },
        { id: 'method',      label: 'HTTP method', type: 'text', placeholder: 'POST' },
        { id: 'path',        label: 'Path', type: 'text', placeholder: '/services/data/v60.0/sobjects/Account' },
        { id: 'body',        label: 'Body (JSON)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: salesforceRequest,
    },
  ],
});

/* ── 4. Microsoft Teams — post message ─────────────────────────────────── */

async function teamsPostMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = ctx.credential?.accessToken ?? ctx.credential?.token;
  if (!accessToken) throw new Error('Teams: select an OAuth credential (Microsoft Graph)');
  const teamId = str(ctx.options.teamId);
  const channelId = str(ctx.options.channelId);
  const content = str(ctx.options.content);
  if (!teamId || !channelId || !content) {
    throw new Error('Teams: teamId + channelId + content are required');
  }
  const contentType =
    (str(ctx.options.contentType) || 'text').toLowerCase() === 'html' ? 'html' : 'text';

  const data = await jsonRequest({
    method: 'POST',
    url: `https://graph.microsoft.com/v1.0/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: { body: { contentType, content } },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Teams: posted to channel ${channelId}`],
  };
}

registerForgeBlock({
  id: 'forge_microsoft_teams',
  name: 'Microsoft Teams',
  description: 'Post a message to a Teams channel via Microsoft Graph.',
  iconName: 'LuUsersRound',
  category: 'Integration',
  auth: { type: 'oauth', credentialType: 'microsoft' },
  actions: [
    {
      id: 'post_message',
      label: 'Post message',
      description: 'Post a chat message to a Teams channel.',
      fields: [
        { id: 'teamId',      label: 'Team ID', type: 'text', required: true },
        { id: 'channelId',   label: 'Channel ID', type: 'text', required: true },
        { id: 'content',     label: 'Message content', type: 'text', required: true },
        { id: 'contentType', label: 'Content type (text / html)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: teamsPostMessage,
    },
  ],
});

/* ── 5. Bunny.net CDN — purge ──────────────────────────────────────────── */

async function bunnyPurge(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey;
  if (!apiKey) throw new Error('Bunny: select a credential (account API key)');
  const url = str(ctx.options.url);
  const async = ctx.options.async === false ? 'false' : 'true';
  if (!url) throw new Error('Bunny: url to purge is required');

  const params = new URLSearchParams({ url, async });
  const res = await fetch(`https://api.bunny.net/purge?${params.toString()}`, {
    method: 'POST',
    headers: { AccessKey: apiKey },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Bunny purge ${res.status}: ${text.slice(0, 200)}`);
  }
  return {
    outputs: writeOutput(ctx, { ok: true, url, async: async === 'true' }),
    logs: [`Bunny: purge requested for ${url}`],
  };
}

registerForgeBlock({
  id: 'forge_bunny_cdn',
  name: 'Bunny.net CDN',
  description: 'Purge a URL or directory from the Bunny CDN edge cache.',
  iconName: 'LuRefreshCw',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'bunny' as never },
  actions: [
    {
      id: 'purge',
      label: 'Purge URL',
      description: 'Invalidate a single URL (or wildcard) from the edge cache.',
      fields: [
        { id: 'url',   label: 'URL to purge', type: 'text', required: true },
        { id: 'async', label: 'Async purge', type: 'toggle' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: bunnyPurge,
    },
  ],
});

export const STEP_29_PARITY_BLOCK_IDS = [
  'forge_stripe_connect',
  'forge_shopify_admin',
  'forge_salesforce',
  'forge_microsoft_teams',
  'forge_bunny_cdn',
] as const;
