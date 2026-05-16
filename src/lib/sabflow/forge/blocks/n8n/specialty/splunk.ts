/**
 * Forge block: Splunk
 *
 * Source: n8n-master/packages/nodes-base/nodes/Splunk/Splunk.node.ts
 *
 * Splunk Enterprise / Cloud — auth is a bearer-style auth token.
 *
 * Operations covered:
 *   - search.create            POST /services/search/jobs
 *   - search.results           GET  /services/search/jobs/{sid}/results
 *   - search.status            GET  /services/search/jobs/{sid}
 *   - alert.list               GET  /services/alerts/fired_alerts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const url = asString(ctx.options.baseUrl).trim();
  if (!url) throw new Error('Splunk: baseUrl is required');
  return url.replace(/\/$/, '');
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.authToken);
  if (!token) throw new Error('Splunk: authToken is required');
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function searchCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.search);
  if (!query) throw new Error('Splunk: search is required');
  const params = new URLSearchParams();
  const normalized = query.startsWith('search ') || query.startsWith('|') ? query : `search ${query}`;
  params.set('search', normalized);
  params.set('output_mode', 'json');
  const earliest = asString(ctx.options.earliestTime).trim();
  const latest = asString(ctx.options.latestTime).trim();
  if (earliest) params.set('earliest_time', earliest);
  if (latest) params.set('latest_time', latest);
  const res = await apiRequest({
    service: 'Splunk',
    method: 'POST',
    url: `${baseUrl(ctx)}/services/search/jobs`,
    headers: {
      ...authHeader(ctx),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  return { outputs: { job: res.data }, logs: [`Splunk search create → ${query}`] };
}

async function searchResults(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sid = asString(ctx.options.sid);
  if (!sid) throw new Error('Splunk: sid is required');
  const params = new URLSearchParams({ output_mode: 'json' });
  const count = asString(ctx.options.count).trim();
  const offset = asString(ctx.options.offset).trim();
  if (count) params.set('count', count);
  if (offset) params.set('offset', offset);
  const res = await apiRequest({
    service: 'Splunk',
    method: 'GET',
    url: `${baseUrl(ctx)}/services/search/jobs/${encodeURIComponent(sid)}/results?${params.toString()}`,
    headers: authHeader(ctx),
  });
  return { outputs: { results: res.data }, logs: [`Splunk search results → ${sid}`] };
}

async function searchStatus(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sid = asString(ctx.options.sid);
  if (!sid) throw new Error('Splunk: sid is required');
  const res = await apiRequest({
    service: 'Splunk',
    method: 'GET',
    url: `${baseUrl(ctx)}/services/search/jobs/${encodeURIComponent(sid)}?output_mode=json`,
    headers: authHeader(ctx),
  });
  return { outputs: { status: res.data }, logs: [`Splunk search status → ${sid}`] };
}

async function alertList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams({ output_mode: 'json' });
  const count = asString(ctx.options.count).trim();
  if (count) params.set('count', count);
  const res = await apiRequest({
    service: 'Splunk',
    method: 'GET',
    url: `${baseUrl(ctx)}/services/alerts/fired_alerts?${params.toString()}`,
    headers: authHeader(ctx),
  });
  return { outputs: { alerts: res.data }, logs: ['Splunk alert list'] };
}

const CRED_FIELDS = [
  {
    id: 'baseUrl',
    label: 'Base URL',
    type: 'text' as const,
    required: true,
    placeholder: 'https://splunk.example.com:8089',
    helperText: 'Splunk management URL (default port 8089).',
  },
  { id: 'authToken', label: 'Auth token', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_splunk',
  name: 'Splunk',
  description: 'Run Splunk searches, fetch results and list fired alerts.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search_create',
      label: 'Create search',
      description: 'Submit a Splunk search and return the job SID.',
      fields: [
        ...CRED_FIELDS,
        {
          id: 'search',
          label: 'Search',
          type: 'textarea',
          required: true,
          placeholder: 'index=main error | stats count by host',
        },
        { id: 'earliestTime', label: 'Earliest time', type: 'text', placeholder: '-24h' },
        { id: 'latestTime', label: 'Latest time', type: 'text', placeholder: 'now' },
      ],
      run: searchCreate,
    },
    {
      id: 'search_results',
      label: 'Get search results',
      description: 'Fetch results for a previously submitted search job.',
      fields: [
        ...CRED_FIELDS,
        { id: 'sid', label: 'Search SID', type: 'text', required: true },
        { id: 'count', label: 'Count', type: 'number' },
        { id: 'offset', label: 'Offset', type: 'number' },
      ],
      run: searchResults,
    },
    {
      id: 'search_status',
      label: 'Get search status',
      description: 'Inspect the status / metadata of a search job.',
      fields: [
        ...CRED_FIELDS,
        { id: 'sid', label: 'Search SID', type: 'text', required: true },
      ],
      run: searchStatus,
    },
    {
      id: 'alert_list',
      label: 'List fired alerts',
      description: 'List the most recently fired alerts.',
      fields: [
        ...CRED_FIELDS,
        { id: 'count', label: 'Count', type: 'number' },
      ],
      run: alertList,
    },
  ],
};

registerForgeBlock(block);
export default block;
