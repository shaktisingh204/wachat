/**
 * Forge block: QuestDB
 *
 * Source: n8n-master/packages/nodes-base/nodes/QuestDb/QuestDb.node.ts
 *
 * QuestDB exposes a PostgreSQL-wire-compatible endpoint, so we use the `pg`
 * driver (same pattern as `storage/postgres.ts`). Credentials are inlined as
 * `password` fields — no shared credential type.
 *
 * Operations covered:
 *   - query.execute   Raw SQL with positional ($1, $2…) parameters
 *   - query.insert    INSERT helper with column list + JSON value rows
 *   - query.select    SELECT helper returning rows
 */

import { Client } from 'pg';
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asBoolean, asNumber, asString } from '../_shared/http';

type PgLikeCredential = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

function readCred(ctx: ForgeActionContext): PgLikeCredential {
  const host = asString(ctx.options.host);
  if (!host) throw new Error('QuestDB: host is required');
  const database = asString(ctx.options.database);
  if (!database) throw new Error('QuestDB: database is required');
  return {
    host,
    port: asNumber(ctx.options.port) ?? 8812,
    database,
    user: asString(ctx.options.user) || 'admin',
    password: asString(ctx.options.password),
    ssl: asBoolean(ctx.options.ssl),
  };
}

async function withClient<T>(
  ctx: ForgeActionContext,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const cred = readCred(ctx);
  const client = new Client({
    host: cred.host,
    port: cred.port,
    database: cred.database,
    user: cred.user,
    password: cred.password,
    ssl: cred.ssl ? { rejectUnauthorized: false } : false,
  });
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

function parseParams(raw: unknown): unknown[] {
  const s = asString(raw).trim();
  if (!s) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch (err) {
    throw new Error(`QuestDB: parameters is not valid JSON — ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed)) throw new Error('QuestDB: parameters must be a JSON array');
  return parsed;
}

async function queryExecute(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sql = asString(ctx.options.sql);
  if (!sql) throw new Error('QuestDB: sql is required');
  const params = parseParams(ctx.options.params);
  return withClient(ctx, async (client) => {
    const res = await client.query(sql, params);
    return {
      outputs: { rows: res.rows, rowCount: res.rowCount },
      logs: [`QuestDB execute → ${res.rowCount ?? 0} rows`],
    };
  });
}

async function queryInsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const table = asString(ctx.options.table);
  const columns = asString(ctx.options.columns);
  const rowsRaw = asString(ctx.options.rows);
  if (!table) throw new Error('QuestDB: table is required');
  if (!columns) throw new Error('QuestDB: columns is required');
  if (!rowsRaw) throw new Error('QuestDB: rows is required');
  let rows: unknown;
  try {
    rows = JSON.parse(rowsRaw);
  } catch (err) {
    throw new Error(`QuestDB: rows is not valid JSON — ${(err as Error).message}`);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('QuestDB: rows must be a non-empty JSON array');
  }
  const cols = columns.split(',').map((c) => c.trim()).filter(Boolean);
  if (cols.length === 0) throw new Error('QuestDB: columns must contain at least one name');

  return withClient(ctx, async (client) => {
    let total = 0;
    for (const row of rows as unknown[][]) {
      if (!Array.isArray(row)) throw new Error('QuestDB: each row must be an array of values');
      if (row.length !== cols.length) {
        throw new Error(`QuestDB: row has ${row.length} values, expected ${cols.length}`);
      }
      const placeholders = row.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
      const res = await client.query(sql, row);
      total += res.rowCount ?? 0;
    }
    return { outputs: { rowCount: total }, logs: [`QuestDB insert → ${total} rows into ${table}`] };
  });
}

async function querySelect(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const table = asString(ctx.options.table);
  if (!table) throw new Error('QuestDB: table is required');
  const where = asString(ctx.options.where);
  const limit = asNumber(ctx.options.limit);
  const params = parseParams(ctx.options.params);
  let sql = `SELECT * FROM ${table}`;
  if (where) sql += ` WHERE ${where}`;
  if (limit !== undefined) sql += ` LIMIT ${limit}`;
  return withClient(ctx, async (client) => {
    const res = await client.query(sql, params);
    return {
      outputs: { rows: res.rows, rowCount: res.rowCount },
      logs: [`QuestDB select → ${res.rowCount ?? 0} rows from ${table}`],
    };
  });
}

const CRED_FIELDS = [
  { id: 'host', label: 'Host', type: 'text' as const, required: true, placeholder: 'localhost' },
  { id: 'port', label: 'Port', type: 'number' as const, defaultValue: 8812 },
  { id: 'database', label: 'Database', type: 'text' as const, required: true, defaultValue: 'qdb' },
  { id: 'user', label: 'User', type: 'text' as const, defaultValue: 'admin' },
  { id: 'password', label: 'Password', type: 'password' as const },
  { id: 'ssl', label: 'SSL', type: 'toggle' as const, defaultValue: false },
];

const block: ForgeBlock = {
  id: 'forge_questdb',
  name: 'QuestDB',
  description: 'Run SQL against a QuestDB time-series database (Postgres-wire compatible).',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'query_execute',
      label: 'Execute query',
      description: 'Run any SQL statement with positional parameters.',
      fields: [
        ...CRED_FIELDS,
        { id: 'sql', label: 'SQL', type: 'textarea', required: true, placeholder: 'SELECT * FROM trades WHERE symbol = $1' },
        { id: 'params', label: 'Parameters (JSON array)', type: 'json', defaultValue: '[]' },
      ],
      run: queryExecute,
    },
    {
      id: 'query_insert',
      label: 'Insert rows',
      description: 'INSERT one or more rows; columns is CSV, rows is JSON array-of-arrays.',
      fields: [
        ...CRED_FIELDS,
        { id: 'table', label: 'Table', type: 'text', required: true },
        { id: 'columns', label: 'Columns (CSV)', type: 'text', required: true, placeholder: 'symbol, price, ts' },
        {
          id: 'rows',
          label: 'Rows (JSON array of arrays)',
          type: 'json',
          required: true,
          placeholder: '[["BTCUSD", 70000, "2024-01-01T00:00:00Z"]]',
        },
      ],
      run: queryInsert,
    },
    {
      id: 'query_select',
      label: 'Select rows',
      description: 'SELECT * FROM table with optional WHERE / LIMIT.',
      fields: [
        ...CRED_FIELDS,
        { id: 'table', label: 'Table', type: 'text', required: true },
        { id: 'where', label: 'WHERE clause', type: 'text', placeholder: 'symbol = $1' },
        { id: 'params', label: 'Parameters (JSON array)', type: 'json', defaultValue: '[]' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: querySelect,
    },
  ],
};

registerForgeBlock(block);
export default block;
