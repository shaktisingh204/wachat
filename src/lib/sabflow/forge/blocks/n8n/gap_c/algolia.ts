/**
 * Forge block: Algolia
 *
 * `https://{app}.algolia.net/1` — index objects and run search queries.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const app = asString(ctx.options.appId);
  if (!app) throw new Error('Algolia: appId is required');
  return `https://${app}-dsn.algolia.net/1`;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const appId = asString(ctx.options.appId);
  const apiKey = asString(ctx.options.apiKey);
  if (!appId || !apiKey) {
    throw new Error('Algolia: appId and apiKey are required');
  }
  return {
    'X-Algolia-Application-Id': appId,
    'X-Algolia-API-Key': apiKey,
    Accept: 'application/json',
  };
}

function parseJson(input: unknown, label: string): unknown {
  const s = asString(input).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`Algolia: ${label} must be valid JSON`);
  }
}

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const index = asString(ctx.options.index);
  const query = asString(ctx.options.query);
  if (!index) throw new Error('Algolia: index is required');
  const res = await apiRequest({
    service: 'Algolia',
    method: 'POST',
    url: `${baseUrl(ctx)}/indexes/${encodeURIComponent(index)}/query`,
    headers: authHeaders(ctx),
    json: { params: `query=${encodeURIComponent(query)}` },
  });
  return { outputs: { results: res.data }, logs: [`Algolia search → ${index}`] };
}

async function saveObject(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const index = asString(ctx.options.index);
  const objectId = asString(ctx.options.objectId);
  const objectJson = parseJson(ctx.options.objectJson, 'objectJson');
  if (!index) throw new Error('Algolia: index is required');
  if (!objectJson) throw new Error('Algolia: objectJson is required');
  const path = objectId
    ? `/indexes/${encodeURIComponent(index)}/${encodeURIComponent(objectId)}`
    : `/indexes/${encodeURIComponent(index)}`;
  const method = objectId ? 'PUT' : 'POST';
  const res = await apiRequest({
    service: 'Algolia',
    method,
    url: `${baseUrl(ctx)}${path}`,
    headers: authHeaders(ctx),
    json: objectJson,
  });
  return { outputs: { result: res.data }, logs: [`Algolia save object → ${index}`] };
}

async function deleteObject(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const index = asString(ctx.options.index);
  const objectId = asString(ctx.options.objectId);
  if (!index || !objectId) {
    throw new Error('Algolia: index and objectId are required');
  }
  const res = await apiRequest({
    service: 'Algolia',
    method: 'DELETE',
    url: `${baseUrl(ctx)}/indexes/${encodeURIComponent(index)}/${encodeURIComponent(objectId)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Algolia delete object → ${objectId}`] };
}

const block: ForgeBlock = {
  id: 'forge_algolia',
  name: 'Algolia',
  description: 'Index and search records in Algolia.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search',
      label: 'Search index',
      fields: [
        { id: 'appId', label: 'App ID', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'index', label: 'Index name', type: 'text', required: true },
        { id: 'query', label: 'Query', type: 'text' },
      ],
      run: search,
    },
    {
      id: 'save_object',
      label: 'Save object',
      fields: [
        { id: 'appId', label: 'App ID', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'index', label: 'Index name', type: 'text', required: true },
        { id: 'objectId', label: 'Object ID (optional)', type: 'text' },
        { id: 'objectJson', label: 'Object (JSON)', type: 'json', required: true },
      ],
      run: saveObject,
    },
    {
      id: 'delete_object',
      label: 'Delete object',
      fields: [
        { id: 'appId', label: 'App ID', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'index', label: 'Index name', type: 'text', required: true },
        { id: 'objectId', label: 'Object ID', type: 'text', required: true },
      ],
      run: deleteObject,
    },
  ],
};

registerForgeBlock(block);
export default block;
