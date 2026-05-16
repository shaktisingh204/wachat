/**
 * Forge block: In-Memory Vector Store
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreInMemory
 *
 * NOTE: State is held in a module-level Map keyed by collection name. This is
 * single-process and IS LOST ON COLD START (or when the engine worker
 * restarts). Use one of the persistent stores (Pinecone, Qdrant, pgvector,
 * Redis, MongoDB Atlas) for real workloads — this block is a convenience for
 * quick experiments, tests, and demos.
 *
 * Similarity: cosine.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

type Entry = { id: string; vector: number[]; metadata: Record<string, unknown> };

const store = new Map<string, Map<string, Entry>>();

function getCollection(name: string): Map<string, Entry> {
  let coll = store.get(name);
  if (!coll) {
    coll = new Map();
    store.set(name, coll);
  }
  return coll;
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

type Vector = { id: string; vector: number[]; metadata?: Record<string, unknown> };

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('In-Memory: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('In-Memory: each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

function collectionName(ctx: ForgeActionContext): string {
  const c = asString(ctx.options.collection);
  if (!c) throw new Error('In-Memory: collection is required');
  return c;
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const coll = getCollection(collectionName(ctx));
  for (const v of vectors) {
    coll.set(v.id, { id: v.id, vector: v.vector, metadata: v.metadata ?? {} });
  }
  return {
    outputs: { upserted: vectors.length },
    logs: [`In-Memory upsert → ${vectors.length} (collection size: ${coll.size})`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('In-Memory: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const coll = getCollection(collectionName(ctx));
  const scored = Array.from(coll.values()).map((e) => ({
    id: e.id,
    score: cosine(queryVector, e.vector),
    metadata: e.metadata,
  }));
  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, topK);
  return {
    outputs: { results },
    logs: [`In-Memory query → ${results.length} (of ${coll.size})`],
  };
}

async function deleteVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idsRaw = asString(ctx.options.ids);
  if (!idsRaw) throw new Error('In-Memory: ids is required');
  const ids = (JSON.parse(idsRaw) as unknown[]).map(String);
  const coll = getCollection(collectionName(ctx));
  let deleted = 0;
  for (const id of ids) {
    if (coll.delete(id)) deleted += 1;
  }
  return {
    outputs: { deleted },
    logs: [`In-Memory delete → ${deleted}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_vector_in_memory',
  name: 'In-Memory Vector Store',
  description:
    'Single-process in-memory vector store. State is LOST on cold start — use a persistent backend (Pinecone, Qdrant, pgvector, Redis, MongoDB Atlas) for real workloads.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Upsert vectors into the in-memory collection.',
      fields: [
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: upsertVectors,
    },
    {
      id: 'query_vectors',
      label: 'Search vectors',
      description: 'Cosine-similarity search across the collection.',
      fields: [
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
      ],
      run: queryVectors,
    },
    {
      id: 'delete_vectors',
      label: 'Delete vectors',
      description: 'Remove vectors by id.',
      fields: [
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'ids', label: 'IDs (JSON array)', type: 'textarea', required: true },
      ],
      run: deleteVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
