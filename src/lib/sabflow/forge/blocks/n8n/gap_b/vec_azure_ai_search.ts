/**
 * Forge block: Azure AI Search (Vector Store)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreAzureAISearch
 *
 * Endpoints:
 *   POST {service}.search.windows.net/indexes/{index}/docs/index?api-version=2023-11-01
 *   POST {service}.search.windows.net/indexes/{index}/docs/search?api-version=2023-11-01
 *
 * Auth: `api-key: <adminKey>` header.
 *
 * Inline credentials — `auth: { type: 'none' }`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API_VERSION = '2023-11-01';

type Vector = { id: string; vector: number[]; metadata?: Record<string, unknown> };

function endpoint(ctx: ForgeActionContext): { url: string; headers: Record<string, string> } {
  const service = asString(ctx.options.service);
  const apiKey = asString(ctx.options.apiKey);
  const index = asString(ctx.options.index);
  if (!service) throw new Error('Azure AI Search: service is required');
  if (!apiKey) throw new Error('Azure AI Search: apiKey is required');
  if (!index) throw new Error('Azure AI Search: index is required');
  const host = `https://${service}.search.windows.net/indexes/${encodeURIComponent(index)}`;
  return {
    url: host,
    headers: {
      'api-key': apiKey,
      Accept: 'application/json',
    },
  };
}

function vectorField(ctx: ForgeActionContext): string {
  return asString(ctx.options.vectorField) || 'contentVector';
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Azure AI Search: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('Azure AI Search: each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const { url, headers } = endpoint(ctx);
  const field = vectorField(ctx);
  const value = vectors.map((v) => ({
    '@search.action': 'mergeOrUpload',
    id: v.id,
    ...(v.metadata ?? {}),
    [field]: v.vector,
  }));
  const res = await apiRequest({
    service: 'Azure AI Search',
    method: 'POST',
    url: `${url}/docs/index?api-version=${API_VERSION}`,
    headers,
    json: { value },
  });
  return {
    outputs: { upserted: vectors.length, raw: res.data },
    logs: [`Azure AI Search upsert → ${vectors.length}`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Azure AI Search: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const filterText = asString(ctx.options.filter);
  const field = vectorField(ctx);
  const { url, headers } = endpoint(ctx);

  const res = await apiRequest({
    service: 'Azure AI Search',
    method: 'POST',
    url: `${url}/docs/search?api-version=${API_VERSION}`,
    headers,
    json: {
      count: true,
      filter: filterText || undefined,
      vectorQueries: [
        {
          kind: 'vector',
          vector: queryVector,
          fields: field,
          k: topK,
        },
      ],
    },
  });
  const body = res.data as { value?: Array<Record<string, unknown> & { '@search.score'?: number }> };
  const results = (body?.value ?? []).map((d) => {
    const { '@search.score': score, id, ...rest } = d as Record<string, unknown> & { '@search.score'?: number; id?: unknown };
    return {
      id: String(id ?? ''),
      score: score ?? 0,
      metadata: rest,
    };
  });
  return {
    outputs: { results, raw: res.data },
    logs: [`Azure AI Search query → ${results.length}`],
  };
}

async function deleteVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idsRaw = asString(ctx.options.ids);
  if (!idsRaw) throw new Error('Azure AI Search: ids is required');
  const ids = (JSON.parse(idsRaw) as unknown[]).map(String);
  const { url, headers } = endpoint(ctx);
  await apiRequest({
    service: 'Azure AI Search',
    method: 'POST',
    url: `${url}/docs/index?api-version=${API_VERSION}`,
    headers,
    json: {
      value: ids.map((id) => ({ '@search.action': 'delete', id })),
    },
  });
  return {
    outputs: { deleted: ids.length },
    logs: [`Azure AI Search delete → ${ids.length}`],
  };
}

const inlineCreds = [
  { id: 'service', label: 'Service name', type: 'text' as const, required: true, placeholder: 'mysearch' },
  { id: 'apiKey', label: 'Admin API key', type: 'password' as const, required: true },
  { id: 'index', label: 'Index name', type: 'text' as const, required: true },
  { id: 'vectorField', label: 'Vector field', type: 'text' as const, placeholder: 'contentVector' },
];

const block: ForgeBlock = {
  id: 'forge_vec_azure_ai_search',
  name: 'Azure AI Search (Vector)',
  description: 'Add, search and delete vectors in an Azure AI Search index.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'mergeOrUpload documents with vector field.',
      fields: [
        ...inlineCreds,
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: upsertVectors,
    },
    {
      id: 'query_vectors',
      label: 'Search vectors',
      description: 'Vector search via the vectorQueries endpoint.',
      fields: [
        ...inlineCreds,
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
        { id: 'filter', label: 'OData filter (optional)', type: 'text' },
      ],
      run: queryVectors,
    },
    {
      id: 'delete_vectors',
      label: 'Delete vectors',
      description: 'Delete documents by id.',
      fields: [
        ...inlineCreds,
        { id: 'ids', label: 'IDs (JSON array)', type: 'textarea', required: true },
      ],
      run: deleteVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
