/**
 * Forge block: LangChain Tool — SQL Database
 *
 * Source: @n8n/nodes-langchain/nodes/tools/ToolSqlAgent/
 *
 * Run a SQL query against a Postgres or MySQL database. Driver is loaded
 * lazily via dynamic import — neither `pg` nor `mysql2` is a hard dependency
 * of the forge bundle, so this block is safe to register on the edge.
 *
 * Caveats:
 *   - Only SELECT is recommended; we don't enforce read-only.
 *   - Each `query` call opens a fresh connection — no pooling.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

type PgClientCtor = new (cfg: { connectionString: string }) => {
  connect: () => Promise<void>;
  query: (text: string) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>;
  end: () => Promise<void>;
};

type MysqlModule = {
  createConnection: (uri: string) => Promise<{
    execute: (sql: string) => Promise<[Record<string, unknown>[], unknown]>;
    end: () => Promise<void>;
  }>;
};

function pickDialect(url: string): 'postgres' | 'mysql' {
  const lower = url.toLowerCase().trim();
  if (lower.startsWith('postgres://') || lower.startsWith('postgresql://')) return 'postgres';
  if (lower.startsWith('mysql://') || lower.startsWith('mysql2://')) return 'mysql';
  throw new Error(
    'SQL Tool: connectionString must start with postgres://, postgresql://, mysql:// or mysql2://',
  );
}

async function runPostgres(uri: string, sql: string): Promise<Record<string, unknown>[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await import('pg').catch(() => null)) as any;
  if (!mod) throw new Error('SQL Tool: postgres driver "pg" is not installed');
  const PgClient = (mod.Client ?? mod.default?.Client) as PgClientCtor | undefined;
  if (!PgClient) throw new Error('SQL Tool: pg.Client export not found');

  const client = new PgClient({ connectionString: uri });
  await client.connect();
  try {
    const res = await client.query(sql);
    return res.rows ?? [];
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function runMysql(uri: string, sql: string): Promise<Record<string, unknown>[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await import('mysql2/promise').catch(() => null)) as any;
  if (!mod) throw new Error('SQL Tool: mysql driver "mysql2" is not installed');
  const m = (mod.default ?? mod) as MysqlModule;
  // mysql2's URI doesn't support the mysql2:// alias, strip it.
  const normalised = uri.replace(/^mysql2:\/\//, 'mysql://');
  const conn = await m.createConnection(normalised);
  try {
    const [rows] = await conn.execute(sql);
    return Array.isArray(rows) ? rows : [];
  } finally {
    await conn.end().catch(() => undefined);
  }
}

async function query(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const connectionString = asString(ctx.options.connectionString).trim();
  const sql = asString(ctx.options.sql).trim();
  if (!connectionString) throw new Error('SQL Tool: connectionString is required');
  if (!sql) throw new Error('SQL Tool: sql is required');

  const dialect = pickDialect(connectionString);
  const rows = dialect === 'postgres'
    ? await runPostgres(connectionString, sql)
    : await runMysql(connectionString, sql);

  return {
    outputs: { rows, count: rows.length, dialect },
    logs: [`SQL Tool ${dialect} → ${rows.length} row(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_tool_sql',
  name: 'LangChain Tool — SQL Database',
  description: 'Run a SQL query against Postgres or MySQL (driver loaded dynamically).',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'query',
      label: 'Run SQL query',
      fields: [
        {
          id: 'connectionString',
          label: 'Connection string',
          type: 'password',
          required: true,
          placeholder: 'postgres://user:pass@host:5432/db',
          helperText: 'postgres:// / postgresql:// / mysql:// / mysql2://',
        },
        { id: 'sql', label: 'SQL', type: 'code', required: true, placeholder: 'SELECT 1' },
      ],
      run: query,
    },
  ],
};

registerForgeBlock(block);
export default block;
