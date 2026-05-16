/**
 * Forge block: Rerank Voyage AI
 *
 * Reranks a list of documents against a query using Voyage AI
 * (`https://api.voyageai.com/v1/rerank`). Documents may be passed as a
 * JSON array string or a newline-separated list — the block accepts either.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.voyageai.com/v1/rerank';

function parseDocuments(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch {
      // fall through to newline split
    }
  }
  return trimmed.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

async function rerank(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Voyage rerank: apiKey is required');
  const query = asString(ctx.options.query);
  if (!query) throw new Error('Voyage rerank: query is required');
  const docs = parseDocuments(asString(ctx.options.documents));
  if (docs.length === 0) throw new Error('Voyage rerank: documents must include at least one entry');
  const model = asString(ctx.options.model) || 'rerank-2';
  const topK = asNumber(ctx.options.topK);

  const body: Record<string, unknown> = { query, documents: docs, model };
  if (topK !== undefined) body.top_k = topK;

  const res = await apiRequest({
    service: 'Voyage',
    method: 'POST',
    url: API,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: body,
  });
  const data = res.data as {
    data?: Array<{ index?: number; relevance_score?: number; document?: string }>;
    model?: string;
    usage?: { total_tokens?: number };
  };
  const results = (data?.data ?? []).map((r) => ({
    index: r.index,
    score: r.relevance_score,
    document: r.document ?? docs[r.index ?? -1] ?? '',
  }));
  return {
    outputs: {
      results,
      topIndex: results[0]?.index,
      topDocument: results[0]?.document ?? '',
      model: data?.model ?? model,
      totalTokens: data?.usage?.total_tokens,
      raw: res.data,
    },
    logs: [`Voyage rerank → ${results.length} ranked`],
  };
}

const block: ForgeBlock = {
  id: 'forge_rerank_voyage',
  name: 'Rerank Voyage AI',
  description: 'Rerank documents against a query with Voyage AI.',
  iconName: 'LuListOrdered',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'rerank',
      label: 'Rerank documents',
      description: 'Score and order documents by relevance to the query.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'textarea', required: true },
        {
          id: 'documents',
          label: 'Documents',
          type: 'textarea',
          required: true,
          placeholder: 'One per line, OR a JSON array of strings',
        },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'rerank-2', placeholder: 'rerank-2, rerank-2-lite, rerank-1…' },
        { id: 'topK', label: 'Top K', type: 'number' },
      ],
      run: rerank,
    },
  ],
};

registerForgeBlock(block);
export default block;
