/**
 * Forge block: Chroma (Vector Store)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreChroma
 *
 * Endpoints (Chroma v1):
 *   POST {baseUrl}/api/v1/collections/{collection}/upsert
 *   POST {baseUrl}/api/v1/collections/{collection}/query
 *   POST {baseUrl}/api/v1/collections/{collection}/delete
 *
 * Endpoint expects collection IDs (UUIDs) — Chroma v1 lets you use names by
 * appending `?collection_name=true`-style helpers in some clients, but the
 * raw API uses the ID returned by /collections/{name}. For simplicity this
 * block accepts the collection ID directly (Chroma typically returns it when
 * you create the collection).
 *
 * Auth: usually none; some hosted setups use a bearer token.
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

type Vector = { id: string; vector: number[]; metadata?: Record<string, unknown> };

function base(ctx: ForgeActionContext): { url: string; headers: Record<string, string> } {
  const baseUrl = asString(ctx.options.baseUrl).replace(/\/$/, '');
  if (!baseUrl) throw new Error('Chroma: baseUrl is required');
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = asString(ctx.options.token);
  if (token) headers.Authorization = `Bearer ${token}`;
  return { url: baseUrl, headers };
}

function collectionId(ctx: ForgeActionContext): string {
  const c = asString(ctx.options.collection);
  if (!c) throw new Error('Chroma: collection (id) is required');
  return c;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Chroma: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('Chroma: each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const { url, headers } = base(ctx);
  await apiRequest({
    service: 'Chroma',
    method: 'POST',
    url: `${url}/api/v1/collections/${encodeURIComponent(collectionId(ctx))}/upsert`,
    headers,
    json: {
      ids: vectors.map((v) => v.id),
      embeddings: vectors.map((v) => v.vector),
      metadatas: vectors.map((v) => v.metadata ?? {}),
    },
  });
  return {
    outputs: { upserted: vectors.length },
    logs: [`Chroma upsert → ${vectors.length}`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Chroma: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const filterRaw = asString(ctx.options.filter);
  const where = filterRaw ? (JSON.parse(filterRaw) as Record<string, unknown>) : undefined;
  const { url, headers } = base(ctx);

  const res = await apiRequest({
    service: 'Chroma',
    method: 'POST',
    url: `${url}/api/v1/collections/${encodeURIComponent(collectionId(ctx))}/query`,
    headers,
    json: {
      query_embeddings: [queryVector],
      n_results: topK,
      where,
    },
  });
  const body = res.data as {
    ids?: string[][];
    distances?: number[][];
    metadatas?: Array<Array<Record<string, unknown> | null>>;
  };
  const ids = body.ids?.[0] ?? [];
  const distances = body.distances?.[0] ?? [];
  const metadatas = body.metadatas?.[0] ?? [];
  const results = ids.map((id, i) => ({
    id,
    score: 1 - (distances[i] ?? 0),
    metadata: metadatas[i] ?? {},
  }));
  return {
    outputs: { results, raw: res.data },
    logs: [`Chroma query → ${results.length}`],
  };
}

async function deleteVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idsRaw = asString(ctx.options.ids);
  if (!idsRaw) throw new Error('Chroma: ids is required');
  const ids = (JSON.parse(idsRaw) as unknown[]).map(String);
  const { url, headers } = base(ctx);
  await apiRequest({
    service: 'Chroma',
    method: 'POST',
    url: `${url}/api/v1/collections/${encodeURIComponent(collectionId(ctx))}/delete`,
    headers,
    json: { ids },
  });
  return {
    outputs: { deleted: ids.length },
    logs: [`Chroma delete → ${ids.length}`],
  };
}

const inlineCreds = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'http://localhost:8000' },
  { id: 'token', label: 'Bearer token (optional)', type: 'password' as const },
];

const block: ForgeBlock = {
  id: 'forge_vector_chroma',
  name: 'Chroma',
  description: 'Add, search and delete vectors in a Chroma collection.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Upsert vectors into a Chroma collection.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection ID', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: upsertVectors,
    },
    {
      id: 'query_vectors',
      label: 'Search vectors',
      description: 'Query a Chroma collection.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection ID', type: 'text', required: true },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
        { id: 'filter', label: 'Where filter (JSON)', type: 'textarea' },
      ],
      run: queryVectors,
    },
    {
      id: 'delete_vectors',
      label: 'Delete vectors',
      description: 'Delete vectors by id.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection ID', type: 'text', required: true },
        { id: 'ids', label: 'IDs (JSON array)', type: 'textarea', required: true },
      ],
      run: deleteVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
