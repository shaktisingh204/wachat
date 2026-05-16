/**
 * Forge block: Weaviate (Vector Store)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreWeaviate
 *
 * Endpoints:
 *   POST   {baseUrl}/v1/objects                     (upsert one)
 *   POST   {baseUrl}/v1/graphql                     (vector search via nearVector)
 *   DELETE {baseUrl}/v1/objects/{className}/{id}    (delete one)
 *
 * Header: `Authorization: Bearer <apiKey>` (optional for anonymous setups).
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
  if (!baseUrl) throw new Error('Weaviate: baseUrl is required');
  const headers: Record<string, string> = { Accept: 'application/json' };
  const apiKey = asString(ctx.options.apiKey);
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return { url: baseUrl, headers };
}

function className(ctx: ForgeActionContext): string {
  const c = asString(ctx.options.collection);
  if (!c) throw new Error('Weaviate: collection (class) is required');
  return c;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Weaviate: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('Weaviate: each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const { url, headers } = base(ctx);
  const cls = className(ctx);
  for (const v of vectors) {
    await apiRequest({
      service: 'Weaviate',
      method: 'POST',
      url: `${url}/v1/objects`,
      headers,
      json: {
        class: cls,
        id: v.id,
        vector: v.vector,
        properties: v.metadata ?? {},
      },
    });
  }
  return {
    outputs: { upserted: vectors.length },
    logs: [`Weaviate upsert → ${vectors.length}`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Weaviate: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const { url, headers } = base(ctx);
  const cls = className(ctx);

  const gql = `{
    Get {
      ${cls}(nearVector: { vector: [${queryVector.join(',')}] }, limit: ${topK}) {
        _additional { id distance }
      }
    }
  }`;

  const res = await apiRequest({
    service: 'Weaviate',
    method: 'POST',
    url: `${url}/v1/graphql`,
    headers,
    json: { query: gql },
  });
  const body = res.data as {
    data?: { Get?: Record<string, Array<Record<string, unknown> & { _additional?: { id: string; distance: number } }>> };
  };
  const list = body?.data?.Get?.[cls] ?? [];
  const results = list.map((row) => {
    const add = row._additional ?? { id: '', distance: 0 };
    const { _additional: _ignored, ...metadata } = row;
    return { id: add.id, score: 1 - (add.distance ?? 0), metadata };
  });
  return {
    outputs: { results, raw: res.data },
    logs: [`Weaviate query → ${results.length}`],
  };
}

async function deleteVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idsRaw = asString(ctx.options.ids);
  if (!idsRaw) throw new Error('Weaviate: ids is required');
  const ids = (JSON.parse(idsRaw) as unknown[]).map(String);
  const { url, headers } = base(ctx);
  const cls = className(ctx);
  for (const id of ids) {
    await apiRequest({
      service: 'Weaviate',
      method: 'DELETE',
      url: `${url}/v1/objects/${encodeURIComponent(cls)}/${encodeURIComponent(id)}`,
      headers,
    });
  }
  return {
    outputs: { deleted: ids.length },
    logs: [`Weaviate delete → ${ids.length}`],
  };
}

const inlineCreds = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'http://localhost:8080' },
  { id: 'apiKey', label: 'API key (optional)', type: 'password' as const },
];

const block: ForgeBlock = {
  id: 'forge_vector_weaviate',
  name: 'Weaviate',
  description: 'Add, search and delete vectors in a Weaviate class.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Insert objects with embeddings into a Weaviate class.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Class', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: upsertVectors,
    },
    {
      id: 'query_vectors',
      label: 'Search vectors',
      description: 'Search a Weaviate class by nearVector.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Class', type: 'text', required: true },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
      ],
      run: queryVectors,
    },
    {
      id: 'delete_vectors',
      label: 'Delete vectors',
      description: 'Delete objects by id.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Class', type: 'text', required: true },
        { id: 'ids', label: 'IDs (JSON array)', type: 'textarea', required: true },
      ],
      run: deleteVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
