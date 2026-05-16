/**
 * Forge block: Supabase Vector
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreSupabase
 *
 * Uses Supabase's PostgREST + RPC. Vectors live in a table with columns:
 *   id text primary key, embedding vector(N), metadata jsonb
 * Matching expects a `match_documents` SQL function (the default helper from
 * the Supabase + LangChain quickstart).
 *
 * Endpoints:
 *   POST   {baseUrl}/rest/v1/{table}            (upsert)
 *   POST   {baseUrl}/rest/v1/rpc/match_documents  (query)
 *   DELETE {baseUrl}/rest/v1/{table}?id=in.(...)  (delete)
 *
 * Headers: `apikey: <serviceKey>` + `Authorization: Bearer <serviceKey>`.
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
  const apiKey = asString(ctx.options.apiKey);
  if (!baseUrl) throw new Error('Supabase: baseUrl is required');
  if (!apiKey) throw new Error('Supabase: apiKey is required');
  return {
    url: baseUrl,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  };
}

function table(ctx: ForgeActionContext): string {
  const t = asString(ctx.options.collection);
  if (!t) throw new Error('Supabase: collection (table) is required');
  return t;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Supabase: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('Supabase: each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const { url, headers } = base(ctx);
  await apiRequest({
    service: 'Supabase',
    method: 'POST',
    url: `${url}/rest/v1/${encodeURIComponent(table(ctx))}`,
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    json: vectors.map((v) => ({
      id: v.id,
      embedding: v.vector,
      metadata: v.metadata ?? {},
    })),
  });
  return {
    outputs: { upserted: vectors.length },
    logs: [`Supabase upsert → ${vectors.length}`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Supabase: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const fn = asString(ctx.options.matchFunction) || 'match_documents';
  const filterRaw = asString(ctx.options.filter);
  const filter = filterRaw ? (JSON.parse(filterRaw) as Record<string, unknown>) : {};
  const { url, headers } = base(ctx);

  const res = await apiRequest({
    service: 'Supabase',
    method: 'POST',
    url: `${url}/rest/v1/rpc/${encodeURIComponent(fn)}`,
    headers,
    json: { query_embedding: queryVector, match_count: topK, filter },
  });
  const body = res.data as Array<{ id: string; similarity?: number; metadata?: Record<string, unknown> }>;
  const results = (Array.isArray(body) ? body : []).map((r) => ({
    id: String(r.id),
    score: r.similarity ?? 0,
    metadata: r.metadata ?? {},
  }));
  return {
    outputs: { results, raw: res.data },
    logs: [`Supabase query → ${results.length}`],
  };
}

async function deleteVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idsRaw = asString(ctx.options.ids);
  if (!idsRaw) throw new Error('Supabase: ids is required');
  const ids = (JSON.parse(idsRaw) as unknown[]).map(String);
  const { url, headers } = base(ctx);
  const inList = `(${ids.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',')})`;
  await apiRequest({
    service: 'Supabase',
    method: 'DELETE',
    url: `${url}/rest/v1/${encodeURIComponent(table(ctx))}?id=in.${encodeURIComponent(inList)}`,
    headers,
  });
  return {
    outputs: { deleted: ids.length },
    logs: [`Supabase delete → ${ids.length}`],
  };
}

const inlineCreds = [
  { id: 'baseUrl', label: 'Project URL', type: 'text' as const, required: true, placeholder: 'https://xxxx.supabase.co' },
  { id: 'apiKey', label: 'Service role key', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_vector_supabase',
  name: 'Supabase Vector',
  description: 'Add, search and delete vectors in a Supabase Postgres table.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Upsert vectors via Supabase REST.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Table', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: upsertVectors,
    },
    {
      id: 'query_vectors',
      label: 'Search vectors',
      description: 'Search via the match_documents SQL function.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Table', type: 'text', required: true },
        { id: 'matchFunction', label: 'Match function', type: 'text', placeholder: 'match_documents' },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
        { id: 'filter', label: 'Filter (JSON object)', type: 'textarea' },
      ],
      run: queryVectors,
    },
    {
      id: 'delete_vectors',
      label: 'Delete vectors',
      description: 'Delete rows by id.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Table', type: 'text', required: true },
        { id: 'ids', label: 'IDs (JSON array)', type: 'textarea', required: true },
      ],
      run: deleteVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
