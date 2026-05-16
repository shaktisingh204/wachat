/**
 * Forge block: Postgres Chat Memory
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/memory/MemoryPostgresChat
 *
 * Stores one JSONB row per message:
 *   CREATE TABLE chat_history (
 *     id BIGSERIAL PRIMARY KEY,
 *     session_id TEXT NOT NULL,
 *     message JSONB NOT NULL,
 *     created_at TIMESTAMPTZ DEFAULT now()
 *   );
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

function tableName(ctx: ForgeActionContext): string {
  const t = asString(ctx.options.table) || 'chat_history';
  if (!/^[a-zA-Z_][a-zA-Z0-9_."]*$/.test(t))
    throw new Error('Postgres: table must be a simple identifier');
  return t;
}

function sessionId(ctx: ForgeActionContext): string {
  const s = asString(ctx.options.sessionId);
  if (!s) throw new Error('Postgres: sessionId is required');
  return s;
}

async function saveMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const role = asString(ctx.options.role) || 'user';
  const content = asString(ctx.options.content);
  if (!content) throw new Error('Postgres: content is required');
  const c = await client(ctx);
  const table = tableName(ctx);
  try {
    await c.query(
      `INSERT INTO ${table} (session_id, message) VALUES ($1, $2::jsonb)`,
      [id, JSON.stringify({ role, content, at: new Date().toISOString() })],
    );
  } finally {
    await c.end();
  }
  return { outputs: { ok: true }, logs: [`Postgres save → ${id} (${role})`] };
}

async function loadSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const limit = asNumber(ctx.options.limit) ?? 0;
  const c = await client(ctx);
  const table = tableName(ctx);
  let rows: Array<Record<string, unknown>>;
  try {
    const r = limit > 0
      ? await c.query(
          `SELECT message FROM ${table} WHERE session_id = $1 ORDER BY id DESC LIMIT $2`,
          [id, limit],
        )
      : await c.query(
          `SELECT message FROM ${table} WHERE session_id = $1 ORDER BY id ASC`,
          [id],
        );
    rows = r.rows;
  } finally {
    await c.end();
  }
  if (limit > 0) rows.reverse();
  const messages = rows.map((r) => r.message as Record<string, unknown>);
  return { outputs: { messages }, logs: [`Postgres load → ${messages.length}`] };
}

async function clearSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = sessionId(ctx);
  const c = await client(ctx);
  const table = tableName(ctx);
  let deleted = 0;
  try {
    const r = await c.query(`DELETE FROM ${table} WHERE session_id = $1`, [id]);
    // pg's DELETE result also has rowCount but we keep things simple
    deleted = (r as unknown as { rowCount?: number }).rowCount ?? 0;
  } finally {
    await c.end();
  }
  return { outputs: { cleared: deleted }, logs: [`Postgres clear → ${deleted}`] };
}

const inlineCreds = [
  { id: 'connectionString', label: 'Connection string', type: 'password' as const, required: true, placeholder: 'postgres://user:pass@host:5432/db' },
  { id: 'table', label: 'Table', type: 'text' as const, placeholder: 'chat_history' },
];

const block: ForgeBlock = {
  id: 'forge_mem_postgres',
  name: 'Postgres Chat Memory',
  description: 'Persist chat sessions in a Postgres JSONB table.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'save_message',
      label: 'Save message',
      description: 'Insert a JSONB message row.',
      fields: [
        ...inlineCreds,
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'role', label: 'Role', type: 'text', defaultValue: 'user' },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
      ],
      run: saveMessage,
    },
    {
      id: 'load_session',
      label: 'Load session',
      description: 'Return messages for the session ordered by time.',
      fields: [
        ...inlineCreds,
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit (last N)', type: 'number' },
      ],
      run: loadSession,
    },
    {
      id: 'clear_session',
      label: 'Clear session',
      description: 'Delete all rows for the session.',
      fields: [
        ...inlineCreds,
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
      ],
      run: clearSession,
    },
  ],
};

registerForgeBlock(block);
export default block;
