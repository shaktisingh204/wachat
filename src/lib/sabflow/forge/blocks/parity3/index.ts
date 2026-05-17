/**
 * Step parity-3 — ten net-new platform / infra integrations focused on
 * cloud, DNS, and deployment APIs that the earlier parity batches missed.
 * Each block ships its primary action (the 80/20 cut); broader API surface
 * is reachable via the generic HTTP block.
 *
 *   1.  Cloudflare DNS         — create_record
 *   2.  Cloudflare Workers KV  — put_value
 *   3.  Vercel REST            — list_deployments
 *   4.  Linode Cloud           — list_linodes
 *   5.  DigitalOcean           — list_droplets
 *   6.  Heroku Platform        — list_apps
 *   7.  Fly.io                 — list_machines
 *   8.  Render                 — list_services
 *   9.  Railway                — graphql_query
 *   10. Netlify                — list_sites
 */

import { registerForgeBlock } from '../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../types';

/* ── helpers ──────────────────────────────────────────────────────────── */

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

function safeJsonParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

async function jsonRequest(opts: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  rawBody?: string;
}): Promise<unknown> {
  const res = await fetch(opts.url, {
    method: opts.method,
    headers: { Accept: 'application/json', ...opts.headers },
    body:
      opts.rawBody !== undefined
        ? opts.rawBody
        : opts.body === undefined
          ? undefined
          : JSON.stringify(opts.body),
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

function writeOutput(ctx: ForgeActionContext, value: unknown): Record<string, unknown> {
  const key = str(ctx.options.outputVariable);
  return key ? { [key]: value, result: value } : { result: value };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/* ── 1. Cloudflare DNS — create record ────────────────────────────────── */

async function cloudflareDnsCreateRecord(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.apiToken ?? ctx.credential?.token ?? ctx.credential?.apiKey ?? ctx.credential?.accessToken;
  if (!token) throw new Error('Cloudflare DNS: select a credential (API token)');

  const zoneId = str(ctx.options.zoneId);
  if (!zoneId) throw new Error('Cloudflare DNS: zoneId is required');

  const type = (str(ctx.options.type) || 'A').toUpperCase();
  const name = str(ctx.options.name);
  const content = str(ctx.options.content);
  if (!name) throw new Error('Cloudflare DNS: record name is required');
  if (!content) throw new Error('Cloudflare DNS: record content is required');

  const body: Record<string, unknown> = { type, name, content };
  const ttl = Number(ctx.options.ttl);
  if (Number.isFinite(ttl) && ttl > 0) body.ttl = Math.round(ttl);
  if (typeof ctx.options.proxied === 'boolean') body.proxied = ctx.options.proxied;
  const priority = Number(ctx.options.priority);
  if (Number.isFinite(priority) && priority >= 0) body.priority = Math.round(priority);
  const comment = str(ctx.options.comment);
  if (comment) body.comment = comment;
  const extra = asRecord(ctx.options.extra);
  if (extra) Object.assign(body, extra);

  const data = await jsonRequest({
    method: 'POST',
    url: `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/dns_records`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Cloudflare DNS: created ${type} record ${name} in zone ${zoneId}`],
  };
}

registerForgeBlock({
  id: 'forge_cloudflare_dns',
  name: 'Cloudflare DNS',
  description: 'Create a DNS record on a Cloudflare zone.',
  iconName: 'LuGlobe',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'cloudflare' },
  actions: [
    {
      id: 'create_record',
      label: 'Create DNS record',
      description: 'POST /client/v4/zones/{zoneId}/dns_records (Bearer token).',
      fields: [
        { id: 'zoneId',  label: 'Zone ID', type: 'text', required: true },
        { id: 'type',    label: 'Record type (A, AAAA, CNAME, TXT, MX, …)', type: 'text', required: true, placeholder: 'A' },
        { id: 'name',    label: 'Record name (FQDN or @)', type: 'text', required: true },
        { id: 'content', label: 'Record content (IP / target / value)', type: 'text', required: true },
        { id: 'ttl',     label: 'TTL seconds (1 = automatic)', type: 'number' },
        { id: 'proxied', label: 'Proxied through Cloudflare', type: 'toggle' },
        { id: 'priority', label: 'Priority (MX/SRV)', type: 'number' },
        { id: 'comment', label: 'Comment (optional)', type: 'text' },
        { id: 'extra',   label: 'Extra fields (JSON object)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: cloudflareDnsCreateRecord,
    },
  ],
} satisfies ForgeBlock);

/* ── 2. Cloudflare Workers KV — put value ─────────────────────────────── */

async function cloudflareKvPutValue(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.apiToken ?? ctx.credential?.token ?? ctx.credential?.apiKey ?? ctx.credential?.accessToken;
  if (!token) throw new Error('Cloudflare KV: select a credential (API token)');

  const accountId =
    ctx.credential?.accountId ?? str(ctx.options.accountId);
  const namespaceId = str(ctx.options.namespaceId);
  const key = str(ctx.options.key);
  if (!accountId) throw new Error('Cloudflare KV: accountId is required');
  if (!namespaceId) throw new Error('Cloudflare KV: namespaceId is required');
  if (!key) throw new Error('Cloudflare KV: key is required');

  const rawValue = ctx.options.value;
  let bodyStr: string;
  let contentType = 'text/plain';
  if (typeof rawValue === 'string') {
    bodyStr = rawValue;
  } else if (rawValue == null) {
    bodyStr = '';
  } else {
    bodyStr = JSON.stringify(rawValue);
    contentType = 'application/json';
  }

  const params = new URLSearchParams();
  const expirationTtl = Number(ctx.options.expirationTtl);
  if (Number.isFinite(expirationTtl) && expirationTtl > 0) {
    params.set('expiration_ttl', String(Math.round(expirationTtl)));
  }
  const expiration = Number(ctx.options.expiration);
  if (Number.isFinite(expiration) && expiration > 0) {
    params.set('expiration', String(Math.round(expiration)));
  }
  const metadata = asRecord(ctx.options.metadata);
  if (metadata) params.set('metadata', JSON.stringify(metadata));
  const qs = params.toString();

  const url =
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}` +
    `/storage/kv/namespaces/${encodeURIComponent(namespaceId)}` +
    `/values/${encodeURIComponent(key)}${qs ? `?${qs}` : ''}`;

  const data = await jsonRequest({
    method: 'PUT',
    url,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    rawBody: bodyStr,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Cloudflare KV: PUT ${namespaceId}/${key} (${bodyStr.length} bytes)`],
  };
}

registerForgeBlock({
  id: 'forge_cloudflare_kv',
  name: 'Cloudflare Workers KV',
  description: 'Write a value into a Cloudflare Workers KV namespace.',
  iconName: 'LuKeyRound',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'cloudflare' },
  actions: [
    {
      id: 'put_value',
      label: 'Put value',
      description: 'PUT /accounts/{accountId}/storage/kv/namespaces/{namespaceId}/values/{key}.',
      fields: [
        { id: 'accountId',    label: 'Account ID (overrides credential)', type: 'text' },
        { id: 'namespaceId',  label: 'KV Namespace ID', type: 'text', required: true },
        { id: 'key',          label: 'Key', type: 'text', required: true },
        { id: 'value',        label: 'Value (string or JSON)', type: 'textarea' },
        { id: 'expirationTtl', label: 'Expiration TTL (seconds, >=60)', type: 'number' },
        { id: 'expiration',   label: 'Expiration (unix epoch seconds)', type: 'number' },
        { id: 'metadata',     label: 'Metadata (JSON object)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: cloudflareKvPutValue,
    },
  ],
} satisfies ForgeBlock);

/* ── 3. Vercel REST — list deployments ────────────────────────────────── */

async function vercelListDeployments(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.accessToken ?? ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('Vercel: select a credential (Bearer token)');

  const params = new URLSearchParams();
  const projectId = str(ctx.options.projectId);
  if (projectId) params.set('projectId', projectId);
  const app = str(ctx.options.app);
  if (app) params.set('app', app);
  const target = str(ctx.options.target);
  if (target) params.set('target', target);
  const state = str(ctx.options.state);
  if (state) params.set('state', state);
  const limit = Number(ctx.options.limit);
  if (Number.isFinite(limit) && limit > 0) {
    params.set('limit', String(Math.min(100, Math.max(1, Math.round(limit)))));
  }
  const since = Number(ctx.options.since);
  if (Number.isFinite(since) && since > 0) params.set('since', String(Math.round(since)));
  const until = Number(ctx.options.until);
  if (Number.isFinite(until) && until > 0) params.set('until', String(Math.round(until)));
  const teamId =
    ctx.credential?.teamId ?? str(ctx.options.teamId);
  if (teamId) params.set('teamId', teamId);
  const qs = params.toString();

  const data = await jsonRequest({
    method: 'GET',
    url: `https://api.vercel.com/v6/deployments${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Vercel: listed deployments${projectId ? ` for project ${projectId}` : ''}`],
  };
}

registerForgeBlock({
  id: 'forge_vercel_api',
  name: 'Vercel REST',
  description: 'List Vercel deployments via the v6 REST API.',
  iconName: 'LuTriangle',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'vercel' as never },
  actions: [
    {
      id: 'list_deployments',
      label: 'List deployments',
      description: 'GET https://api.vercel.com/v6/deployments with filters.',
      fields: [
        { id: 'projectId', label: 'Project ID (optional)', type: 'text' },
        { id: 'app',       label: 'App name (optional)', type: 'text' },
        { id: 'target',    label: 'Target (production / preview)', type: 'text' },
        { id: 'state',     label: 'State (BUILDING / READY / ERROR / …)', type: 'text' },
        { id: 'limit',     label: 'Limit (1–100)', type: 'number' },
        { id: 'since',     label: 'Since (unix ms)', type: 'number' },
        { id: 'until',     label: 'Until (unix ms)', type: 'number' },
        { id: 'teamId',    label: 'Team ID (overrides credential)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: vercelListDeployments,
    },
  ],
} satisfies ForgeBlock);

/* ── 4. Linode — list instances ───────────────────────────────────────── */

async function linodeListInstances(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.personalAccessToken ?? ctx.credential?.accessToken ??
    ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('Linode: select a credential (personal access token)');

  const params = new URLSearchParams();
  const page = Number(ctx.options.page);
  if (Number.isFinite(page) && page > 0) params.set('page', String(Math.round(page)));
  const pageSize = Number(ctx.options.pageSize);
  if (Number.isFinite(pageSize) && pageSize > 0) {
    params.set('page_size', String(Math.min(500, Math.max(1, Math.round(pageSize)))));
  }
  const qs = params.toString();

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const filter = asRecord(ctx.options.filter);
  if (filter) headers['X-Filter'] = JSON.stringify(filter);

  const data = await jsonRequest({
    method: 'GET',
    url: `https://api.linode.com/v4/linode/instances${qs ? `?${qs}` : ''}`,
    headers,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: ['Linode: listed instances'],
  };
}

registerForgeBlock({
  id: 'forge_linode',
  name: 'Linode Cloud',
  description: 'List Linode compute instances on the current account.',
  iconName: 'LuServer',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'linode' as never },
  actions: [
    {
      id: 'list_linodes',
      label: 'List Linodes',
      description: 'GET https://api.linode.com/v4/linode/instances (Bearer token).',
      fields: [
        { id: 'page',     label: 'Page (1-based)', type: 'number' },
        { id: 'pageSize', label: 'Page size (1–500)', type: 'number' },
        { id: 'filter',   label: 'X-Filter (JSON object)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: linodeListInstances,
    },
  ],
} satisfies ForgeBlock);

/* ── 5. DigitalOcean — list droplets ──────────────────────────────────── */

async function digitalOceanListDroplets(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.accessToken ?? ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('DigitalOcean: select a credential (Bearer token)');

  const params = new URLSearchParams();
  const page = Number(ctx.options.page);
  if (Number.isFinite(page) && page > 0) params.set('page', String(Math.round(page)));
  const perPage = Number(ctx.options.perPage);
  if (Number.isFinite(perPage) && perPage > 0) {
    params.set('per_page', String(Math.min(200, Math.max(1, Math.round(perPage)))));
  }
  const tagName = str(ctx.options.tagName);
  if (tagName) params.set('tag_name', tagName);
  const qs = params.toString();

  const data = await jsonRequest({
    method: 'GET',
    url: `https://api.digitalocean.com/v2/droplets${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`DigitalOcean: listed droplets${tagName ? ` (tag=${tagName})` : ''}`],
  };
}

registerForgeBlock({
  id: 'forge_digitalocean',
  name: 'DigitalOcean',
  description: 'List DigitalOcean droplets on the current account.',
  iconName: 'LuDroplet',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'digitalocean' as never },
  actions: [
    {
      id: 'list_droplets',
      label: 'List droplets',
      description: 'GET https://api.digitalocean.com/v2/droplets (Bearer token).',
      fields: [
        { id: 'page',     label: 'Page (1-based)', type: 'number' },
        { id: 'perPage',  label: 'Per page (1–200)', type: 'number' },
        { id: 'tagName',  label: 'Filter by tag (optional)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: digitalOceanListDroplets,
    },
  ],
} satisfies ForgeBlock);

/* ── 6. Heroku — list apps ────────────────────────────────────────────── */

async function herokuListApps(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.apiKey ?? ctx.credential?.token ?? ctx.credential?.accessToken;
  if (!token) throw new Error('Heroku: select a credential (API key / OAuth token)');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.heroku+json; version=3',
  };
  const range = str(ctx.options.range);
  if (range) headers.Range = range;

  const params = new URLSearchParams();
  const personal = ctx.options.personal;
  if (personal === true) params.set('personal', 'true');
  else if (personal === false) params.set('personal', 'false');
  const qs = params.toString();

  const data = await jsonRequest({
    method: 'GET',
    url: `https://api.heroku.com/apps${qs ? `?${qs}` : ''}`,
    headers,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: ['Heroku: listed apps'],
  };
}

registerForgeBlock({
  id: 'forge_heroku',
  name: 'Heroku Platform',
  description: 'List Heroku apps accessible to the credential.',
  iconName: 'LuRocket',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'heroku' as never },
  actions: [
    {
      id: 'list_apps',
      label: 'List apps',
      description: 'GET https://api.heroku.com/apps (Accept: application/vnd.heroku+json; version=3).',
      fields: [
        { id: 'personal', label: 'Personal apps only', type: 'toggle' },
        { id: 'range',    label: 'Range header (pagination)', type: 'text', placeholder: 'name ..; max=200' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: herokuListApps,
    },
  ],
} satisfies ForgeBlock);

/* ── 7. Fly.io — list machines ────────────────────────────────────────── */

async function flyioListMachines(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.accessToken ?? ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('Fly.io: select a credential (Bearer token)');

  const appName =
    ctx.credential?.appName ?? str(ctx.options.appName);
  if (!appName) throw new Error('Fly.io: appName is required');

  const params = new URLSearchParams();
  const includeDeleted = ctx.options.includeDeleted;
  if (includeDeleted === true) params.set('include_deleted', 'true');
  const region = str(ctx.options.region);
  if (region) params.set('region', region);
  const state = str(ctx.options.state);
  if (state) params.set('state', state);
  const qs = params.toString();

  const data = await jsonRequest({
    method: 'GET',
    url: `https://api.machines.dev/v1/apps/${encodeURIComponent(appName)}/machines${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Fly.io: listed machines for ${appName}`],
  };
}

registerForgeBlock({
  id: 'forge_flyio',
  name: 'Fly.io',
  description: 'List Fly.io machines for an application.',
  iconName: 'LuPlane',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'flyio' as never },
  actions: [
    {
      id: 'list_machines',
      label: 'List machines',
      description: 'GET https://api.machines.dev/v1/apps/{appName}/machines.',
      fields: [
        { id: 'appName',        label: 'App name (overrides credential)', type: 'text', required: true },
        { id: 'region',         label: 'Filter by region (optional)', type: 'text' },
        { id: 'state',          label: 'Filter by state (optional)', type: 'text' },
        { id: 'includeDeleted', label: 'Include deleted machines', type: 'toggle' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: flyioListMachines,
    },
  ],
} satisfies ForgeBlock);

/* ── 8. Render — list services ────────────────────────────────────────── */

async function renderListServices(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.apiKey ?? ctx.credential?.token ?? ctx.credential?.accessToken;
  if (!token) throw new Error('Render: select a credential (Bearer token)');

  const params = new URLSearchParams();
  const limit = Number(ctx.options.limit);
  if (Number.isFinite(limit) && limit > 0) {
    params.set('limit', String(Math.min(100, Math.max(1, Math.round(limit)))));
  }
  const cursor = str(ctx.options.cursor);
  if (cursor) params.set('cursor', cursor);
  const type = str(ctx.options.serviceType);
  if (type) params.set('type', type);
  const name = str(ctx.options.name);
  if (name) params.set('name', name);
  const ownerId = str(ctx.options.ownerId);
  if (ownerId) params.set('ownerId', ownerId);
  const qs = params.toString();

  const data = await jsonRequest({
    method: 'GET',
    url: `https://api.render.com/v1/services${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: ['Render: listed services'],
  };
}

registerForgeBlock({
  id: 'forge_render',
  name: 'Render',
  description: 'List Render services on the current account.',
  iconName: 'LuLayers',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'render' as never },
  actions: [
    {
      id: 'list_services',
      label: 'List services',
      description: 'GET https://api.render.com/v1/services (Bearer token).',
      fields: [
        { id: 'limit',       label: 'Limit (1–100)', type: 'number' },
        { id: 'cursor',      label: 'Cursor (pagination)', type: 'text' },
        { id: 'serviceType', label: 'Type (web_service / static_site / background_worker / …)', type: 'text' },
        { id: 'name',        label: 'Filter by name (optional)', type: 'text' },
        { id: 'ownerId',     label: 'Owner ID (optional)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: renderListServices,
    },
  ],
} satisfies ForgeBlock);

/* ── 9. Railway — GraphQL query ───────────────────────────────────────── */

async function railwayGraphqlQuery(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.apiToken ?? ctx.credential?.token ?? ctx.credential?.apiKey ?? ctx.credential?.accessToken;
  if (!token) throw new Error('Railway: select a credential (project / team API token)');

  const query = str(ctx.options.query);
  if (!query) throw new Error('Railway: query is required');

  const body: Record<string, unknown> = { query };
  const variables = asRecord(ctx.options.variables);
  if (variables) body.variables = variables;
  const operationName = str(ctx.options.operationName);
  if (operationName) body.operationName = operationName;

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://backboard.railway.com/graphql/v2',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Railway: ran GraphQL query${operationName ? ` (${operationName})` : ''}`],
  };
}

registerForgeBlock({
  id: 'forge_railway',
  name: 'Railway',
  description: 'Run a GraphQL query against the Railway Backboard API.',
  iconName: 'LuTrain',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'railway' as never },
  actions: [
    {
      id: 'graphql_query',
      label: 'GraphQL query',
      description: 'POST https://backboard.railway.com/graphql/v2 (Bearer token).',
      fields: [
        { id: 'query',         label: 'GraphQL query / mutation', type: 'code', required: true },
        { id: 'variables',     label: 'Variables (JSON object)', type: 'json' },
        { id: 'operationName', label: 'Operation name (optional)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: railwayGraphqlQuery,
    },
  ],
} satisfies ForgeBlock);

/* ── 10. Netlify — list sites ─────────────────────────────────────────── */

async function netlifyListSites(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.accessToken ?? ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('Netlify: select a credential (personal access token)');

  const params = new URLSearchParams();
  const name = str(ctx.options.name);
  if (name) params.set('name', name);
  const filter = str(ctx.options.filter);
  if (filter) params.set('filter', filter);
  const page = Number(ctx.options.page);
  if (Number.isFinite(page) && page > 0) params.set('page', String(Math.round(page)));
  const perPage = Number(ctx.options.perPage);
  if (Number.isFinite(perPage) && perPage > 0) {
    params.set('per_page', String(Math.min(100, Math.max(1, Math.round(perPage)))));
  }
  const qs = params.toString();

  const data = await jsonRequest({
    method: 'GET',
    url: `https://api.netlify.com/api/v1/sites${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: ['Netlify: listed sites'],
  };
}

registerForgeBlock({
  id: 'forge_netlify',
  name: 'Netlify',
  description: 'List Netlify sites accessible to the credential.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'netlify' },
  actions: [
    {
      id: 'list_sites',
      label: 'List sites',
      description: 'GET https://api.netlify.com/api/v1/sites (Bearer token).',
      fields: [
        { id: 'name',    label: 'Filter by name (optional)', type: 'text' },
        { id: 'filter',  label: 'Filter (all / owner / guest)', type: 'text' },
        { id: 'page',    label: 'Page (1-based)', type: 'number' },
        { id: 'perPage', label: 'Per page (1–100)', type: 'number' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: netlifyListSites,
    },
  ],
} satisfies ForgeBlock);

export const STEP_PLUS_PARITY3_BLOCK_IDS = [
  'forge_cloudflare_dns',
  'forge_cloudflare_kv',
  'forge_vercel_api',
  'forge_linode',
  'forge_digitalocean',
  'forge_heroku',
  'forge_flyio',
  'forge_render',
  'forge_railway',
  'forge_netlify',
] as const;
