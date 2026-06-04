/**
 * SabNode MCP — Meta Ad Manager tool registry.
 *
 * Each entry exposes one Ad Manager capability to an MCP host. The tools
 * are deliberately thin adapters over the **same** Rust Ad-Manager BFF
 * the dashboard uses: every Graph call lands on `POST /v1/ad-manager/graph`
 * (or the Mongo-backed `/accounts` route), which resolves the tenant's
 * stored `adManagerAccessToken` server-side and proxies to
 * graph.facebook.com. This guarantees behaviour parity with the UI in
 * `src/app/actions/ad-manager.actions.ts` — the param/body shaping here
 * mirrors those server actions exactly.
 *
 * Tenancy + auth are handled upstream by the developer-platform layer
 * (`verifyApiKey` → `ApiAuthContext`); a tool only ever receives the
 * resolved `userId` it should act as. Each tool declares the OAuth scope
 * (`ads:read` / `ads:write`) the calling key must hold.
 */

import 'server-only';

import { z, type ZodType } from 'zod';

import { rustFetchAsUser } from '../rust-as-user';
import type { OAuthScope } from '../types';
import { RustApiError } from '@/lib/rust-client';
import { toolJson, toolError, type McpToolResult } from './protocol';

/* ── Graph proxy helper (mirrors ad-manager.actions.ts `graph()`) ─────────── */

interface GraphOpts {
  method?: 'GET' | 'POST' | 'DELETE';
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
  tokenKind?: 'adManager' | 'metaSuite';
}

interface GraphProxyResult<T = unknown> {
  data?: T;
  error?: string;
}

function withActPrefix(id: string): string {
  if (!id) return id;
  return id.startsWith('act_') ? id : `act_${id}`;
}

