/**
 * Forge block: Qdrant (Vector Store)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreQdrant
 *
 * Endpoints:
 *   PUT    {baseUrl}/collections/{collection}/points          (upsert)
 *   POST   {baseUrl}/collections/{collection}/points/search   (query)
 *   POST   {baseUrl}/collections/{collection}/points/delete   (delete)
 *
 * Header: `api-key: <apiKey>` (optional when running locally).
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

type Vector = { id: string | number; vector: number[]; metadata?: Record<string, unknown> };

function base(ctx: ForgeActionContext): { url: string; headers: Record<string, string> } {
  const baseUrl = asString(ctx.options.baseUrl).replace(/\/$/, '');
  if (!baseUrl) throw new Error('Qdrant: baseUrl is required');
  const headers: Record<string, string> = { Accept: 'application/json' };
  const apiKey = asString(ctx.options.apiKey);
  if (apiKey) headers['api-key'] = apiKey;
  return { url: baseUrl, headers };
}

function collection(ctx: ForgeActionContext): string {
  const c = asString(ctx.options.collection);
  if (!c) throw new Error('Qdrant: collection is required');
  return c;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Qdrant: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (o?.id == null || !Array.isArray(o.vector))
      throw new Error('Qdrant: each vector requires { id, vector[] }');
    return { id: o.id, vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const { url, headers } = base(ctx);
  await apiRequest({
    service: 'Qdrant',
    method: 'PUT',
    url: `${url}/collections/${encodeURIComponent(collection(ctx))}/points`,
    headers,
    json: {
      points: vectors.map((v) => ({ id: v.id, vector: v.vector, payload: v.metadata ?? {} })),
    },
  });
  return {
    outputs: { upserted: vectors.length },
    logs: [`Qdrant upsert → ${vectors.length}`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Qdrant: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const filterRaw = asString(ctx.options.filter);
  const filter = filterRaw ? (JSON.parse(filterRaw) as Record<string, unknown>) : undefined;
  const { url, headers } = base(ctx);

  const res = await apiRequest({
    service: 'Qdrant',
    method: 'POST',
    url: `${url}/collections/${encodeURIComponent(collection(ctx))}/points/search`,
    headers,
    json: { vector: queryVector, limit: topK, filter, with_payload: true },
  });
  const body = res.data as { result?: Array<{ id: string | number; score: number; payload?: Record<string, unknown> }> };
  const results = (body?.result ?? []).map((m) => ({
    id: m.id,
    score: m.score,
    metadata: m.payload ?? {},
  }));
  return {
    outputs: { results, raw: res.data },
    logs: [`Qdrant query → ${results.length}`],
  };
}

async function deleteVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idsRaw = asString(ctx.options.ids);
  if (!idsRaw) throw new Error('Qdrant: ids is required');
  const ids = JSON.parse(idsRaw) as Array<string | number>;
  const { url, headers } = base(ctx);
  await apiRequest({
    service: 'Qdrant',
    method: 'POST',
    url: `${url}/collections/${encodeURIComponent(collection(ctx))}/points/delete`,
    headers,
    json: { points: ids },
  });
  return {
    outputs: { deleted: ids.length },
    logs: [`Qdrant delete → ${ids.length}`],
  };
}

const inlineCreds = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'http://localhost:6333' },
  { id: 'apiKey', label: 'API key (optional)', type: 'password' as const },
];

const block: ForgeBlock = {
  id: 'forge_vector_qdrant',
  name: 'Qdrant',
  description: 'Add, search and delete vectors in a Qdrant collection.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Upsert points into a Qdrant collection.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: upsertVectors,
    },
    {
      id: 'query_vectors',
      label: 'Search vectors',
      description: 'Search a Qdrant collection by vector.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
        { id: 'filter', label: 'Filter (Qdrant JSON)', type: 'textarea' },
      ],
      run: queryVectors,
    },
    {
      id: 'delete_vectors',
      label: 'Delete vectors',
      description: 'Delete points by id.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'ids', label: 'IDs (JSON array)', type: 'textarea', required: true },
      ],
      run: deleteVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
