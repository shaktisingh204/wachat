/**
 * Forge block: In-Memory Vector Store (Load)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreInMemoryLoad
 *
 * Pure-load action — searches a previously-populated in-memory collection. The
 * collection has to have been created in the same Node.js process (and not
 * yet have hit a cold start) — see forge_vec_in_memory_insert.
 *
 * Similarity: cosine.
 *
 * Inline credentials — `auth: { type: 'none' }`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

type Entry = { id: string; vector: number[]; metadata: Record<string, unknown> };

type GlobalWithStore = typeof globalThis & {
  __forge_vec_in_memory__?: Map<string, Map<string, Entry>>;
};

function getStore(): Map<string, Map<string, Entry>> {
  const g = globalThis as GlobalWithStore;
  if (!g.__forge_vec_in_memory__) g.__forge_vec_in_memory__ = new Map();
  return g.__forge_vec_in_memory__;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function loadVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.collection);
  if (!name) throw new Error('In-Memory (load): collection is required');
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('In-Memory (load): query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const coll = getStore().get(name);
  if (!coll) {
    return {
      outputs: { results: [] },
      logs: [`In-Memory load → 0 (collection "${name}" not populated)`],
    };
  }
  const scored = Array.from(coll.values()).map((e) => ({
    id: e.id,
    score: cosine(queryVector, e.vector),
    metadata: e.metadata,
  }));
  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, topK);
  return {
    outputs: { results },
    logs: [`In-Memory load → ${results.length} (of ${coll.size})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_vec_in_memory_load',
  name: 'In-Memory Vector Store (Load)',
  description:
    'Pure-load action for the in-memory vector store. Requires a same-process collection populated by forge_vec_in_memory_insert.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'load_vectors',
      label: 'Search vectors',
      description: 'Cosine-similarity search across the in-memory collection.',
      fields: [
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
      ],
      run: loadVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