/** Issue a Graph call through the Rust BFF on behalf of `userId`. */
async function graphAsUser<T = unknown>(
  userId: string,
  path: string,
  opts: GraphOpts = {},
): Promise<GraphProxyResult<T>> {
  try {
    const res = await rustFetchAsUser<GraphProxyResult<T>>(userId, '/v1/ad-manager/graph', {
      method: 'POST',
      body: JSON.stringify({
        path: path.replace(/^\//, ''),
        method: opts.method,
        params: opts.params,
        body: opts.body,
        tokenKind: opts.tokenKind,
      }),
    });
    if (res.error) return { error: res.error };
    return { data: res.data };
  } catch (e) {
    if (e instanceof RustApiError) return { error: e.message };
    if (e instanceof Error) return { error: e.message };
    return { error: 'An unexpected error occurred.' };
  }
}

/* ── Graph field selections (parity with the dashboard) ───────────────────── */

const CAMPAIGN_FIELDS = [
  'id', 'name', 'objective', 'status', 'effective_status', 'configured_status',
  'buying_type', 'bid_strategy', 'daily_budget', 'lifetime_budget', 'budget_remaining',
  'spend_cap', 'special_ad_categories', 'start_time', 'stop_time',
  'created_time', 'updated_time', 'account_id',
].join(',');

const ADSET_FIELDS = [
  'id', 'account_id', 'name', 'campaign_id', 'status', 'effective_status', 'configured_status',
  'daily_budget', 'lifetime_budget', 'budget_remaining', 'bid_amount', 'bid_strategy',
  'billing_event', 'optimization_goal', 'start_time', 'end_time', 'destination_type',
  'promoted_object', 'targeting', 'created_time', 'updated_time',
].join(',');

const AD_FIELDS = [
  'id', 'name', 'adset_id', 'campaign_id', 'status', 'effective_status', 'configured_status',
  'creative{id,name,title,body,image_url,thumbnail_url,object_story_spec}',
  'tracking_specs', 'created_time', 'updated_time', 'preview_shareable_link',
].join(',');

const AUDIENCE_FIELDS = [
  'id', 'name', 'description', 'subtype', 'approximate_count_lower_bound',
  'approximate_count_upper_bound', 'delivery_status', 'operation_status',
  'time_created', 'time_updated', 'retention_days',
].join(',');

const DEFAULT_INSIGHT_FIELDS = [
  'impressions', 'reach', 'frequency', 'clicks', 'ctr', 'cpc', 'cpm', 'spend',
  'actions', 'cost_per_action_type', 'objective', 'date_start', 'date_stop',
].join(',');

/* ── Tool definition shape ────────────────────────────────────────────────── */

export interface McpTool<S extends ZodType = ZodType> {
  name: string;
  title: string;
  description: string;
  scope: OAuthScope;
  schema: S;
  run: (userId: string, args: z.infer<S>) => Promise<McpToolResult>;
}

/** Narrow a `{ data?, error? }` graph result into an MCP tool result. */
function fromGraph(res: GraphProxyResult): McpToolResult {
  if (res.error) return toolError(res.error);
  return toolJson(res.data ?? null);
}

/* Helper so `defineTool` keeps each tool's `args` strongly typed. */
function defineTool<S extends ZodType>(tool: McpTool<S>): McpTool {
  return tool as unknown as McpTool;
}

const STATUS_ENUM = z.enum(['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED']);
const targeting = z.record(z.string(), z.any());

/* ── The registry ─────────────────────────────────────────────────────────── */

export const AD_MANAGER_TOOLS: McpTool[] = [
  /* ---- Accounts ---------------------------------------------------------- */
  defineTool({
    name: 'list_ad_accounts',
    title: 'List ad accounts',
    description:
      'List the Meta ad accounts connected to this SabNode workspace. Returns id (act_…), name, currency, account_status and spend.',
    scope: 'ads:read',
    schema: z.object({}),
    async run(userId) {
      try {
        const res = await rustFetchAsUser<{ accounts: unknown[]; error?: string }>(
          userId,
          '/v1/ad-manager/accounts',
          { method: 'POST' },
        );
        if (res.error) return toolError(res.error);
        return toolJson(res.accounts ?? []);
      } catch (e) {
        return toolError(e instanceof Error ? e.message : 'Failed to list ad accounts.');
      }
    },
  }),

  /* ---- Campaigns --------------------------------------------------------- */
  defineTool({
    name: 'list_campaigns',
    title: 'List campaigns',
    description: 'List campaigns under an ad account (act_… id). Optionally filter by effective_status.',
    scope: 'ads:read',
    schema: z.object({
      ad_account_id: z.string().describe('Ad account id, with or without the act_ prefix.'),
      effective_status: z.array(z.string()).optional().describe('e.g. ["ACTIVE","PAUSED"]'),
      limit: z.number().int().positive().max(500).optional(),
    }),
    async run(userId, a) {
      const params: Record<string, unknown> = { fields: CAMPAIGN_FIELDS, limit: a.limit ?? 100 };
      if (a.effective_status) params.effective_status = JSON.stringify(a.effective_status);
      const res = await graphAsUser<{ data: unknown[] }>(userId, `${withActPrefix(a.ad_account_id)}/campaigns`, { params });
      return res.error ? toolError(res.error) : toolJson(res.data?.data ?? []);
    },
  }),
  defineTool({
    name: 'get_campaign',
    title: 'Get campaign',
    description: 'Fetch a single campaign by id with its full field set.',
    scope: 'ads:read',
    schema: z.object({ campaign_id: z.string() }),
    async run(userId, a) {
      return fromGraph(await graphAsUser(userId, a.campaign_id, { params: { fields: CAMPAIGN_FIELDS } }));
    },
  }),
  defineTool({
    name: 'create_campaign',
    title: 'Create campaign',
    description:
      'Create a campaign under an ad account. Defaults to PAUSED so nothing spends until you explicitly activate it.',
    scope: 'ads:write',
    schema: z.object({
      ad_account_id: z.string(),
      name: z.string(),
      objective: z.string().describe('Meta objective, e.g. OUTCOME_TRAFFIC, OUTCOME_SALES, OUTCOME_LEADS.'),
      status: z.enum(['ACTIVE', 'PAUSED']).optional(),
      special_ad_categories: z.array(z.string()).optional(),
      buying_type: z.enum(['AUCTION', 'RESERVED']).optional(),
      bid_strategy: z.string().optional(),
      daily_budget: z.number().int().optional().describe('Minor units (e.g. cents).'),
      lifetime_budget: z.number().int().optional().describe('Minor units (e.g. cents).'),
      start_time: z.string().optional(),
      stop_time: z.string().optional(),
    }),
    async run(userId, a) {
      const body: Record<string, unknown> = {
        name: a.name,
        objective: a.objective,
        status: a.status ?? 'PAUSED',
        special_ad_categories: JSON.stringify((a.special_ad_categories ?? []).filter((c) => c !== 'NONE')),
      };
      for (const k of ['buying_type', 'bid_strategy', 'daily_budget', 'lifetime_budget', 'start_time', 'stop_time'] as const) {
        if (a[k] !== undefined) body[k] = a[k];
      }
      return fromGraph(await graphAsUser(userId, `${withActPrefix(a.ad_account_id)}/campaigns`, { method: 'POST', body }));
    },
  }),
  defineTool({
    name: 'update_campaign',
    title: 'Update campaign',
    description: 'Patch a campaign. Pass only the fields you want to change in `patch`.',
    scope: 'ads:write',
    schema: z.object({ campaign_id: z.string(), patch: z.record(z.string(), z.any()) }),
    async run(userId, a) {
      const body: Record<string, unknown> = { ...a.patch };
      if (Array.isArray(body.special_ad_categories)) body.special_ad_categories = JSON.stringify(body.special_ad_categories);
      return fromGraph(await graphAsUser(userId, a.campaign_id, { method: 'POST', body }));
    },
  }),
  defineTool({
    name: 'delete_campaign',
    title: 'Delete campaign',
    description: 'Permanently delete a campaign. This cannot be undone — prefer pausing for a reversible stop.',
    scope: 'ads:write',
    schema: z.object({ campaign_id: z.string() }),
    async run(userId, a) {
      return fromGraph(await graphAsUser(userId, a.campaign_id, { method: 'DELETE' }));
    },
  }),

  /* ---- Ad sets ----------------------------------------------------------- */
  defineTool({
    name: 'list_ad_sets',
    title: 'List ad sets',
    description: 'List ad sets under an ad account or a single campaign.',
    scope: 'ads:read',
    schema: z.object({
      parent_id: z.string().describe('Ad account id (act_…) or a campaign id.'),
      level: z.enum(['account', 'campaign']).default('account'),
      effective_status: z.array(z.string()).optional(),
      limit: z.number().int().positive().max(500).optional(),
    }),
    async run(userId, a) {
      const prefix = a.level === 'account' ? withActPrefix(a.parent_id) : a.parent_id;
      const params: Record<string, unknown> = { fields: ADSET_FIELDS, limit: a.limit ?? 100 };
      if (a.effective_status) params.effective_status = JSON.stringify(a.effective_status);
      const res = await graphAsUser<{ data: unknown[] }>(userId, `${prefix}/adsets`, { params });
      return res.error ? toolError(res.error) : toolJson(res.data?.data ?? []);
    },
  }),
  defineTool({
    name: 'get_ad_set',
    title: 'Get ad set',
    description: 'Fetch a single ad set by id (includes targeting and optimization config).',
    scope: 'ads:read',
    schema: z.object({ ad_set_id: z.string() }),
    async run(userId, a) {
      return fromGraph(await graphAsUser(userId, a.ad_set_id, { params: { fields: ADSET_FIELDS } }));
    },
  }),
  defineTool({
    name: 'create_ad_set',
    title: 'Create ad set',
    description:
      'Create an ad set under a campaign. Requires a targeting spec and either a daily or lifetime budget (minor units). Defaults to PAUSED.',
    scope: 'ads:write',
    schema: z.object({
      ad_account_id: z.string(),
      name: z.string(),
      campaign_id: z.string(),
      billing_event: z.string().describe('e.g. IMPRESSIONS, LINK_CLICKS.'),
      optimization_goal: z.string().describe('e.g. LINK_CLICKS, OFFSITE_CONVERSIONS, REACH.'),
      targeting: targeting.describe('Meta targeting spec object.'),
      status: z.enum(['ACTIVE', 'PAUSED']).optional(),
      daily_budget: z.number().int().optional(),
      lifetime_budget: z.number().int().optional(),
      bid_amount: z.number().int().optional(),
      bid_strategy: z.string().optional(),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      promoted_object: z.record(z.string(), z.any()).optional(),
      destination_type: z.string().optional(),
    }),
    async run(userId, a) {
      if (a.daily_budget === undefined && a.lifetime_budget === undefined) {
        return toolError('Either daily_budget or lifetime_budget is required.');
      }
      const body: Record<string, unknown> = {
        name: a.name,
        campaign_id: a.campaign_id,
        status: a.status ?? 'PAUSED',
        billing_event: a.billing_event,
        optimization_goal: a.optimization_goal,
        targeting: JSON.stringify(a.targeting),
      };
      if (a.daily_budget !== undefined) body.daily_budget = a.daily_budget;
      if (a.lifetime_budget !== undefined) body.lifetime_budget = a.lifetime_budget;
      if (a.bid_amount !== undefined) body.bid_amount = a.bid_amount;
      if (a.bid_strategy) body.bid_strategy = a.bid_strategy;
      if (a.start_time) body.start_time = a.start_time;
      if (a.end_time) body.end_time = a.end_time;
      if (a.promoted_object) body.promoted_object = JSON.stringify(a.promoted_object);
      if (a.destination_type) body.destination_type = a.destination_type;
      return fromGraph(await graphAsUser(userId, `${withActPrefix(a.ad_account_id)}/adsets`, { method: 'POST', body }));
    },
  }),

  /* ---- Ads --------------------------------------------------------------- */
  defineTool({
    name: 'list_ads',
    title: 'List ads',
    description: 'List ads under an ad account, a campaign, or an ad set.',
    scope: 'ads:read',
    schema: z.object({
      parent_id: z.string().describe('Ad account id (act_…), campaign id, or ad set id.'),
      level: z.enum(['account', 'campaign', 'adset']).default('account'),
      effective_status: z.array(z.string()).optional(),
      limit: z.number().int().positive().max(500).optional(),
    }),
    async run(userId, a) {
      const prefix = a.level === 'account' ? withActPrefix(a.parent_id) : a.parent_id;
      const params: Record<string, unknown> = { fields: AD_FIELDS, limit: a.limit ?? 100 };
      if (a.effective_status) params.effective_status = JSON.stringify(a.effective_status);
      const res = await graphAsUser<{ data: unknown[] }>(userId, `${prefix}/ads`, { params });
      return res.error ? toolError(res.error) : toolJson(res.data?.data ?? []);
    },
  }),
  defineTool({
    name: 'get_ad',
    title: 'Get ad',
    description: 'Fetch a single ad by id, including its creative.',
    scope: 'ads:read',
    schema: z.object({ ad_id: z.string() }),
    async run(userId, a) {
      return fromGraph(await graphAsUser(userId, a.ad_id, { params: { fields: AD_FIELDS } }));
    },
  }),
  defineTool({
    name: 'get_ad_preview',
    title: 'Get ad preview',
    description: 'Render a preview of an ad in a given ad_format. Returns an HTML iframe snippet.',
    scope: 'ads:read',
    schema: z.object({
      ad_id: z.string(),
      ad_format: z.string().describe('e.g. DESKTOP_FEED_STANDARD, MOBILE_FEED_STANDARD, INSTAGRAM_STANDARD.'),
    }),
    async run(userId, a) {
      const res = await graphAsUser<{ data: { body: string }[] }>(userId, `${a.ad_id}/previews`, {
        params: { ad_format: a.ad_format },
      });
      return res.error ? toolError(res.error) : toolJson({ body: res.data?.data?.[0]?.body ?? '' });
    },
  }),

  /* ---- Status control (pause / activate / archive) ----------------------- */
  defineTool({
    name: 'update_entity_status',
    title: 'Update entity status',
    description:
      'Change the status of a campaign, ad set, or ad. Use PAUSED to safely stop delivery and ACTIVE to resume.',
    scope: 'ads:write',
    schema: z.object({
      id: z.string().describe('Campaign, ad set, or ad id.'),
      status: STATUS_ENUM,
    }),
    async run(userId, a) {
      const res = await graphAsUser(userId, a.id, { method: 'POST', body: { status: a.status } });
      return res.error ? toolError(res.error) : toolJson({ success: true, id: a.id, status: a.status });
    },
  }),

  /* ---- Audiences --------------------------------------------------------- */
  defineTool({
    name: 'list_custom_audiences',
    title: 'List custom audiences',
    description: 'List the custom audiences defined on an ad account.',
    scope: 'ads:read',
    schema: z.object({ ad_account_id: z.string() }),
    async run(userId, a) {
      const res = await graphAsUser<{ data: unknown[] }>(userId, `${withActPrefix(a.ad_account_id)}/customaudiences`, {
        params: { fields: AUDIENCE_FIELDS, limit: 100 },
      });
      return res.error ? toolError(res.error) : toolJson(res.data?.data ?? []);
    },
  }),
  defineTool({
    name: 'create_custom_audience',
    title: 'Create custom audience',
    description: 'Create a custom audience (CUSTOM, WEBSITE, APP, ENGAGEMENT, or OFFLINE_CONVERSION).',
    scope: 'ads:write',
    schema: z.object({
      ad_account_id: z.string(),
      name: z.string(),
      subtype: z.enum(['CUSTOM', 'WEBSITE', 'APP', 'ENGAGEMENT', 'OFFLINE_CONVERSION']),
      description: z.string().optional(),
      customer_file_source: z.string().optional(),
      retention_days: z.number().int().optional(),
      rule: z.record(z.string(), z.any()).optional(),
    }),
    async run(userId, a) {
      const body: Record<string, unknown> = { name: a.name, subtype: a.subtype };
      if (a.description) body.description = a.description;
      if (a.customer_file_source) body.customer_file_source = a.customer_file_source;
      if (a.retention_days !== undefined) body.retention_days = a.retention_days;
      if (a.rule) body.rule = JSON.stringify(a.rule);
      return fromGraph(await graphAsUser(userId, `${withActPrefix(a.ad_account_id)}/customaudiences`, { method: 'POST', body }));
    },
  }),

  /* ---- Insights ---------------------------------------------------------- */
  defineTool({
    name: 'get_insights',
    title: 'Get insights',
    description:
      'Pull performance insights (spend, impressions, clicks, CTR, CPC, conversions…) for an account, campaign, ad set, or ad.',
    scope: 'ads:read',
    schema: z.object({
      object_id: z.string().describe('Ad account (act_…), campaign, ad set, or ad id.'),
      level: z.enum(['account', 'campaign', 'adset', 'ad']).default('ad'),
      date_preset: z.string().optional().describe('e.g. last_7d, last_30d, this_month, maximum.'),
      time_range: z.object({ since: z.string(), until: z.string() }).optional().describe('YYYY-MM-DD bounds; overrides date_preset.'),
      breakdowns: z.array(z.string()).optional(),
      fields: z.array(z.string()).optional(),
      time_increment: z.union([z.number(), z.string()]).optional(),
      limit: z.number().int().positive().max(500).optional(),
    }),
    async run(userId, a) {
      const isAct = a.object_id.startsWith('act_') || /^\d+$/.test(a.object_id);
      const nodeId = a.level === 'account' && isAct ? withActPrefix(a.object_id) : a.object_id;
      const params: Record<string, unknown> = {
        fields: (a.fields ?? DEFAULT_INSIGHT_FIELDS.split(',')).join(','),
        level: a.level ?? 'ad',
        limit: a.limit ?? 100,
      };
      if (a.time_range) params.time_range = JSON.stringify(a.time_range);
      if (a.date_preset) params.date_preset = a.date_preset;
      if (a.breakdowns?.length) params.breakdowns = a.breakdowns.join(',');
      if (a.time_increment !== undefined) params.time_increment = a.time_increment;
      const res = await graphAsUser<{ data: unknown[] }>(userId, `${nodeId}/insights`, { params });
      return res.error ? toolError(res.error) : toolJson(res.data?.data ?? []);
    },
  }),
];

/** Fast name → tool lookup. */
export const AD_MANAGER_TOOL_MAP: ReadonlyMap<string, McpTool> = new Map(
  AD_MANAGER_TOOLS.map((t) => [t.name, t]),
);
