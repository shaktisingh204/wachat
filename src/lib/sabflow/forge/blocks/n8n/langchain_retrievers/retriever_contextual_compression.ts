/**
 * Forge block: Contextual Compression Retriever
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/retrievers/RetrieverContextualCompression
 *
 * Takes a set of already-retrieved hits and asks an LLM, per hit, whether the
 * passage is relevant to the query and to summarise it down to the relevant
 * sentences. Irrelevant hits are dropped.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';

type Hit = { pageContent?: string; content?: string; text?: string; [k: string]: unknown };

function passageOf(hit: Hit): string {
  return asString(hit.pageContent ?? hit.content ?? hit.text ?? '');
}

async function compressOne(
  apiKey: string,
  query: string,
  passage: string,
): Promise<{ relevant: boolean; summary: string }> {
  const res = await apiRequest({
    service: 'OpenAI',
    method: 'POST',
    url: OPENAI_API,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'Decide if PASSAGE is relevant to QUERY. Respond as compact JSON: {"relevant": boolean, "summary": "1-3 sentences keeping only the parts that answer the query"}. If not relevant, summary may be empty.',
        },
        { role: 'user', content: `QUERY: ${query}\n\nPASSAGE:\n${passage}` },
      ],
      response_format: { type: 'json_object' },
    },
    throwOnError: false,
  });
  if (!res.ok) return { relevant: true, summary: passage };
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  const raw = body?.choices?.[0]?.message?.content ?? '';
  try {
    const parsed = JSON.parse(raw) as { relevant?: boolean; summary?: string };
    return {
      relevant: parsed.relevant !== false,
      summary: asString(parsed.summary ?? ''),
    };
  } catch {
    return { relevant: true, summary: passage };
  }
}

async function retrieve(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  if (!query) throw new Error('ContextualCompression: query is required');
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('ContextualCompression: apiKey is required');
  const hitsRaw = asString(ctx.options.hits);
  if (!hitsRaw) throw new Error('ContextualCompression: hits (JSON array) is required');
  let hits: Hit[];
  try {
    const parsed = JSON.parse(hitsRaw) as unknown;
    if (!Array.isArray(parsed)) throw new Error('hits must be a JSON array');
    hits = parsed as Hit[];
  } catch (err) {
    throw new Error(`ContextualCompression: invalid hits JSON — ${(err as Error).message}`);
  }

  const compressed: Array<Hit & { compressed: string }> = [];
  for (const hit of hits) {
    const passage = passageOf(hit);
    if (!passage) continue;
    const { relevant, summary } = await compressOne(apiKey, query, passage);
    if (!relevant) continue;
    compressed.push({ ...hit, compressed: summary || passage });
  }

  return {
    outputs: { retrieved: compressed, count: compressed.length },
    logs: [`ContextualCompression → kept ${compressed.length} of ${hits.length}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_retriever_contextual_compression',
  name: 'Contextual Compression Retriever',
  description: 'Filter and summarise retrieved passages via LLM to keep only relevant snippets.',
  iconName: 'LuShrink',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'retrieve',
      label: 'Compress hits',
      description: 'Drop irrelevant hits and summarise the rest.',
      fields: [
        { id: 'query', label: 'Query', type: 'textarea', required: true },
        { id: 'apiKey', label: 'OpenAI API key', type: 'password', required: true },
        { id: 'hits', label: 'Hits (JSON array)', type: 'textarea', required: true },
      ],
      run: retrieve,
    },
  ],
};

registerForgeBlock(block);
export default block;
