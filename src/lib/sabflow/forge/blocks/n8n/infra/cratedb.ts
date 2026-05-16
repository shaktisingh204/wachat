/**
 * Forge block: CrateDB
 *
 * Source: n8n-master/packages/nodes-base/nodes/CrateDb/CrateDb.node.ts
 *
 * CrateDB speaks the PostgreSQL wire protocol, so we use the `pg` driver.
 * Credentials are inlined as `password` fields.
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
  if (!host) throw new Error('CrateDB: host is required');
  return {
    host,
    port: asNumber(ctx.options.port) ?? 5432,
    database: asString(ctx.options.database) || 'doc',
    user: asString(ctx.options.user) || 'crate',
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
    throw new Error(`CrateDB: parameters is not valid JSON — ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed)) throw new Error('CrateDB: parameters must be a JSON array');
  return parsed;
}

async function queryExecute(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sql = asString(ctx.options.sql);
  if (!sql) throw new Error('CrateDB: sql is required');
  const params = parseParams(ctx.options.params);
  return withClient(ctx, async (client) => {
    const res = await client.query(sql, params);
    return {
      outputs: { rows: res.rows, rowCount: res.rowCount },
      logs: [`CrateDB execute → ${res.rowCount ?? 0} rows`],
    };
  });
}

async function queryInsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const table = asString(ctx.options.table);
  const columns = asString(ctx.options.columns);
  const rowsRaw = asString(ctx.options.rows);
  if (!table) throw new Error('CrateDB: table is required');
  if (!columns) throw new Error('CrateDB: columns is required');
  if (!rowsRaw) throw new Error('CrateDB: rows is required');
  let rows: unknown;
  try {
    rows = JSON.parse(rowsRaw);
  } catch (err) {
    throw new Error(`CrateDB: rows is not valid JSON — ${(err as Error).message}`);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('CrateDB: rows must be a non-empty JSON array');
  }
  const cols = columns.split(',').map((c) => c.trim()).filter(Boolean);
  if (cols.length === 0) throw new Error('CrateDB: columns must contain at least one name');

  return withClient(ctx, async (client) => {
    let total = 0;
    for (const row of rows as unknown[][]) {
      if (!Array.isArray(row)) throw new Error('CrateDB: each row must be an array of values');
      if (row.length !== cols.length) {
        throw new Error(`CrateDB: row has ${row.length} values, expected ${cols.length}`);
      }
      const placeholders = row.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
      const res = await client.query(sql, row);
      total += res.rowCount ?? 0;
    }
    return { outputs: { rowCount: total }, logs: [`CrateDB insert → ${total} rows into ${table}`] };
  });
}

async function querySelect(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const table = asString(ctx.options.table);
  if (!table) throw new Error('CrateDB: table is required');
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
      logs: [`CrateDB select → ${res.rowCount ?? 0} rows from ${table}`],
    };
  });
}

const CRED_FIELDS = [
  { id: 'host', label: 'Host', type: 'text' as const, required: true, placeholder: 'localhost' },
  { id: 'port', label: 'Port', type: 'number' as const, defaultValue: 5432 },
  { id: 'database', label: 'Database (schema)', type: 'text' as const, defaultValue: 'doc' },
  { id: 'user', label: 'User', type: 'text' as const, defaultValue: 'crate' },
  { id: 'password', label: 'Password', type: 'password' as const },
  { id: 'ssl', label: 'SSL', type: 'toggle' as const, defaultValue: false },
];

const block: ForgeBlock = {
  id: 'forge_cratedb',
  name: 'CrateDB',
  description: 'Run SQL against a CrateDB distributed database (Postgres-wire compatible).',
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
        { id: 'sql', label: 'SQL', type: 'textarea', required: true, placeholder: 'SELECT * FROM users WHERE id = $1' },
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
        { id: 'columns', label: 'Columns (CSV)', type: 'text', required: true, placeholder: 'name, email' },
        {
          id: 'rows',
          label: 'Rows (JSON array of arrays)',
          type: 'json',
          required: true,
          placeholder: '[["Ada", "ada@example.com"]]',
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
        { id: 'where', label: 'WHERE clause', type: 'text', placeholder: 'id = $1' },
        { id: 'params', label: 'Parameters (JSON array)', type: 'json', defaultValue: '[]' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: querySelect,
    },
  ],
};

registerForgeBlock(block);
export default block;
