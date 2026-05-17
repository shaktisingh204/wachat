/**
 * Forge block: Meilisearch
 *
 * Talk to a self-hosted Meilisearch instance — index docs and run searches.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const host = asString(ctx.options.host).replace(/\/$/, '');
  if (!host) throw new Error('Meilisearch: host is required');
  return host;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Meilisearch: apiKey is required');
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

function parseJson(input: unknown, label: string): unknown {
  const s = asString(input).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`Meilisearch: ${label} must be valid JSON`);
  }
}

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const index = asString(ctx.options.index);
  const q = asString(ctx.options.query);
  if (!index) throw new Error('Meilisearch: index is required');
  const res = await apiRequest({
    service: 'Meilisearch',
    method: 'POST',
    url: `${baseUrl(ctx)}/indexes/${encodeURIComponent(index)}/search`,
    headers: authHeaders(ctx),
    json: { q },
  });
  return { outputs: { hits: res.data }, logs: [`Meilisearch search → ${index}`] };
}

async function addDocuments(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const index = asString(ctx.options.index);
  const docs = parseJson(ctx.options.documentsJson, 'documentsJson');
  if (!index) throw new Error('Meilisearch: index is required');
  if (!Array.isArray(docs)) throw new Error('Meilisearch: documentsJson must be a JSON array');
  const res = await apiRequest({
    service: 'Meilisearch',
    method: 'POST',
    url: `${baseUrl(ctx)}/indexes/${encodeURIComponent(index)}/documents`,
    headers: authHeaders(ctx),
    json: docs,
  });
  return { outputs: { task: res.data }, logs: [`Meilisearch add docs → ${index}`] };
}

async function deleteIndex(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const index = asString(ctx.options.index);
  if (!index) throw new Error('Meilisearch: index is required');
  const res = await apiRequest({
    service: 'Meilisearch',
    method: 'DELETE',
    url: `${baseUrl(ctx)}/indexes/${encodeURIComponent(index)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { task: res.data }, logs: [`Meilisearch delete index → ${index}`] };
}

const block: ForgeBlock = {
  id: 'forge_meilisearch',
  name: 'Meilisearch',
  description: 'Add documents and run searches against a Meilisearch host.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search',
      label: 'Search index',
      fields: [
        { id: 'host', label: 'Host (https://...)', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'index', label: 'Index UID', type: 'text', required: true },
        { id: 'query', label: 'Query', type: 'text' },
      ],
      run: search,
    },
    {
      id: 'add_documents',
      label: 'Add documents',
      fields: [
        { id: 'host', label: 'Host', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'index', label: 'Index UID', type: 'text', required: true },
        { id: 'documentsJson', label: 'Documents (JSON array)', type: 'json', required: true },
      ],
      run: addDocuments,
    },
    {
      id: 'delete_index',
      label: 'Delete index',
      fields: [
        { id: 'host', label: 'Host', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'index', label: 'Index UID', type: 'text', required: true },
      ],
      run: deleteIndex,
    },
  ],
};

registerForgeBlock(block);
export default block;
