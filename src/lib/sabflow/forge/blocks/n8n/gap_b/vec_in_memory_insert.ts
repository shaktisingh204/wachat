/**
 * Forge block: In-Memory Vector Store (Insert)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreInMemoryInsert
 *
 * Mirrors n8n's split of the in-memory store into a pure insert action. State
 * is held in a module-level Map keyed by collection name. This is
 * single-process and IS LOST ON COLD START — use a persistent store for real
 * workloads.
 *
 * Inline credentials — `auth: { type: 'none' }`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

type Entry = { id: string; vector: number[]; metadata: Record<string, unknown> };

type GlobalWithStore = typeof globalThis & {
  __forge_vec_in_memory__?: Map<string, Map<string, Entry>>;
};

function getStore(): Map<string, Map<string, Entry>> {
  const g = globalThis as GlobalWithStore;
  if (!g.__forge_vec_in_memory__) g.__forge_vec_in_memory__ = new Map();
  return g.__forge_vec_in_memory__;
}

function getCollection(name: string): Map<string, Entry> {
  const store = getStore();
  let coll = store.get(name);
  if (!coll) {
    coll = new Map();
    store.set(name, coll);
  }
  return coll;
}

type Vector = { id: string; vector: number[]; metadata?: Record<string, unknown> };

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('In-Memory (insert): vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('In-Memory (insert): each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function insertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.collection);
  if (!name) throw new Error('In-Memory (insert): collection is required');
  const vectors = parseVectors(asString(ctx.options.vectors));
  const coll = getCollection(name);
  for (const v of vectors) {
    coll.set(v.id, { id: v.id, vector: v.vector, metadata: v.metadata ?? {} });
  }
  return {
    outputs: { upserted: vectors.length, collectionSize: coll.size },
    logs: [`In-Memory insert → ${vectors.length} (collection size: ${coll.size})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_vec_in_memory_insert',
  name: 'In-Memory Vector Store (Insert)',
  description:
    'Pure-insert action for the in-memory vector store. State is LOST on cold start — use a persistent backend for real workloads.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'insert_vectors',
      label: 'Insert vectors',
      description: 'Upsert vectors into the in-memory collection.',
      fields: [
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: insertVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
