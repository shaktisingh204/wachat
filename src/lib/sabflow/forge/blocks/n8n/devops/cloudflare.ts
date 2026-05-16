/**
 * Forge block: Cloudflare
 *
 * Source: n8n-master/packages/nodes-base/nodes/Cloudflare/Cloudflare.node.ts
 * Credential type: 'cloudflare' (expects { apiToken, accountId? }).
 *
 * Operations covered (Cloudflare v4 API at https://api.cloudflare.com/client/v4):
 *   - zone.list        GET    /zones
 *   - zone.get         GET    /zones/{id}
 *   - dns.list         GET    /zones/{zoneId}/dns_records
 *   - dns.create       POST   /zones/{zoneId}/dns_records
 *   - cache.purge      POST   /zones/{zoneId}/purge_cache
 *
 * Deferred:
 *   - workers, R2, KV, Pages — bigger surface; ship dedicated blocks later
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const API = 'https://api.cloudflare.com/client/v4';

function bearer(ctx: ForgeActionContext): string {
  const cred = requireCredential('Cloudflare', ctx.credential);
  const t = cred.apiToken;
  if (!t) throw new Error('Cloudflare: credential is missing `apiToken`');
  return `Bearer ${t}`;
}

async function zoneList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const name = asString(ctx.options.name);
  const perPage = asString(ctx.options.perPage);
  if (name) params.set('name', name);
  if (perPage) params.set('per_page', perPage);
  const qs = params.toString();

  const res = await apiRequest({
    service: 'Cloudflare',
    method: 'GET',
    url: `${API}/zones${qs ? `?${qs}` : ''}`,
    headers: { Authorization: bearer(ctx) },
  });
  const body = res.data as { result?: unknown[] };
  const zones = Array.isArray(body?.result) ? body.result : [];
  return {
    outputs: { zones, count: zones.length },
    logs: [`Cloudflare zone list (${zones.length})`],
  };
}

async function zoneGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const zoneId = asString(ctx.options.zoneId);
  if (!zoneId) throw new Error('Cloudflare: zoneId is required');
  const res = await apiRequest({
    service: 'Cloudflare',
    method: 'GET',
    url: `${API}/zones/${encodeURIComponent(zoneId)}`,
    headers: { Authorization: bearer(ctx) },
  });
  const body = res.data as { result?: unknown };
  return {
    outputs: { zone: body?.result },
    logs: [`Cloudflare zone get → ${zoneId}`],
  };
}

async function dnsList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const zoneId = asString(ctx.options.zoneId);
  if (!zoneId) throw new Error('Cloudflare: zoneId is required');

  const params = new URLSearchParams();
  const type = asString(ctx.options.type);
  const name = asString(ctx.options.name);
  if (type) params.set('type', type);
  if (name) params.set('name', name);
  const qs = params.toString();

  const res = await apiRequest({
    service: 'Cloudflare',
    method: 'GET',
    url: `${API}/zones/${encodeURIComponent(zoneId)}/dns_records${qs ? `?${qs}` : ''}`,
    headers: { Authorization: bearer(ctx) },
  });

  const body = res.data as { result?: unknown[] };
  const records = Array.isArray(body?.result) ? body.result : [];
  return {
    outputs: { records, count: records.length },
    logs: [`Cloudflare DNS list → ${zoneId} (${records.length})`],
  };
}

async function dnsCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const zoneId = asString(ctx.options.zoneId);
  const type = asString(ctx.options.type);
  const name = asString(ctx.options.name);
  const content = asString(ctx.options.content);
  if (!zoneId) throw new Error('Cloudflare: zoneId is required');
  if (!type) throw new Error('Cloudflare: type is required');
  if (!name) throw new Error('Cloudflare: name is required');
  if (!content) throw new Error('Cloudflare: content is required');

  const payload: Record<string, unknown> = { type, name, content };
  const ttl = asString(ctx.options.ttl);
  if (ttl) payload.ttl = Number(ttl);
  const proxiedRaw = asString(ctx.options.proxied);
  if (proxiedRaw === 'true') payload.proxied = true;
  if (proxiedRaw === 'false') payload.proxied = false;

  const res = await apiRequest({
    service: 'Cloudflare',
    method: 'POST',
    url: `${API}/zones/${encodeURIComponent(zoneId)}/dns_records`,
    headers: { Authorization: bearer(ctx) },
    json: payload,
  });
  const body = res.data as { result?: { id?: string } };
  return {
    outputs: { record: body?.result },
    logs: [`Cloudflare DNS create → ${type} ${name} (${body?.result?.id ?? '?'})`],
  };
}

async function cachePurge(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const zoneId = asString(ctx.options.zoneId);
  if (!zoneId) throw new Error('Cloudflare: zoneId is required');

  const purgeEverythingRaw = asString(ctx.options.purgeEverything);
  const filesRaw = asString(ctx.options.files);

  const payload: Record<string, unknown> = {};
  if (purgeEverythingRaw === 'true') {
    payload.purge_everything = true;
  } else if (filesRaw) {
    payload.files = filesRaw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  } else {
    throw new Error('Cloudflare: set `purgeEverything` to "true" or provide files');
  }

  const res = await apiRequest({
    service: 'Cloudflare',
    method: 'POST',
    url: `${API}/zones/${encodeURIComponent(zoneId)}/purge_cache`,
    headers: { Authorization: bearer(ctx) },
    json: payload,
  });
  return {
    outputs: { result: res.data },
    logs: [`Cloudflare cache purge → ${zoneId}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_cloudflare',
  name: 'Cloudflare',
  description: 'Manage Cloudflare zones, DNS records and cache purges.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'cloudflare' },
  actions: [
    {
      id: 'zone_list',
      label: 'List zones',
      description: 'List zones visible to this token.',
      fields: [
        { id: 'name', label: 'Filter by name', type: 'text' },
        { id: 'perPage', label: 'Per page', type: 'number', placeholder: '20' },
      ],
      run: zoneList,
    },
    {
      id: 'zone_get',
      label: 'Get zone',
      description: 'Fetch a zone by id.',
      fields: [
        { id: 'zoneId', label: 'Zone ID', type: 'text', required: true },
      ],
      run: zoneGet,
    },
    {
      id: 'dns_list',
      label: 'List DNS records',
      description: 'List DNS records in a zone.',
      fields: [
        { id: 'zoneId', label: 'Zone ID', type: 'text', required: true },
        { id: 'type', label: 'Type', type: 'text', placeholder: 'A | CNAME | TXT…' },
        { id: 'name', label: 'Name filter', type: 'text' },
      ],
      run: dnsList,
    },
    {
      id: 'dns_create',
      label: 'Create DNS record',
      description: 'Add a DNS record to a zone.',
      fields: [
        { id: 'zoneId', label: 'Zone ID', type: 'text', required: true },
        {
          id: 'type',
          label: 'Type',
          type: 'select',
          required: true,
          options: [
            { label: 'A', value: 'A' },
            { label: 'AAAA', value: 'AAAA' },
            { label: 'CNAME', value: 'CNAME' },
            { label: 'TXT', value: 'TXT' },
            { label: 'MX', value: 'MX' },
            { label: 'NS', value: 'NS' },
            { label: 'SRV', value: 'SRV' },
          ],
        },
        { id: 'name', label: 'Name', type: 'text', required: true, placeholder: 'sub.example.com' },
        { id: 'content', label: 'Content', type: 'text', required: true },
        { id: 'ttl', label: 'TTL (seconds)', type: 'number', placeholder: '1 = automatic' },
        {
          id: 'proxied',
          label: 'Proxied (orange-cloud)',
          type: 'select',
          options: [
            { label: 'Inherit', value: '' },
            { label: 'Yes', value: 'true' },
            { label: 'No', value: 'false' },
          ],
        },
      ],
      run: dnsCreate,
    },
    {
      id: 'cache_purge',
      label: 'Purge cache',
      description: 'Purge cache by URL list or everything.',
      fields: [
        { id: 'zoneId', label: 'Zone ID', type: 'text', required: true },
        {
          id: 'purgeEverything',
          label: 'Purge everything',
          type: 'select',
          options: [
            { label: 'No', value: 'false' },
            { label: 'Yes', value: 'true' },
          ],
        },
        {
          id: 'files',
          label: 'Files (one URL per line, ignored if purgeEverything = Yes)',
          type: 'textarea',
          placeholder: 'https://example.com/style.css',
        },
      ],
      run: cachePurge,
    },
  ],
};

registerForgeBlock(block);
export default block;
