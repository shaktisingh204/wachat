/**
 * Forge block: ChromaDB (full ops)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreChroma
 *
 * Full collection CRUD + query. Mirrors the parent block but adds
 * collection create/delete/list endpoints:
 *
 *   GET    {baseUrl}/api/v1/collections                        (list)
 *   POST   {baseUrl}/api/v1/collections                        (create)
 *   DELETE {baseUrl}/api/v1/collections/{name}                 (delete)
 *   POST   {baseUrl}/api/v1/collections/{id}/upsert            (upsert)
 *   POST   {baseUrl}/api/v1/collections/{id}/query             (query)
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
  if (!baseUrl) throw new Error('ChromaDB: baseUrl is required');
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = asString(ctx.options.token);
  if (token) headers.Authorization = `Bearer ${token}`;
  return { url: baseUrl, headers };
}

function collectionRef(ctx: ForgeActionContext): string {
  const c = asString(ctx.options.collection);
  if (!c) throw new Error('ChromaDB: collection is required');
  return c;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('ChromaDB: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('ChromaDB: each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function listCollections(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, headers } = base(ctx);
  const res = await apiRequest({
    service: 'ChromaDB',
    method: 'GET',
    url: `${url}/api/v1/collections`,
    headers,
  });
  const body = (res.data ?? []) as Array<Record<string, unknown>>;
  return {
    outputs: { collections: body, count: Array.isArray(body) ? body.length : 0 },
    logs: [`ChromaDB list → ${Array.isArray(body) ? body.length : 0}`],
  };
}

async function createCollection(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('ChromaDB: name is required');
  const metaRaw = asString(ctx.options.metadata);
  const metadata = metaRaw ? (JSON.parse(metaRaw) as Record<string, unknown>) : undefined;
  const { url, headers } = base(ctx);
  const res = await apiRequest({
    service: 'ChromaDB',
    method: 'POST',
    url: `${url}/api/v1/collections`,
    headers,
    json: { name, metadata, get_or_create: true },
  });
  return {
    outputs: { collection: res.data },
    logs: [`ChromaDB create → ${name}`],
  };
}

async function deleteCollection(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('ChromaDB: name is required');
  const { url, headers } = base(ctx);
  await apiRequest({
    service: 'ChromaDB',
    method: 'DELETE',
    url: `${url}/api/v1/collections/${encodeURIComponent(name)}`,
    headers,
  });
  return {
    outputs: { deleted: name },
    logs: [`ChromaDB delete collection → ${name}`],
  };
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const { url, headers } = base(ctx);
  await apiRequest({
    service: 'ChromaDB',
    method: 'POST',
    url: `${url}/api/v1/collections/${encodeURIComponent(collectionRef(ctx))}/upsert`,
    headers,
    json: {
      ids: vectors.map((v) => v.id),
      embeddings: vectors.map((v) => v.vector),
      metadatas: vectors.map((v) => v.metadata ?? {}),
    },
  });
  return {
    outputs: { upserted: vectors.length },
    logs: [`ChromaDB upsert → ${vectors.length}`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('ChromaDB: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const filterRaw = asString(ctx.options.filter);
  const where = filterRaw ? (JSON.parse(filterRaw) as Record<string, unknown>) : undefined;
  const { url, headers } = base(ctx);

  const res = await apiRequest({
    service: 'ChromaDB',
    method: 'POST',
    url: `${url}/api/v1/collections/${encodeURIComponent(collectionRef(ctx))}/query`,
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
    logs: [`ChromaDB query → ${results.length}`],
  };
}

const inlineCreds = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'http://localhost:8000' },
  { id: 'token', label: 'Bearer token (optional)', type: 'password' as const },
];

const block: ForgeBlock = {
  id: 'forge_vec_chromadb_full',
  name: 'ChromaDB (full ops)',
  description: 'Full ChromaDB ops — collection CRUD plus vector upsert and query.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_collections',
      label: 'List collections',
      description: 'List collections on the Chroma server.',
      fields: [...inlineCreds],
      run: listCollections,
    },
    {
      id: 'create_collection',
      label: 'Create collection',
      description: 'Create (get-or-create) a collection.',
      fields: [
        ...inlineCreds,
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'metadata', label: 'Metadata (JSON)', type: 'textarea' },
      ],
      run: createCollection,
    },
    {
      id: 'delete_collection',
      label: 'Delete collection',
      description: 'Delete a collection by name.',
      fields: [
        ...inlineCreds,
        { id: 'name', label: 'Name', type: 'text', required: true },
      ],
      run: deleteCollection,
    },
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Upsert vectors into a collection.',
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
  ],
};

registerForgeBlock(block);
export default block;
