/**
 * Forge block: PostgreSQL
 *
 * Source: n8n-master/packages/nodes-base/nodes/Postgres/Postgres.node.ts
 * Credential type: 'postgres' (expects { host, port?, database, username, password, ssl? }).
 *
 * Operations covered:
 *   - query.execute   Raw SQL with positional ($1, $2…) parameters
 *   - query.insert    INSERT helper with column list + JSON value rows
 *   - query.update    UPDATE helper — pass a full UPDATE statement + bindings
 *
 * Deferred:
 *   - Connection pooling (single-shot client per call, like MongoDB)
 *   - LISTEN / NOTIFY, prepared statement reuse, COPY streams
 */

import type { Client } from 'pg';
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asBoolean, asNumber, asString, requireCredential } from '../_shared/http';

type PgCredential = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

function readCred(ctx: ForgeActionContext): PgCredential {
  const cred = requireCredential('Postgres', ctx.credential);
  if (!cred.host) throw new Error('Postgres: credential is missing `host`');
  if (!cred.database) throw new Error('Postgres: credential is missing `database`');
  return {
    host: cred.host,
    port: asNumber(cred.port) ?? 5432,
    database: cred.database,
    user: cred.username ?? '',
    password: cred.password ?? '',
    ssl: asBoolean(cred.ssl),
  };
}

async function withClient<T>(
  ctx: ForgeActionContext,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const cred = readCred(ctx);
  const pg = await import('pg');
  const PgClient = (pg as unknown as { Client: typeof Client }).Client
    ?? (pg as unknown as { default: { Client: typeof Client } }).default.Client;
  const client = new PgClient({
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
    throw new Error(`Postgres: parameters is not valid JSON — ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Postgres: parameters must be a JSON array');
  }
  return parsed;
}

async function queryExecute(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sql = asString(ctx.options.sql);
  if (!sql) throw new Error('Postgres: sql is required');
  const params = parseParams(ctx.options.params);
  return withClient(ctx, async (client) => {
    const res = await client.query(sql, params);
    return {
      outputs: { rows: res.rows, rowCount: res.rowCount },
      logs: [`Postgres execute → ${res.rowCount ?? 0} rows`],
    };
  });
}

async function queryInsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const table = asString(ctx.options.table);
  const columns = asString(ctx.options.columns);
  const rowsRaw = asString(ctx.options.rows);
  if (!table) throw new Error('Postgres: table is required');
  if (!columns) throw new Error('Postgres: columns is required');
  if (!rowsRaw) throw new Error('Postgres: rows is required');

  let rows: unknown;
  try {
    rows = JSON.parse(rowsRaw);
  } catch (err) {
    throw new Error(`Postgres: rows is not valid JSON — ${(err as Error).message}`);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Postgres: rows must be a non-empty JSON array');
  }
  const cols = columns.split(',').map((c) => c.trim()).filter(Boolean);
  if (cols.length === 0) throw new Error('Postgres: columns must contain at least one name');

  return withClient(ctx, async (client) => {
    let total = 0;
    const inserted: unknown[] = [];
    for (const row of rows as unknown[][]) {
      if (!Array.isArray(row)) {
        throw new Error('Postgres: each row must itself be an array of values');
      }
      if (row.length !== cols.length) {
        throw new Error(`Postgres: row has ${row.length} values, expected ${cols.length}`);
      }
      const placeholders = row.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const res = await client.query(sql, row);
      total += res.rowCount ?? 0;
      inserted.push(...res.rows);
    }
    return {
      outputs: { rows: inserted, rowCount: total },
      logs: [`Postgres insert → ${total} rows into ${table}`],
    };
  });
}

async function queryUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sql = asString(ctx.options.sql);
  if (!sql) throw new Error('Postgres: sql is required (e.g. UPDATE t SET x = $1 WHERE id = $2)');
  const params = parseParams(ctx.options.params);
  return withClient(ctx, async (client) => {
    const res = await client.query(sql, params);
    return {
      outputs: { rows: res.rows, rowCount: res.rowCount },
      logs: [`Postgres update → ${res.rowCount ?? 0} rows`],
    };
  });
}

const block: ForgeBlock = {
  id: 'forge_postgres',
  name: 'PostgreSQL',
  description: 'Run parameterised SQL queries against PostgreSQL.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'postgres' },
  actions: [
    {
      id: 'query_execute',
      label: 'Execute query',
      description: 'Run any SQL statement with positional parameters.',
      fields: [
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
      id: 'query_update',
      label: 'Update rows',
      description: 'Run an UPDATE statement with positional parameters.',
      fields: [
        {
          id: 'sql',
          label: 'SQL',
          type: 'textarea',
          required: true,
          placeholder: 'UPDATE users SET name = $1 WHERE id = $2',
        },
        { id: 'params', label: 'Parameters (JSON array)', type: 'json', defaultValue: '[]' },
      ],
      run: queryUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
