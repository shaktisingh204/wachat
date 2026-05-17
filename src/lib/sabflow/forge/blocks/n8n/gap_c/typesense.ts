/**
 * Forge block: Typesense
 *
 * Talk to a self-hosted Typesense node — index documents and search.
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
  if (!host) throw new Error('Typesense: host is required');
  return host;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Typesense: apiKey is required');
  return { 'X-TYPESENSE-API-KEY': apiKey, Accept: 'application/json' };
}

function parseJson(input: unknown, label: string): unknown {
  const s = asString(input).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`Typesense: ${label} must be valid JSON`);
  }
}

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const collection = asString(ctx.options.collection);
  const q = asString(ctx.options.query);
  const queryBy = asString(ctx.options.queryBy);
  if (!collection || !queryBy) {
    throw new Error('Typesense: collection and queryBy are required');
  }
  const params = new URLSearchParams({ q, query_by: queryBy });
  const res = await apiRequest({
    service: 'Typesense',
    method: 'GET',
    url: `${baseUrl(ctx)}/collections/${encodeURIComponent(collection)}/documents/search?${params.toString()}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { hits: res.data }, logs: [`Typesense search → ${collection}`] };
}

async function createDocument(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const collection = asString(ctx.options.collection);
  const doc = parseJson(ctx.options.documentJson, 'documentJson');
  if (!collection) throw new Error('Typesense: collection is required');
  if (!doc) throw new Error('Typesense: documentJson is required');
  const res = await apiRequest({
    service: 'Typesense',
    method: 'POST',
    url: `${baseUrl(ctx)}/collections/${encodeURIComponent(collection)}/documents`,
    headers: authHeaders(ctx),
    json: doc,
  });
  return { outputs: { document: res.data }, logs: [`Typesense create doc → ${collection}`] };
}

async function createCollection(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const schema = parseJson(ctx.options.schemaJson, 'schemaJson');
  if (!schema) throw new Error('Typesense: schemaJson is required');
  const res = await apiRequest({
    service: 'Typesense',
    method: 'POST',
    url: `${baseUrl(ctx)}/collections`,
    headers: authHeaders(ctx),
    json: schema,
  });
  return { outputs: { collection: res.data }, logs: ['Typesense create collection'] };
}

const block: ForgeBlock = {
  id: 'forge_typesense',
  name: 'Typesense',
  description: 'Create collections, index documents and search via Typesense.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search',
      label: 'Search collection',
      fields: [
        { id: 'host', label: 'Host', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'query', label: 'Query', type: 'text' },
        { id: 'queryBy', label: 'Query by (field)', type: 'text', required: true },
      ],
      run: search,
    },
    {
      id: 'create_document',
      label: 'Create document',
      fields: [
        { id: 'host', label: 'Host', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'documentJson', label: 'Document (JSON)', type: 'json', required: true },
      ],
      run: createDocument,
    },
    {
      id: 'create_collection',
      label: 'Create collection',
      fields: [
        { id: 'host', label: 'Host', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'schemaJson', label: 'Schema (JSON)', type: 'json', required: true },
      ],
      run: createCollection,
    },
  ],
};

registerForgeBlock(block);
export default block;
