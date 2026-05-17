/**
 * Forge block: Zep (Load)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreZepLoad
 *
 * Endpoint:
 *   POST {baseUrl}/api/v1/collection/{name}/document/search
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

function base(ctx: ForgeActionContext): { url: string; headers: Record<string, string> } {
  const baseUrl = asString(ctx.options.baseUrl).replace(/\/$/, '');
  const apiKey = asString(ctx.options.apiKey);
  if (!baseUrl) throw new Error('Zep (load): baseUrl is required');
  if (!apiKey) throw new Error('Zep (load): apiKey is required');
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
  if (!c) throw new Error('Zep (load): collection is required');
  return c;
}

async function loadVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Zep (load): query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const filterRaw = asString(ctx.options.filter);
  const metadata = filterRaw ? (JSON.parse(filterRaw) as Record<string, unknown>) : undefined;
  const { url, headers } = base(ctx);

  const res = await apiRequest({
    service: 'Zep (load)',
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
    logs: [`Zep load → ${results.length}`],
  };
}

const inlineCreds = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'http://localhost:8000' },
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_vec_zep_load',
  name: 'Zep (Load)',
  description: 'Load-only Zep vector store action.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'load_vectors',
      label: 'Search vectors',
      description: 'Search Zep by embedding.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
        { id: 'filter', label: 'Metadata filter (JSON)', type: 'textarea' },
      ],
      run: loadVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
