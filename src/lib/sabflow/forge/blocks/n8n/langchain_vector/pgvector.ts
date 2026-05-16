/**
 * Forge block: Postgres (pgvector)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStorePGVector
 *
 * Uses the `pg` driver (dynamic-imported so the block stays tree-shake-friendly).
 *
 * SQL:
 *   INSERT INTO {table}(id, embedding, metadata) VALUES ($1, $2::vector, $3)
 *     ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata
 *   SELECT id, metadata, embedding <=> $1::vector AS distance FROM {table}
 *     ORDER BY distance LIMIT $2
 *   DELETE FROM {table} WHERE id = ANY($1::text[])
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

type PgClient = {
  connect: () => Promise<void>;
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

async function client(ctx: ForgeActionContext): Promise<PgClient> {
  const connectionString = asString(ctx.options.connectionString);
  if (!connectionString) throw new Error('Postgres: connectionString is required');
  const mod = (await import('pg')) as unknown as {
    default?: { Client: new (cfg: { connectionString: string }) => PgClient };
    Client?: new (cfg: { connectionString: string }) => PgClient;
  };
  const Client = (mod.default?.Client ?? mod.Client) as new (cfg: {
    connectionString: string;
  }) => PgClient;
  if (!Client) throw new Error('Postgres: failed to load pg driver');
  const c = new Client({ connectionString });
  await c.connect();
  return c;
}

function table(ctx: ForgeActionContext): string {
  const t = asString(ctx.options.collection);
  if (!t) throw new Error('Postgres: collection (table) is required');
  if (!/^[a-zA-Z_][a-zA-Z0-9_."]*$/.test(t))
    throw new Error('Postgres: collection must be a simple identifier');
  return t;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Postgres: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('Postgres: each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const c = await client(ctx);
  try {
    for (const v of vectors) {
      await c.query(
        `INSERT INTO ${table(ctx)}(id, embedding, metadata) VALUES ($1, $2::vector, $3)
          ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata`,
        [v.id, vectorLiteral(v.vector), v.metadata ?? {}],
      );
    }
  } finally {
    await c.end();
  }
  return {
    outputs: { upserted: vectors.length },
    logs: [`pgvector upsert → ${vectors.length}`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Postgres: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const c = await client(ctx);
  let rows: Array<Record<string, unknown>>;
  try {
    const r = await c.query(
      `SELECT id, metadata, embedding <=> $1::vector AS distance
         FROM ${table(ctx)}
        ORDER BY distance
        LIMIT $2`,
      [vectorLiteral(queryVector), topK],
    );
    rows = r.rows;
  } finally {
    await c.end();
  }
  const results = rows.map((r) => ({
    id: String(r.id ?? ''),
    score: 1 - Number(r.distance ?? 0),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  }));
  return {
    outputs: { results },
    logs: [`pgvector query → ${results.length}`],
  };
}

async function deleteVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idsRaw = asString(ctx.options.ids);
  if (!idsRaw) throw new Error('Postgres: ids is required');
  const ids = (JSON.parse(idsRaw) as unknown[]).map(String);
  const c = await client(ctx);
  try {
    await c.query(`DELETE FROM ${table(ctx)} WHERE id = ANY($1::text[])`, [ids]);
  } finally {
    await c.end();
  }
  return {
    outputs: { deleted: ids.length },
    logs: [`pgvector delete → ${ids.length}`],
  };
}

const inlineCreds = [
  { id: 'connectionString', label: 'Connection string', type: 'password' as const, required: true, placeholder: 'postgres://user:pass@host:5432/db' },
];

const block: ForgeBlock = {
  id: 'forge_vector_pgvector',
  name: 'Postgres (pgvector)',
  description: 'Add, search and delete vectors in a pgvector-enabled Postgres table.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Upsert rows into a pgvector table.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Table', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: upsertVectors,
    },
    {
      id: 'query_vectors',
      label: 'Search vectors',
      description: 'Cosine-distance search using <=>.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Table', type: 'text', required: true },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
      ],
      run: queryVectors,
    },
    {
      id: 'delete_vectors',
      label: 'Delete vectors',
      description: 'Delete rows by id.',
      fields: [
        ...inlineCreds,
        { id: 'collection', label: 'Table', type: 'text', required: true },
        { id: 'ids', label: 'IDs (JSON array)', type: 'textarea', required: true },
      ],
      run: deleteVectors,
    },
  ],
};

registerForgeBlock(block);
export default block;
