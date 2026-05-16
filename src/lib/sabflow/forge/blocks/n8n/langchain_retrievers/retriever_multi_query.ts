/**
 * Forge block: Multi-Query Retriever
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/retrievers/RetrieverMultiQuery
 *
 * Generates N variant rephrasings of the user query via OpenAI, fans out to the
 * vector store for each variant, then dedupes hits by id.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';

type Hit = { id?: string | number; [k: string]: unknown };

async function generateVariants(apiKey: string, query: string, n: number): Promise<string[]> {
  const res = await apiRequest({
    service: 'OpenAI',
    method: 'POST',
    url: OPENAI_API,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `Generate ${n} alternative phrasings of the user query. Reply with one phrasing per line, no numbering, no preamble.`,
        },
        { role: 'user', content: query },
      ],
    },
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  const text = body?.choices?.[0]?.message?.content ?? '';
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*\d.)\s]+/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, n);
}

async function retrieve(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  if (!query) throw new Error('MultiQueryRetriever: query is required');
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('MultiQueryRetriever: apiKey is required');
  const vectorUrl = asString(ctx.options.vector_store_url);
  if (!vectorUrl) throw new Error('MultiQueryRetriever: vector_store_url is required');
  const nQueries = asNumber(ctx.options.n_queries) ?? 3;
  const topK = asNumber(ctx.options.top_k) ?? 4;

  const variants = [query, ...(await generateVariants(apiKey, query, nQueries))];

  const seen = new Set<string>();
  const merged: Hit[] = [];
  for (const variant of variants) {
    const res = await apiRequest({
      service: 'MultiQueryRetriever',
      method: 'POST',
      url: vectorUrl,
      json: { query: variant, top_k: topK },
      throwOnError: false,
    });
    if (!res.ok) continue;
    const body = res.data as { results?: Hit[]; hits?: Hit[] } | Hit[];
    const hits = Array.isArray(body)
      ? body
      : Array.isArray(body?.results)
        ? body.results
        : Array.isArray(body?.hits)
          ? body.hits
          : [];
    for (const hit of hits) {
      const key = String(hit?.id ?? JSON.stringify(hit));
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(hit);
    }
  }

  return {
    outputs: { retrieved: merged, count: merged.length, variants },
    logs: [`MultiQueryRetriever → ${variants.length} variant(s), ${merged.length} unique hit(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_retriever_multi_query',
  name: 'Multi-Query Retriever',
  description: 'Rephrase the query N times via LLM, fan out to the vector store, dedupe.',
  iconName: 'LuListChecks',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'retrieve',
      label: 'Retrieve with variants',
      description: 'Generate alternative queries via OpenAI and merge hits.',
      fields: [
        { id: 'query', label: 'Query', type: 'textarea', required: true },
        { id: 'apiKey', label: 'OpenAI API key', type: 'password', required: true },
        { id: 'vector_store_url', label: 'Vector store search URL', type: 'text', required: true },
        { id: 'n_queries', label: 'Number of variants', type: 'number', defaultValue: 3 },
        { id: 'top_k', label: 'Top K per query', type: 'number', defaultValue: 4 },
      ],
      run: retrieve,
    },
  ],
};

registerForgeBlock(block);
export default block;
