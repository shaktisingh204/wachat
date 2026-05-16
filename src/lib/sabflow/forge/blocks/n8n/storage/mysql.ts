/**
 * Forge block: MySQL
 *
 * Source: n8n-master/packages/nodes-base/nodes/MySql/MySql.node.ts
 * Credential type: 'mysql' (expects { host, port?, database, username, password }).
 *
 * Operations covered:
 *   - query.execute   Raw SQL with `?` placeholder parameters
 *   - query.insert    INSERT helper with column list + JSON value rows
 *   - query.update    UPDATE helper — pass a full UPDATE statement + bindings
 *
 * Deferred:
 *   - Connection pooling
 *   - Stored-procedure call helper, transaction blocks, streamed result sets
 */

import { createConnection } from 'mysql2/promise';
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString, requireCredential } from '../_shared/http';

type MysqlCredential = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

function readCred(ctx: ForgeActionContext): MysqlCredential {
  const cred = requireCredential('MySQL', ctx.credential);
  if (!cred.host) throw new Error('MySQL: credential is missing `host`');
  if (!cred.database) throw new Error('MySQL: credential is missing `database`');
  return {
    host: cred.host,
    port: asNumber(cred.port) ?? 3306,
    database: cred.database,
    user: cred.username ?? '',
    password: cred.password ?? '',
  };
}

type MysqlConnection = Awaited<ReturnType<typeof createConnection>>;

async function withConnection<T>(
  ctx: ForgeActionContext,
  fn: (conn: MysqlConnection) => Promise<T>,
): Promise<T> {
  const cred = readCred(ctx);
  const conn = await createConnection({
    host: cred.host,
    port: cred.port,
    database: cred.database,
    user: cred.user,
    password: cred.password,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.end().catch(() => undefined);
  }
}

function parseParams(raw: unknown): unknown[] {
  const s = asString(raw).trim();
  if (!s) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch (err) {
    throw new Error(`MySQL: parameters is not valid JSON — ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('MySQL: parameters must be a JSON array');
  }
  return parsed;
}

type MysqlOkPacket = {
  affectedRows?: number;
  insertId?: number;
};

async function queryExecute(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sql = asString(ctx.options.sql);
  if (!sql) throw new Error('MySQL: sql is required');
  const params = parseParams(ctx.options.params);
  return withConnection(ctx, async (conn) => {
    const [rows] = await conn.execute(sql, params as never);
    const count = Array.isArray(rows) ? rows.length : ((rows as MysqlOkPacket)?.affectedRows ?? 0);
    return {
      outputs: { rows, rowCount: count },
      logs: [`MySQL execute → ${count} rows`],
    };
  });
}

async function queryInsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const table = asString(ctx.options.table);
  const columns = asString(ctx.options.columns);
  const rowsRaw = asString(ctx.options.rows);
  if (!table) throw new Error('MySQL: table is required');
  if (!columns) throw new Error('MySQL: columns is required');
  if (!rowsRaw) throw new Error('MySQL: rows is required');

  let rows: unknown;
  try {
    rows = JSON.parse(rowsRaw);
  } catch (err) {
    throw new Error(`MySQL: rows is not valid JSON — ${(err as Error).message}`);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('MySQL: rows must be a non-empty JSON array');
  }
  const cols = columns.split(',').map((c) => c.trim()).filter(Boolean);
  if (cols.length === 0) throw new Error('MySQL: columns must contain at least one name');

  return withConnection(ctx, async (conn) => {
    let total = 0;
    const insertIds: number[] = [];
    for (const row of rows as unknown[][]) {
      if (!Array.isArray(row)) {
        throw new Error('MySQL: each row must itself be an array of values');
      }
      if (row.length !== cols.length) {
        throw new Error(`MySQL: row has ${row.length} values, expected ${cols.length}`);
      }
      const placeholders = row.map(() => '?').join(', ');
      const sql = `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;
      const [result] = await conn.execute(sql, row as never);
      const pkt = result as MysqlOkPacket;
      total += pkt?.affectedRows ?? 0;
      if (typeof pkt?.insertId === 'number') insertIds.push(pkt.insertId);
    }
    return {
      outputs: { affectedRows: total, insertIds },
      logs: [`MySQL insert → ${total} rows into ${table}`],
    };
  });
}

async function queryUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sql = asString(ctx.options.sql);
  if (!sql) throw new Error('MySQL: sql is required (e.g. UPDATE t SET x = ? WHERE id = ?)');
  const params = parseParams(ctx.options.params);
  return withConnection(ctx, async (conn) => {
    const [result] = await conn.execute(sql, params as never);
    const pkt = result as MysqlOkPacket;
    return {
      outputs: { affectedRows: pkt?.affectedRows ?? 0 },
      logs: [`MySQL update → ${pkt?.affectedRows ?? 0} rows`],
    };
  });
}

const block: ForgeBlock = {
  id: 'forge_mysql',
  name: 'MySQL',
  description: 'Run parameterised SQL queries against MySQL.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mysql' },
  actions: [
    {
      id: 'query_execute',
      label: 'Execute query',
      description: 'Run any SQL statement with positional `?` parameters.',
      fields: [
        { id: 'sql', label: 'SQL', type: 'textarea', required: true, placeholder: 'SELECT * FROM users WHERE id = ?' },
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
      description: 'Run an UPDATE statement with positional `?` parameters.',
      fields: [
        {
          id: 'sql',
          label: 'SQL',
          type: 'textarea',
          required: true,
          placeholder: 'UPDATE users SET name = ? WHERE id = ?',
        },
        { id: 'params', label: 'Parameters (JSON array)', type: 'json', defaultValue: '[]' },
      ],
      run: queryUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
