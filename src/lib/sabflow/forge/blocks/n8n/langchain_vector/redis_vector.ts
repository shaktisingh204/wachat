/**
 * Forge block: Redis (RediSearch / Vector)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStoreRedis
 *
 * Uses `ioredis`. Vectors are stored as hashes:
 *   HSET {prefix}{id} embedding <binary float32 LE> metadata <json>
 * Search uses `FT.SEARCH {indexName} *=>[KNN k @embedding $BLOB AS score]`.
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

type RedisClient = {
  hset: (key: string, ...fieldValues: Array<string | Buffer>) => Promise<number>;
  del: (...keys: string[]) => Promise<number>;
  call: (cmd: string, ...args: Array<string | Buffer>) => Promise<unknown>;
  quit: () => Promise<'OK' | string>;
};

async function client(ctx: ForgeActionContext): Promise<RedisClient> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('Redis: url is required');
  const mod = (await import('ioredis')) as unknown as {
    default?: new (url: string) => RedisClient;
    Redis?: new (url: string) => RedisClient;
  };
  const Redis = (mod.default ?? mod.Redis) as new (url: string) => RedisClient;
  if (!Redis) throw new Error('Redis: failed to load ioredis');
  return new Redis(url);
}

function indexName(ctx: ForgeActionContext): string {
  const i = asString(ctx.options.collection);
  if (!i) throw new Error('Redis: collection (index name) is required');
  return i;
}

function keyPrefix(ctx: ForgeActionContext): string {
  const p = asString(ctx.options.keyPrefix);
  return p || `${indexName(ctx)}:`;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Redis: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('Redis: each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

function floatBuffer(vec: number[]): Buffer {
  const buf = Buffer.alloc(vec.length * 4);
  for (let i = 0; i < vec.length; i += 1) buf.writeFloatLE(vec[i], i * 4);
  return buf;
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const r = await client(ctx);
  const prefix = keyPrefix(ctx);
  try {
    for (const v of vectors) {
      await r.hset(
        `${prefix}${v.id}`,
        'embedding',
        floatBuffer(v.vector),
        'metadata',
        JSON.stringify(v.metadata ?? {}),
      );
    }
  } finally {
    await r.quit();
  }
  return {
    outputs: { upserted: vectors.length },
    logs: [`Redis upsert → ${vectors.length}`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Redis: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const r = await client(ctx);
  let raw: unknown;
  try {
    raw = await r.call(
      'FT.SEARCH',
      indexName(ctx),
      `*=>[KNN ${topK} @embedding $BLOB AS score]`,
      'PARAMS',
      '2',
      'BLOB',
      floatBuffer(queryVector),
      'RETURN',
      '2',
      'metadata',
      'score',
      'SORTBY',
      'score',
      'DIALECT',
      '2',
    );
  } finally {
    await r.quit();
  }
  // FT.SEARCH returns [count, key1, [field, value, ...], key2, [...]]
  const arr = Array.isArray(raw) ? raw : [];
  const results: Array<{ id: string; score: number; metadata: Record<string, unknown> }> = [];
  for (let i = 1; i < arr.length; i += 2) {
    const id = String(arr[i]);
    const fields = Array.isArray(arr[i + 1]) ? (arr[i + 1] as Array<string | Buffer>) : [];
    const pairs: Record<string, string> = {};
    for (let j = 0; j < fields.length; j += 2) {
      pairs[String(fields[j])] = typeof fields[j + 1] === 'string'
        ? (fields[j + 1] as string)
        : Buffer.from(fields[j + 1] as Buffer).toString('utf8');
    }
    let metadata: Record<string, unknown> = {};
    try {
      metadata = pairs.metadata ? (JSON.parse(pairs.metadata) as Record<string, unknown>) : {};
    } catch {
      metadata = { raw: pairs.metadata };
    }
    results.push({ id, score: Number(pairs.score ?? 0), metadata });
  }
  return {
    outputs: { results },
    logs: [`Redis query → ${results.length}`],
  };
}

async function deleteVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idsRaw = asString(ctx.options.ids);
  if (!idsRaw) throw new Error('Redis: ids is required');
  const ids = (JSON.parse(idsRaw) as unknown[]).map(String);
  const r = await client(ctx);
  const prefix = keyPrefix(ctx);
  try {
    if (ids.length > 0) await r.del(...ids.map((id) => `${prefix}${id}`));
  } finally {
    await r.quit();
  }
  return {
    outputs: { deleted: ids.length },
    logs: [`Redis delete → ${ids.length}`],
  };
}

const inlineCreds = [
  { id: 'url', label: 'Redis URL', type: 'password' as const, required: true, placeholder: 'redis://localhost:6379' },
];

const block: ForgeBlock = {
  id: 'forge_vector_redis',
  name: 'Redis (RediSearch)',
  description: 'Add, search and delete vectors in a RediSearch index.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Upsert vectors as Redis hashes.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Index name', type: 'text', required: true },
        { id: 'keyPrefix', label: 'Key prefix', type: 'text', placeholder: '<index>:' },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: upsertVectors,
    },
    {
      id: 'query_vectors',
      label: 'Search vectors',
      description: 'KNN search via FT.SEARCH.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Index name', type: 'text', required: true },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
      ],
      run: queryVectors,
    },
    {
      id: 'delete_vectors',
      label: 'Delete vectors',
      description: 'Delete keys by id.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Index name', type: 'text', required: true },
        { id: 'keyPrefix', label: 'Key prefix', type: 'text', placeholder: '<index>:' },
        { id: 'ids', label: 'IDs (JSON array)', type: 'textarea', required: true },
      ],
      run: deleteVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
