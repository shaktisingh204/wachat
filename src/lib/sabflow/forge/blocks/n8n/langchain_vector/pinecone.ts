/**
 * Forge block: Pinecone (Vector Store)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStorePinecone
 *
 * Endpoints (per-index host):
 *   POST   https://{index}-{project}.svc.{environment}.pinecone.io/vectors/upsert
 *   POST   https://{index}-{project}.svc.{environment}.pinecone.io/query
 *   POST   https://{index}-{project}.svc.{environment}.pinecone.io/vectors/delete
 *
 * Header: `Api-Key: <apiKey>`
 *
 * Inline credentials — block uses `auth: { type: 'none' }` and reads the
 * API key + index/project/environment from password/text fields.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

type Vector = { id: string; vector: number[]; metadata?: Record<string, unknown> };

function indexHost(ctx: ForgeActionContext): string {
  const index = asString(ctx.options.index);
  const project = asString(ctx.options.project);
  const env = asString(ctx.options.environment);
  if (!index || !project || !env)
    throw new Error('Pinecone: index, project and environment are required');
  return `https://${index}-${project}.svc.${env}.pinecone.io`;
}

function headers(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Pinecone: apiKey is required');
  return { 'Api-Key': apiKey, Accept: 'application/json' };
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Pinecone: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('Pinecone: each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const namespace = asString(ctx.options.collection);
  const res = await apiRequest({
    service: 'Pinecone',
    method: 'POST',
    url: `${indexHost(ctx)}/vectors/upsert`,
    headers: headers(ctx),
    json: {
      vectors: vectors.map((v) => ({ id: v.id, values: v.vector, metadata: v.metadata })),
      namespace: namespace || undefined,
    },
  });
  const body = res.data as { upsertedCount?: number };
  const upserted = body?.upsertedCount ?? vectors.length;
  return {
    outputs: { upserted, raw: res.data },
    logs: [`Pinecone upsert → ${upserted}`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Pinecone: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const namespace = asString(ctx.options.collection);
  const filterRaw = asString(ctx.options.filter);
  const filter = filterRaw ? (JSON.parse(filterRaw) as Record<string, unknown>) : undefined;

  const res = await apiRequest({
    service: 'Pinecone',
    method: 'POST',
    url: `${indexHost(ctx)}/query`,
    headers: headers(ctx),
    json: {
      vector: queryVector,
      topK,
      namespace: namespace || undefined,
      filter,
      includeMetadata: true,
    },
  });
  const body = res.data as { matches?: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> };
  const results = (body?.matches ?? []).map((m) => ({
    id: m.id,
    score: m.score,
    metadata: m.metadata ?? {},
  }));
  return {
    outputs: { results, raw: res.data },
    logs: [`Pinecone query → ${results.length}`],
  };
}

async function deleteVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idsRaw = asString(ctx.options.ids);
  if (!idsRaw) throw new Error('Pinecone: ids is required');
  const ids = (JSON.parse(idsRaw) as unknown[]).map(String);
  const namespace = asString(ctx.options.collection);
  await apiRequest({
    service: 'Pinecone',
    method: 'POST',
    url: `${indexHost(ctx)}/vectors/delete`,
    headers: headers(ctx),
    json: { ids, namespace: namespace || undefined },
  });
  return {
    outputs: { deleted: ids.length },
    logs: [`Pinecone delete → ${ids.length}`],
  };
}

const inlineCreds = [
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
  { id: 'index', label: 'Index', type: 'text' as const, required: true },
  { id: 'project', label: 'Project ID', type: 'text' as const, required: true },
  { id: 'environment', label: 'Environment', type: 'text' as const, required: true, placeholder: 'us-east-1' },
];

const block: ForgeBlock = {
  id: 'forge_vector_pinecone',
  name: 'Pinecone',
  description: 'Add, search and delete vectors in a Pinecone index.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Upsert vectors into the index.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Namespace', type: 'text' },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: upsertVectors,
    },
    {
      id: 'query_vectors',
      label: 'Search vectors',
      description: 'Query the index by a vector.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Namespace', type: 'text' },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
        { id: 'filter', label: 'Filter (JSON)', type: 'textarea' },
      ],
      run: queryVectors,
    },
    {
      id: 'delete_vectors',
      label: 'Delete vectors',
      description: 'Delete vectors by id.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Namespace', type: 'text' },
        { id: 'ids', label: 'IDs (JSON array)', type: 'textarea', required: true },
      ],
      run: deleteVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
