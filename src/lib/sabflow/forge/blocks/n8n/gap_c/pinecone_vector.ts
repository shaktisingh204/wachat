/**
 * Forge block: Pinecone vector ops
 *
 * Full upsert/query/fetch/delete against a Pinecone index.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const host = asString(ctx.options.indexHost).replace(/\/$/, '');
  if (!host) throw new Error('Pinecone: indexHost is required');
  return host.startsWith('http') ? host : `https://${host}`;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Pinecone: apiKey is required');
  return { 'Api-Key': apiKey, Accept: 'application/json' };
}

function parseJson(input: unknown, label: string): unknown {
  const s = asString(input).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`Pinecone: ${label} must be valid JSON`);
  }
}

async function upsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectorsJson = parseJson(ctx.options.vectorsJson, 'vectorsJson');
  const namespace = asString(ctx.options.namespace);
  if (!Array.isArray(vectorsJson)) {
    throw new Error('Pinecone: vectorsJson must be a JSON array');
  }
  const body: Record<string, unknown> = { vectors: vectorsJson };
  if (namespace) body.namespace = namespace;
  const res = await apiRequest({
    service: 'Pinecone',
    method: 'POST',
    url: `${baseUrl(ctx)}/vectors/upsert`,
    headers: authHeaders(ctx),
    json: body,
  });
  return {
    outputs: { result: res.data },
    logs: [`Pinecone upsert ${vectorsJson.length} vector(s)`],
  };
}

async function query(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vector = parseJson(ctx.options.vectorJson, 'vectorJson');
  const id = asString(ctx.options.id);
  const topK = asNumber(ctx.options.topK) ?? 10;
  const namespace = asString(ctx.options.namespace);
  const includeMetadata = ctx.options.includeMetadata !== false;
  const includeValues = ctx.options.includeValues === true;
  if (!vector && !id) {
    throw new Error('Pinecone: either vectorJson or id is required');
  }
  const body: Record<string, unknown> = {
    topK,
    includeMetadata,
    includeValues,
  };
  if (vector) body.vector = vector;
  if (id) body.id = id;
  if (namespace) body.namespace = namespace;
  const res = await apiRequest({
    service: 'Pinecone',
    method: 'POST',
    url: `${baseUrl(ctx)}/query`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { matches: res.data }, logs: [`Pinecone query topK=${topK}`] };
}

async function fetchVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idsRaw = asString(ctx.options.ids);
  const namespace = asString(ctx.options.namespace);
  const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) throw new Error('Pinecone: ids is required (comma-separated)');
  const params = new URLSearchParams();
  for (const id of ids) params.append('ids', id);
  if (namespace) params.set('namespace', namespace);
  const res = await apiRequest({
    service: 'Pinecone',
    method: 'GET',
    url: `${baseUrl(ctx)}/vectors/fetch?${params.toString()}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { vectors: res.data }, logs: [`Pinecone fetch ${ids.length} id(s)`] };
}

async function deleteVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idsRaw = asString(ctx.options.ids);
  const deleteAll = ctx.options.deleteAll === true;
  const namespace = asString(ctx.options.namespace);
  const body: Record<string, unknown> = {};
  if (deleteAll) body.deleteAll = true;
  else {
    const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) throw new Error('Pinecone: ids or deleteAll is required');
    body.ids = ids;
  }
  if (namespace) body.namespace = namespace;
  const res = await apiRequest({
    service: 'Pinecone',
    method: 'POST',
    url: `${baseUrl(ctx)}/vectors/delete`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: ['Pinecone delete vectors'] };
}

const block: ForgeBlock = {
  id: 'forge_pinecone_vector',
  name: 'Pinecone Vector',
  description: 'Upsert, query, fetch and delete vectors against a Pinecone index.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert',
      label: 'Upsert vectors',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'indexHost', label: 'Index host', type: 'text', required: true },
        { id: 'vectorsJson', label: 'Vectors (JSON array)', type: 'json', required: true },
        { id: 'namespace', label: 'Namespace', type: 'text' },
      ],
      run: upsert,
    },
    {
      id: 'query',
      label: 'Query vectors',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'indexHost', label: 'Index host', type: 'text', required: true },
        { id: 'vectorJson', label: 'Query vector (JSON array)', type: 'json' },
        { id: 'id', label: 'Or query by ID', type: 'text' },
        { id: 'topK', label: 'Top K', type: 'number', defaultValue: 10 },
        { id: 'includeMetadata', label: 'Include metadata', type: 'toggle', defaultValue: true },
        { id: 'includeValues', label: 'Include values', type: 'toggle' },
        { id: 'namespace', label: 'Namespace', type: 'text' },
      ],
      run: query,
    },
    {
      id: 'fetch',
      label: 'Fetch by ids',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'indexHost', label: 'Index host', type: 'text', required: true },
        { id: 'ids', label: 'IDs (comma separated)', type: 'text', required: true },
        { id: 'namespace', label: 'Namespace', type: 'text' },
      ],
      run: fetchVectors,
    },
    {
      id: 'delete',
      label: 'Delete vectors',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'indexHost', label: 'Index host', type: 'text', required: true },
        { id: 'ids', label: 'IDs (comma separated)', type: 'text' },
        { id: 'deleteAll', label: 'Delete all', type: 'toggle' },
        { id: 'namespace', label: 'Namespace', type: 'text' },
      ],
      run: deleteVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
