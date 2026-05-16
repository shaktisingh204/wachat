/**
 * Forge block: Adalo
 *
 * Source: n8n-master/packages/nodes-base/nodes/Adalo/Adalo.node.ts
 *
 * Auth: Bearer apiKey on `https://api.adalo.com/v0/apps/{appId}`.
 *
 * Operations covered:
 *   - collection.list   GET    /collections (returns app collections via meta endpoint stand-in: app data list)
 *   - record.create     POST   /collections/{collection}
 *   - record.get        GET    /collections/{collection}/{id}
 *   - record.list       GET    /collections/{collection}
 *   - record.update     PUT    /collections/{collection}/{id}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const appId = asString(ctx.options.appId);
  if (!appId) throw new Error('Adalo: appId is required');
  return `https://api.adalo.com/v0/apps/${encodeURIComponent(appId)}`;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('Adalo: apiKey is required');
  return { Authorization: `Bearer ${key}`, Accept: 'application/json' };
}

function parseRecord(input: string): Record<string, unknown> {
  if (!input) return {};
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    throw new Error('record JSON must be an object');
  } catch (err) {
    throw new Error(`Adalo: invalid record JSON (${(err as Error).message})`);
  }
}

async function collectionList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Adalo',
    method: 'GET',
    url: `${baseUrl(ctx)}/collections`,
    headers: authHeaders(ctx),
  });
  return { outputs: { collections: res.data }, logs: ['Adalo collection list'] };
}

async function recordCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const collection = asString(ctx.options.collection);
  const recordJson = asString(ctx.options.record);
  if (!collection) throw new Error('Adalo: collection is required');
  const body = parseRecord(recordJson);
  const res = await apiRequest({
    service: 'Adalo',
    method: 'POST',
    url: `${baseUrl(ctx)}/collections/${encodeURIComponent(collection)}`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { record: res.data }, logs: [`Adalo record create → ${collection}`] };
}

async function recordGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const collection = asString(ctx.options.collection);
  const id = asString(ctx.options.recordId);
  if (!collection || !id) throw new Error('Adalo: collection and recordId are required');
  const res = await apiRequest({
    service: 'Adalo',
    method: 'GET',
    url: `${baseUrl(ctx)}/collections/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { record: res.data }, logs: [`Adalo record get → ${collection}/${id}`] };
}

async function recordList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const collection = asString(ctx.options.collection);
  if (!collection) throw new Error('Adalo: collection is required');
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  const offset = asString(ctx.options.offset);
  if (limit) params.set('limit', limit);
  if (offset) params.set('offset', offset);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Adalo',
    method: 'GET',
    url: `${baseUrl(ctx)}/collections/${encodeURIComponent(collection)}${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { records: res.data }, logs: [`Adalo record list → ${collection}`] };
}

async function recordUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const collection = asString(ctx.options.collection);
  const id = asString(ctx.options.recordId);
  const recordJson = asString(ctx.options.record);
  if (!collection || !id) throw new Error('Adalo: collection and recordId are required');
  const body = parseRecord(recordJson);
  const res = await apiRequest({
    service: 'Adalo',
    method: 'PUT',
    url: `${baseUrl(ctx)}/collections/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { record: res.data }, logs: [`Adalo record update → ${collection}/${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_adalo',
  name: 'Adalo',
  description: 'Read and write Adalo collection records.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'collection_list',
      label: 'List collections',
      description: 'Fetch app collections.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'appId', label: 'App ID', type: 'text', required: true },
      ],
      run: collectionList,
    },
    {
      id: 'record_create',
      label: 'Create record',
      description: 'Create a record in a collection.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'appId', label: 'App ID', type: 'text', required: true },
        { id: 'collection', label: 'Collection ID', type: 'text', required: true },
        { id: 'record', label: 'Record JSON', type: 'text', required: true, placeholder: '{"Name":"Jane"}' },
      ],
      run: recordCreate,
    },
    {
      id: 'record_get',
      label: 'Get record',
      description: 'Fetch a single record from a collection.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'appId', label: 'App ID', type: 'text', required: true },
        { id: 'collection', label: 'Collection ID', type: 'text', required: true },
        { id: 'recordId', label: 'Record ID', type: 'text', required: true },
      ],
      run: recordGet,
    },
    {
      id: 'record_list',
      label: 'List records',
      description: 'List records in a collection with optional paging.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'appId', label: 'App ID', type: 'text', required: true },
        { id: 'collection', label: 'Collection ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'offset', label: 'Offset', type: 'number' },
      ],
      run: recordList,
    },
    {
      id: 'record_update',
      label: 'Update record',
      description: 'Update an existing record in a collection.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'appId', label: 'App ID', type: 'text', required: true },
        { id: 'collection', label: 'Collection ID', type: 'text', required: true },
        { id: 'recordId', label: 'Record ID', type: 'text', required: true },
        { id: 'record', label: 'Record JSON', type: 'text', required: true },
      ],
      run: recordUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
