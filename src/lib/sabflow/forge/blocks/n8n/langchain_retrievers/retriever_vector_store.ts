/**
 * Forge block: Vector Store Retriever
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/retrievers/RetrieverVectorStore
 *
 * Wraps any vector-store search endpoint behind a uniform retriever interface:
 * POSTs `{ query, top_k }` to the configured store URL and returns the hits.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

async function retrieve(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  if (!query) throw new Error('VectorStoreRetriever: query is required');
  const url = asString(ctx.options.vector_store_url);
  if (!url) throw new Error('VectorStoreRetriever: vector_store_url is required');
  const topK = asNumber(ctx.options.top_k) ?? 4;
  const collection = asString(ctx.options.collection);

  const res = await apiRequest({
    service: 'VectorStoreRetriever',
    method: 'POST',
    url,
    json: { query, top_k: topK, collection: collection || undefined },
  });
  const body = res.data as { results?: unknown[]; hits?: unknown[] } | unknown[];
  const hits = Array.isArray(body)
    ? body
    : Array.isArray((body as { results?: unknown[] })?.results)
      ? (body as { results: unknown[] }).results
      : Array.isArray((body as { hits?: unknown[] })?.hits)
        ? (body as { hits: unknown[] }).hits
        : [];
  return {
    outputs: { retrieved: hits, count: hits.length },
    logs: [`VectorStoreRetriever → ${hits.length} hit(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_retriever_vector_store',
  name: 'Vector Store Retriever',
  description: 'Retrieve top-K documents from any vector store via a search endpoint.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'retrieve',
      label: 'Retrieve documents',
      description: 'Query a vector-store search endpoint and return the matched documents.',
      fields: [
        { id: 'query', label: 'Query', type: 'textarea', required: true },
        { id: 'vector_store_url', label: 'Vector store search URL', type: 'text', required: true },
        { id: 'collection', label: 'Collection', type: 'text' },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 4 },
      ],
      run: retrieve,
    },
  ],
};

registerForgeBlock(block);
export default block;
