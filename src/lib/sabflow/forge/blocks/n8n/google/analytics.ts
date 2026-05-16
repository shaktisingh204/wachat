/**
 * Forge block: Google Analytics (GA4)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Analytics/GoogleAnalytics.node.ts (+ v2)
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline
 *   per action. Access token refreshed per call and cached via _shared/oauth.ts.
 *
 * Operations covered:
 *   - report.run  POST /v1beta/properties/{propertyId}:runReport
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import {
  cacheKeyFor,
  getCachedToken,
  refreshAccessToken,
  setCachedToken,
} from '../_shared/oauth';

const SERVICE = 'Google Analytics';
const CACHE = 'google_analytics';

type OAuthCred = { clientId: string; clientSecret: string; refreshToken: string };

function readCred(ctx: ForgeActionContext): OAuthCred {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${SERVICE}: clientId is required`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

async function getOrRefreshAccessToken(cred: OAuthCred): Promise<string> {
  const key = cacheKeyFor(CACHE, cred.refreshToken);
  const cached = getCachedToken(key);
  if (cached) return cached;
  const { accessToken, expiresIn } = await refreshAccessToken({
    service: SERVICE,
    tokenUrl: 'https://oauth2.googleapis.com/token',
    refreshToken: cred.refreshToken,
    clientId: cred.clientId,
    clientSecret: cred.clientSecret,
  });
  setCachedToken(key, accessToken, expiresIn);
  return accessToken;
}

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

function parseJsonArray(label: string, raw: unknown, required: boolean): unknown[] | undefined {
  const s = asString(raw).trim();
  if (!s) {
    if (required) throw new Error(`${SERVICE}: ${label} is required`);
    return undefined;
  }
  let v: unknown;
  try {
    v = JSON.parse(s);
  } catch {
    throw new Error(`${SERVICE}: ${label} must be valid JSON`);
  }
  if (!Array.isArray(v)) throw new Error(`${SERVICE}: ${label} must be a JSON array`);
  return v;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function reportRun(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const propertyId = asString(ctx.options.propertyId);
  if (!propertyId) throw new Error(`${SERVICE}: propertyId is required`);

  const dimensionsRaw = asString(ctx.options.dimensions);
  const metricsRaw = asString(ctx.options.metrics);
  const dateRangesRaw = asString(ctx.options.dateRanges);

  // Allow simple comma-separated short-hand for dimensions/metrics OR full JSON arrays.
  function shorthand(s: string): { name: string }[] {
    return s.split(',').map((x) => x.trim()).filter(Boolean).map((name) => ({ name }));
  }

  let dimensions: unknown[] | undefined;
  if (dimensionsRaw) {
    if (dimensionsRaw.trim().startsWith('[')) {
      dimensions = parseJsonArray('dimensions', dimensionsRaw, false);
    } else {
      dimensions = shorthand(dimensionsRaw);
    }
  }

  let metrics: unknown[] | undefined;
  if (metricsRaw) {
    if (metricsRaw.trim().startsWith('[')) {
      metrics = parseJsonArray('metrics', metricsRaw, false);
    } else {
      metrics = shorthand(metricsRaw);
    }
  }

  let dateRanges: unknown[] | undefined;
  if (dateRangesRaw) {
    dateRanges = parseJsonArray('dateRanges', dateRangesRaw, false);
  } else {
    const startDate = asString(ctx.options.startDate);
    const endDate = asString(ctx.options.endDate);
    if (startDate && endDate) {
      dateRanges = [{ startDate, endDate }];
    }
  }
  if (!dateRanges || dateRanges.length === 0) {
    throw new Error(`${SERVICE}: dateRanges (or startDate + endDate) is required`);
  }

  const body: Record<string, unknown> = { dateRanges };
  if (dimensions) body.dimensions = dimensions;
  if (metrics) body.metrics = metrics;

  const limit = asString(ctx.options.limit);
  if (limit) body.limit = Number(limit);

  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    headers: { Authorization: `Bearer ${accessToken}` },
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Analytics runReport → properties/${propertyId}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_google_analytics',
  name: 'Google Analytics',
  description: 'Run GA4 Data API reports.',
  iconName: 'LuBarChart3',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'report_run',
      label: 'Run report (GA4)',
      description:
        'Run a GA4 runReport. `dimensions` / `metrics` accept either a comma-separated short-hand (`country,city`) or a full JSON array.',
      fields: [
        ...authFields,
        { id: 'propertyId', label: 'Property ID (numeric)', type: 'text', required: true, placeholder: '123456789' },
        { id: 'dimensions', label: 'Dimensions', type: 'text', placeholder: 'country,city' },
        { id: 'metrics', label: 'Metrics', type: 'text', placeholder: 'activeUsers,sessions' },
        { id: 'startDate', label: 'Start date', type: 'text', placeholder: '7daysAgo' },
        { id: 'endDate', label: 'End date', type: 'text', placeholder: 'today' },
        {
          id: 'dateRanges',
          label: 'Date ranges (JSON, overrides start/end)',
          type: 'json',
          placeholder: '[{"startDate":"7daysAgo","endDate":"today"}]',
        },
        { id: 'limit', label: 'Row limit', type: 'number' },
      ],
      run: reportRun,
    },
  ],
};

registerForgeBlock(block);
export default block;
