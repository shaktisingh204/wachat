/**
 * Forge block: Chat Hub — pgvector
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/vector_store/VectorStorePGVector
 *   (Chat-hub variant — same underlying store, wrapping documents tied to a
 *   chat session id for retrieval/augmentation).
 *
 * SQL:
 *   INSERT INTO {table}(id, session_id, embedding, metadata) VALUES (...)
 *     ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata
 *   SELECT id, metadata, embedding <=> $1::vector AS distance
 *     FROM {table} WHERE session_id = $2 ORDER BY distance LIMIT $3
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
  if (!connectionString) throw new Error('Chat-Hub pgvector: connectionString is required');
  const mod = (await import('pg')) as unknown as {
    default?: { Client: new (cfg: { connectionString: string }) => PgClient };
    Client?: new (cfg: { connectionString: string }) => PgClient;
  };
  const Client = (mod.default?.Client ?? mod.Client) as new (cfg: {
    connectionString: string;
  }) => PgClient;
  if (!Client) throw new Error('Chat-Hub pgvector: failed to load pg driver');
  const c = new Client({ connectionString });
  await c.connect();
  return c;
}

function table(ctx: ForgeActionContext): string {
  const t = asString(ctx.options.table);
  if (!t) throw new Error('Chat-Hub pgvector: table is required');
  if (!/^[a-zA-Z_][a-zA-Z0-9_."]*$/.test(t))
    throw new Error('Chat-Hub pgvector: table must be a simple identifier');
  return t;
}

function sessionId(ctx: ForgeActionContext): string {
  const s = asString(ctx.options.sessionId);
  if (!s) throw new Error('Chat-Hub pgvector: sessionId is required');
  return s;
}

function parseVectors(raw: string): Vector[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Chat-Hub pgvector: vectors must be a JSON array');
  return parsed.map((v) => {
    const o = v as Vector;
    if (!o?.id || !Array.isArray(o.vector))
      throw new Error('Chat-Hub pgvector: each vector requires { id, vector[] }');
    return { id: String(o.id), vector: o.vector.map(Number), metadata: o.metadata };
  });
}

function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

async function upsertVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const vectors = parseVectors(asString(ctx.options.vectors));
  const sid = sessionId(ctx);
  const c = await client(ctx);
  try {
    for (const v of vectors) {
      await c.query(
        `INSERT INTO ${table(ctx)}(id, session_id, embedding, metadata) VALUES ($1, $2, $3::vector, $4)
          ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata, session_id = EXCLUDED.session_id`,
        [v.id, sid, vectorLiteral(v.vector), v.metadata ?? {}],
      );
    }
  } finally {
    await c.end();
  }
  return {
    outputs: { upserted: vectors.length, sessionId: sid },
    logs: [`Chat-Hub pgvector upsert → ${vectors.length} (session ${sid})`],
  };
}

async function queryVectors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryRaw = asString(ctx.options.query_vector);
  if (!queryRaw) throw new Error('Chat-Hub pgvector: query_vector is required');
  const queryVector = (JSON.parse(queryRaw) as unknown[]).map(Number);
  const topK = asNumber(ctx.options.top_k) ?? 10;
  const sid = sessionId(ctx);
  const c = await client(ctx);
  let rows: Array<Record<string, unknown>>;
  try {
    const r = await c.query(
      `SELECT id, metadata, embedding <=> $1::vector AS distance
         FROM ${table(ctx)}
        WHERE session_id = $2
        ORDER BY distance
        LIMIT $3`,
      [vectorLiteral(queryVector), sid, topK],
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
    outputs: { results, sessionId: sid },
    logs: [`Chat-Hub pgvector query → ${results.length} (session ${sid})`],
  };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sid = sessionId(ctx);
  const c = await client(ctx);
  try {
    await c.query(`DELETE FROM ${table(ctx)} WHERE session_id = $1`, [sid]);
  } finally {
    await c.end();
  }
  return {
    outputs: { cleared: true, sessionId: sid },
    logs: [`Chat-Hub pgvector cleared session ${sid}`],
  };
}

const inlineCreds = [
  {
    id: 'connectionString',
    label: 'Connection string',
    type: 'password' as const,
    required: true,
    placeholder: 'postgres://user:pass@host:5432/db',
  },
];

const block: ForgeBlock = {
  id: 'forge_vec_chathub_pgvector',
  name: 'Chat Hub — pgvector',
  description:
    'Per-session vector store backed by pgvector. Wraps documents tied to a chat session id.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'upsert_vectors',
      label: 'Add vectors',
      description: 'Upsert vectors scoped to a chat session.',
      fields: [
        ...inlineCreds,
        { id: 'table', label: 'Table', type: 'text', required: true, placeholder: 'chat_documents' },
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'vectors', label: 'Vectors (JSON array of { id, vector, metadata? })', type: 'textarea', required: true },
      ],
      run: upsertVectors,
    },
    {
      id: 'query_vectors',
      label: 'Search vectors',
      description: 'Search vectors in the current chat session.',
      fields: [
        ...inlineCreds,
        { id: 'table', label: 'Table', type: 'text', required: true, placeholder: 'chat_documents' },
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'query_vector', label: 'Query vector (JSON array)', type: 'textarea', required: true },
        { id: 'top_k', label: 'Top K', type: 'number', defaultValue: 10 },
      ],
      run: queryVectors,
    },
    {
      id: 'clear_session',
      label: 'Clear session',
      description: 'Delete every vector tied to the session.',
      fields: [
        ...inlineCreds,
        { id: 'table', label: 'Table', type: 'text', required: true, placeholder: 'chat_documents' },
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
      ],
      run: clearSession,
    },
  ],
};

registerForgeBlock(block);
export default block;
