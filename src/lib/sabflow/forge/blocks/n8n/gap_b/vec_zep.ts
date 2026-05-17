/**
 * Forge block: Zep (Vector Store)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreZep
 *
 * Endpoints:
 *   POST   {baseUrl}/api/v1/collection/{name}/document             (upsert)
 *   POST   {baseUrl}/api/v1/collection/{name}/document/search      (query)
 *   DELETE {baseUrl}/api/v1/collection/{name}/document/uuid/{uuid} (delete one)
 *
 * Auth: `Authorization: Bearer <apiKey>`.
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

type Vector = { id: string; vector: number[]; metadata?: Record<string, unknown>; content?: string };

function base(ctx: ForgeActionContext): { url: string; headers: Record<string, string> } {
  const baseUrl = asString(ctx.options.baseUrl).replace(/\/$/, '');
  const apiKey = asString(ctx.options.apiKey);
  if (!baseUrl) throw new Error('Zep: baseUrl is required');
  if (!apiKey) throw new Error('Zep: apiKey is required');
  return {
    url: baseUrl,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  };
}

function collection(ctx: ForgeActionContext): string {
  const c = asString(ctx.options.collection);
  if (!c) throw new Error('Zep: collection is required');
  return c;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Zep: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('Zep: each vector requires { id, vector[] }');
    return {
      id: String(o.id),
      vector: o.vector.map(Number),
      metadata: o.metadata,
      content: o.content,
    };
  });
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const { url, headers } = base(ctx);
  await apiRequest({
    service: 'Zep',
    method: 'POST',
    url: `${url}/api/v1/collection/${encodeURIComponent(collection(ctx))}/document`,
    headers,
    json: vectors.map((v) => ({
      document_id: v.id,
      content: v.content ?? '',
      embedding: v.vector,
      metadata: v.metadata ?? {},
    })),
  });
  return {
    outputs: { upserted: vectors.length },
    logs: [`Zep upsert → ${vectors.length}`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Zep: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const filterRaw = asString(ctx.options.filter);
  const metadata = filterRaw ? (JSON.parse(filterRaw) as Record<string, unknown>) : undefined;
  const { url, headers } = base(ctx);

  const res = await apiRequest({
    service: 'Zep',
    method: 'POST',
    url: `${url}/api/v1/collection/${encodeURIComponent(collection(ctx))}/document/search?limit=${topK}`,
    headers,
    json: { embedding: queryVector, metadata },
  });
  const body = res.data as { results?: Array<{ document_id: string; score?: number; metadata?: Record<string, unknown> }> };
  const results = (body?.results ?? []).map((m) => ({
    id: m.document_id,
    score: m.score ?? 0,
    metadata: m.metadata ?? {},
  }));
  return {
    outputs: { results, raw: res.data },
    logs: [`Zep query → ${results.length}`],
  };
}

async function deleteVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idsRaw = asString(ctx.options.ids);
  if (!idsRaw) throw new Error('Zep: ids is required');
  const ids = (JSON.parse(idsRaw) as unknown[]).map(String);
  const { url, headers } = base(ctx);
  let deleted = 0;
  for (const id of ids) {
    await apiRequest({
      service: 'Zep',
      method: 'DELETE',
      url: `${url}/api/v1/collection/${encodeURIComponent(collection(ctx))}/document/uuid/${encodeURIComponent(id)}`,
      headers,
    });
    deleted += 1;
  }
  return {
    outputs: { deleted },
    logs: [`Zep delete → ${deleted}`],
  };
}

const inlineCreds = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'http://localhost:8000' },
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_vec_zep',
  name: 'Zep',
  description: 'Add, search and delete documents in a Zep vector collection.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Upsert documents with embeddings into Zep.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, content?, metadata? })', type: 'textarea', required: true },
      ],
      run: upsertVectors,
    },
    {
      id: 'query_vectors',
      label: 'Search vectors',
      description: 'Search Zep by embedding.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
        { id: 'filter', label: 'Metadata filter (JSON)', type: 'textarea' },
      ],
      run: queryVectors,
    },
    {
      id: 'delete_vectors',
      label: 'Delete vectors',
      description: 'Delete documents by id.',
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
