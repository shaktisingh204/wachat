/**
 * Forge block: Milvus (Vector Store)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreMilvus
 *
 * Endpoints (Milvus REST v1):
 *   POST   {baseUrl}/v1/vector/insert
 *   POST   {baseUrl}/v1/vector/search
 *   POST   {baseUrl}/v1/vector/delete
 *
 * Header: `Authorization: Bearer <token>` (token is "user:password" base64 for Zilliz Cloud).
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
  if (!baseUrl) throw new Error('Milvus: baseUrl is required');
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = asString(ctx.options.token);
  if (token) headers.Authorization = `Bearer ${token}`;
  return { url: baseUrl, headers };
}

function collectionName(ctx: ForgeActionContext): string {
  const c = asString(ctx.options.collection);
  if (!c) throw new Error('Milvus: collection is required');
  return c;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Milvus: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (o?.id == null || !Array.isArray(o.vector))
      throw new Error('Milvus: each vector requires { id, vector[] }');
    return { id: o.id, vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const { url, headers } = base(ctx);
  const data = vectors.map((v) => ({ id: v.id, vector: v.vector, ...(v.metadata ?? {}) }));
  await apiRequest({
    service: 'Milvus',
    method: 'POST',
    url: `${url}/v1/vector/insert`,
    headers,
    json: { collectionName: collectionName(ctx), data },
  });
  return {
    outputs: { upserted: vectors.length },
    logs: [`Milvus insert → ${vectors.length}`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Milvus: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const filter = asString(ctx.options.filter);
  const { url, headers } = base(ctx);

  const res = await apiRequest({
    service: 'Milvus',
    method: 'POST',
    url: `${url}/v1/vector/search`,
    headers,
    json: {
      collectionName: collectionName(ctx),
      vector: queryVector,
      limit: topK,
      filter: filter || undefined,
      outputFields: ['*'],
    },
  });
  const body = res.data as { data?: Array<Record<string, unknown> & { id?: string | number; distance?: number }> };
  const results = (body?.data ?? []).map((row) => {
    const { id, distance, ...metadata } = row;
    return { id: String(id ?? ''), score: typeof distance === 'number' ? distance : 0, metadata };
  });
  return {
    outputs: { results, raw: res.data },
    logs: [`Milvus query → ${results.length}`],
  };
}

async function deleteVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idsRaw = asString(ctx.options.ids);
  if (!idsRaw) throw new Error('Milvus: ids is required');
  const ids = JSON.parse(idsRaw) as Array<string | number>;
  const { url, headers } = base(ctx);
  await apiRequest({
    service: 'Milvus',
    method: 'POST',
    url: `${url}/v1/vector/delete`,
    headers,
    json: { collectionName: collectionName(ctx), id: ids },
  });
  return {
    outputs: { deleted: ids.length },
    logs: [`Milvus delete → ${ids.length}`],
  };
}

const inlineCreds = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'https://in03-xxxx.api.gcp-us-west1.zillizcloud.com' },
  { id: 'token', label: 'Token', type: 'password' as const },
];

const block: ForgeBlock = {
  id: 'forge_vector_milvus',
  name: 'Milvus',
  description: 'Add, search and delete vectors in a Milvus collection.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Insert vectors into a Milvus collection.',
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
      description: 'Search a Milvus collection by vector.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
        { id: 'filter', label: 'Filter expression', type: 'text' },
      ],
      run: queryVectors,
    },
    {
      id: 'delete_vectors',
      label: 'Delete vectors',
      description: 'Delete vectors by id.',
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
