/**
 * Forge block: LangChain Tool — Vector Store
 *
 * Source: @n8n/nodes-langchain/nodes/tools/ToolVectorStore/
 *
 * Generic vector-store tool. Posts `{ query, top_k }` to a configurable
 * search endpoint and returns the parsed response. Concrete drivers
 * (Pinecone / Qdrant / Mongo Vector Search) live in their own forge blocks
 * — this one is the tool-call adapter an LLM agent can call with a string.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

type VectorMatch = {
  id?: string;
  score?: number;
  text?: string;
  metadata?: Record<string, unknown>;
};

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.vectorStoreUrl).trim();
  const query = asString(ctx.options.query).trim();
  const topK = asNumber(ctx.options.topK) ?? 5;
  if (!url) throw new Error('Vector Store Tool: vectorStoreUrl is required');
  if (!query) throw new Error('Vector Store Tool: query is required');

  const apiKey = asString(ctx.options.apiKey).trim();
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await apiRequest({
    service: 'Vector Store Tool',
    method: 'POST',
    url,
    headers,
    json: { query, top_k: topK },
  });

  const data = (res.data ?? {}) as { matches?: VectorMatch[]; results?: VectorMatch[] };
  const matches = Array.isArray(data.matches)
    ? data.matches
    : Array.isArray(data.results)
      ? data.results
      : [];

  const text = matches
    .map((m, i) => `[${i + 1}] (${m.score ?? '—'}) ${asString(m.text)}`)
    .join('\n');

  return {
    outputs: { matches, text, count: matches.length },
    logs: [`Vector Store Tool → ${matches.length} match(es)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_tool_vector_store',
  name: 'LangChain Tool — Vector Store',
  description: 'Query a vector-store search endpoint and return top-K matches.',
  iconName: 'LuBoxes',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search',
      label: 'Search vectors',
      fields: [
        {
          id: 'vectorStoreUrl',
          label: 'Search endpoint URL',
          type: 'text',
          required: true,
          placeholder: 'https://vectors.example.com/search',
        },
        { id: 'query', label: 'Query', type: 'text', required: true },
        { id: 'topK', label: 'Top K', type: 'number', defaultValue: 5 },
        { id: 'apiKey', label: 'API key (optional)', type: 'password' },
      ],
      run: search,
    },
  ],
};

registerForgeBlock(block);
export default block;
