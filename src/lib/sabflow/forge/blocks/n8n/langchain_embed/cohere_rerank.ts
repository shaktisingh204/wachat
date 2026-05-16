/**
 * Forge block: Cohere Rerank
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/rerankers/RerankerCohere
 *
 * Endpoint:
 *   POST https://api.cohere.com/v2/rerank   (Bearer <apiKey>)
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

function parseDocuments(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    return [String(parsed)];
  } catch {
    return raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

type CohereRerankResult = {
  index?: number;
  relevance_score?: number;
  document?: { text?: string } | string;
};

async function rerank(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Cohere Rerank: apiKey is required');
  const model = asString(ctx.options.model) || 'rerank-english-v3.0';
  const query = asString(ctx.options.query);
  if (!query) throw new Error('Cohere Rerank: query is required');
  const documents = parseDocuments(asString(ctx.options.documents));
  if (documents.length === 0) throw new Error('Cohere Rerank: documents are required');
  const topN = asNumber(ctx.options.topN);

  const res = await apiRequest({
    service: 'Cohere Rerank',
    method: 'POST',
    url: 'https://api.cohere.com/v2/rerank',
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      query,
      documents,
      ...(topN !== undefined ? { top_n: topN } : {}),
      return_documents: true,
    },
  });
  const body = res.data as { results?: CohereRerankResult[] };
  const results = (body?.results ?? []).map((r) => {
    const idx = r.index ?? 0;
    const doc =
      typeof r.document === 'string'
        ? r.document
        : r.document?.text ?? documents[idx] ?? '';
    return {
      index: idx,
      relevanceScore: r.relevance_score ?? 0,
      document: doc,
    };
  });
  return {
    outputs: { results, raw: res.data },
    logs: [`Cohere Rerank → ${model} (${results.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_cohere_rerank',
  name: 'Cohere Rerank',
  description: 'Rerank candidate documents against a query using Cohere.',
  iconName: 'LuListOrdered',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'rerank',
      label: 'Rerank documents',
      description: 'Score and reorder docs by relevance to a query.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'rerank-english-v3.0' },
        { id: 'query', label: 'Query', type: 'text', required: true },
        {
          id: 'documents',
          label: 'Documents (JSON array or newline-separated)',
          type: 'textarea',
          required: true,
        },
        { id: 'topN', label: 'Top N', type: 'number', placeholder: '3' },
      ],
      run: rerank,
    },
  ],
};

registerForgeBlock(block);
export default block;
