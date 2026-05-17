/**
 * Forge block: Supabase Vector (Load)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreSupabaseLoad
 *
 * Endpoint:
 *   POST {baseUrl}/rest/v1/rpc/{matchFunction}
 *
 * Expects a SQL function (default `match_documents`) that takes
 * `query_embedding`, `match_count`, optional `filter` and returns rows
 * containing `id`, `similarity`, `metadata`.
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

function base(ctx: ForgeActionContext): { url: string; headers: Record<string, string> } {
  const baseUrl = asString(ctx.options.baseUrl).replace(/\/$/, '');
  const apiKey = asString(ctx.options.apiKey);
  if (!baseUrl) throw new Error('Supabase (load): baseUrl is required');
  if (!apiKey) throw new Error('Supabase (load): apiKey is required');
  return {
    url: baseUrl,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  };
}

async function loadVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Supabase (load): query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const fn = asString(ctx.options.matchFunction) || 'match_documents';
  const filterRaw = asString(ctx.options.filter);
  const filter = filterRaw ? (JSON.parse(filterRaw) as Record<string, unknown>) : {};
  const { url, headers } = base(ctx);

  const res = await apiRequest({
    service: 'Supabase (load)',
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
    logs: [`Supabase load → ${results.length}`],
  };
}

const inlineCreds = [
  { id: 'baseUrl', label: 'Project URL', type: 'text' as const, required: true, placeholder: 'https://xxxx.supabase.co' },
  { id: 'apiKey', label: 'Service role key', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_vec_supabase_load',
  name: 'Supabase Vector (Load)',
  description: 'Load-only Supabase vector store action.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'load_vectors',
      label: 'Search vectors',
      description: 'Search via the match_documents SQL function.',
      fields: [
        ...inlineCreds,
        { id: 'matchFunction', label: 'Match function', type: 'text', placeholder: 'match_documents' },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
        { id: 'filter', label: 'Filter (JSON object)', type: 'textarea' },
      ],
      run: loadVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
