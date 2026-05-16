/**
 * Forge block: MongoDB Atlas Vector Search
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreMongoDBAtlas
 *
 * Uses the `mongodb` driver. Documents look like:
 *   { _id: <id>, embedding: number[], metadata: {...} }
 * Search uses the Atlas Search `$vectorSearch` aggregation stage against a
 * configured vector index.
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

type Vector = { id: string; vector: number[]; metadata?: Record<string, unknown> };

type MongoCollection = {
  bulkWrite: (
    ops: Array<{ updateOne: { filter: unknown; update: unknown; upsert: boolean } }>,
  ) => Promise<{ upsertedCount?: number; modifiedCount?: number }>;
  deleteMany: (filter: unknown) => Promise<{ deletedCount?: number }>;
  aggregate: (pipeline: unknown[]) => { toArray: () => Promise<Array<Record<string, unknown>>> };
};

type MongoClient = {
  connect: () => Promise<unknown>;
  db: (name: string) => { collection: (name: string) => MongoCollection };
  close: () => Promise<void>;
};

async function client(ctx: ForgeActionContext): Promise<{
  client: MongoClient;
  coll: MongoCollection;
}> {
  const uri = asString(ctx.options.uri);
  const dbName = asString(ctx.options.database);
  const collName = asString(ctx.options.collection);
  if (!uri) throw new Error('MongoDB: uri is required');
  if (!dbName) throw new Error('MongoDB: database is required');
  if (!collName) throw new Error('MongoDB: collection is required');
  const mod = (await import('mongodb')) as unknown as {
    MongoClient: new (uri: string) => MongoClient;
  };
  const c = new mod.MongoClient(uri);
  await c.connect();
  return { client: c, coll: c.db(dbName).collection(collName) };
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('MongoDB: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('MongoDB: each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const { client: c, coll } = await client(ctx);
  try {
    const ops = vectors.map((v) => ({
      updateOne: {
        filter: { _id: v.id },
        update: { $set: { embedding: v.vector, metadata: v.metadata ?? {} } },
        upsert: true,
      },
    }));
    if (ops.length > 0) await coll.bulkWrite(ops);
  } finally {
    await c.close();
  }
  return {
    outputs: { upserted: vectors.length },
    logs: [`MongoDB upsert → ${vectors.length}`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('MongoDB: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const index = asString(ctx.options.indexName) || 'vector_index';
  const path = asString(ctx.options.path) || 'embedding';
  const filterRaw = asString(ctx.options.filter);
  const filter = filterRaw ? (JSON.parse(filterRaw) as Record<string, unknown>) : undefined;
  const { client: c, coll } = await client(ctx);
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await coll
      .aggregate([
        {
          $vectorSearch: {
            index,
            path,
            queryVector,
            numCandidates: topK * 10,
            limit: topK,
            ...(filter ? { filter } : {}),
          },
        },
        {
          $project: {
            _id: 1,
            metadata: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ])
      .toArray();
  } finally {
    await c.close();
  }
  const results = rows.map((r) => ({
    id: String(r._id ?? ''),
    score: Number(r.score ?? 0),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  }));
  return {
    outputs: { results },
    logs: [`MongoDB query → ${results.length}`],
  };
}

async function deleteVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idsRaw = asString(ctx.options.ids);
  if (!idsRaw) throw new Error('MongoDB: ids is required');
  const ids = (JSON.parse(idsRaw) as unknown[]).map(String);
  const { client: c, coll } = await client(ctx);
  let deleted = 0;
  try {
    const r = await coll.deleteMany({ _id: { $in: ids } });
    deleted = r.deletedCount ?? 0;
  } finally {
    await c.close();
  }
  return {
    outputs: { deleted },
    logs: [`MongoDB delete → ${deleted}`],
  };
}

const inlineCreds = [
  { id: 'uri', label: 'Connection URI', type: 'password' as const, required: true, placeholder: 'mongodb+srv://user:pass@cluster/' },
  { id: 'database', label: 'Database', type: 'text' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_vector_mongo',
  name: 'MongoDB Atlas Vector',
  description: 'Add, search and delete vectors in an Atlas Vector Search collection.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Upsert documents with embeddings.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: upsertVectors,
    },
    {
      id: 'query_vectors',
      label: 'Search vectors',
      description: 'Run a $vectorSearch aggregation.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'indexName', label: 'Vector index name', type: 'text', placeholder: 'vector_index' },
        { id: 'path', label: 'Embedding field path', type: 'text', placeholder: 'embedding' },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
        { id: 'filter', label: 'Filter (JSON)', type: 'textarea' },
      ],
      run: queryVectors,
    },
    {
      id: 'delete_vectors',
      label: 'Delete vectors',
      description: 'Delete documents by id.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'ids', label: 'IDs (JSON array)', type: 'textarea', required: true },
      ],
      run: deleteVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
