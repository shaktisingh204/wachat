/**
 * Forge block: Oracle SQL
 *
 * Source: n8n-master/packages/nodes-base/nodes/Oracle/Sql/OracleSql.node.ts
 *
 * Dynamic-imports `oracledb`. Oracle uses :name-style bind parameters
 * (or positional via array of bind values), so the JSON params field accepts
 * either an array or an object.
 *
 * Operations covered:
 *   - query.execute   Raw SQL with bind parameters (object or array)
 *   - query.insert    INSERT helper with column list + JSON value rows
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

type OracleCredential = {
  user: string;
  password: string;
  connectString: string;
};

function readCred(ctx: ForgeActionContext): OracleCredential {
  const user = asString(ctx.options.user);
  if (!user) throw new Error('Oracle: user is required');
  const host = asString(ctx.options.host);
  const port = asNumber(ctx.options.port) ?? 1521;
  const sid = asString(ctx.options.sid);
  const serviceName = asString(ctx.options.serviceName);
  const explicit = asString(ctx.options.connectString);
  let connectString = explicit;
  if (!connectString) {
    if (!host) throw new Error('Oracle: host or connectString is required');
    if (serviceName) connectString = `${host}:${port}/${serviceName}`;
    else if (sid) connectString = `${host}:${port}/${sid}`;
    else connectString = `${host}:${port}`;
  }
  return {
    user,
    password: asString(ctx.options.password),
    connectString,
  };
}

function driverMissing(): Error {
  return new Error("Oracle: install 'oracledb' to use this block");
}

type OracleConn = {
  execute: (
    sql: string,
    binds?: unknown,
    opts?: Record<string, unknown>,
  ) => Promise<{ rows?: unknown[]; rowsAffected?: number; outBinds?: unknown }>;
  close: () => Promise<void>;
  commit: () => Promise<void>;
};

async function withConn<T>(
  ctx: ForgeActionContext,
  fn: (conn: OracleConn, oracledb: Record<string, unknown>) => Promise<T>,
): Promise<T> {
  const cred = readCred(ctx);
  let mod: Record<string, unknown> | undefined;
  try {
    mod = (await import(/* webpackIgnore: true */ 'oracledb' as string)) as Record<string, unknown>;
  } catch {
    throw driverMissing();
  }
  const oracledb = (mod as { default?: Record<string, unknown> }).default ?? mod;
  const getConnection = (oracledb as { getConnection?: (opts: Record<string, unknown>) => Promise<OracleConn> })
    .getConnection;
  if (typeof getConnection !== 'function') throw driverMissing();
  const conn = await getConnection({
    user: cred.user,
    password: cred.password,
    connectString: cred.connectString,
  });
  try {
    return await fn(conn, oracledb);
  } finally {
    await conn.close().catch(() => undefined);
  }
}

function parseBinds(raw: unknown): unknown {
  const s = asString(raw).trim();
  if (!s) return [];
  try {
    return JSON.parse(s);
  } catch (err) {
    throw new Error(`Oracle: parameters is not valid JSON — ${(err as Error).message}`);
  }
}

async function queryExecute(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sql = asString(ctx.options.sql);
  if (!sql) throw new Error('Oracle: sql is required');
  const binds = parseBinds(ctx.options.params);
  return withConn(ctx, async (conn, oracledb) => {
    const OUT_FORMAT_OBJECT = (oracledb as { OUT_FORMAT_OBJECT?: number }).OUT_FORMAT_OBJECT ?? 4002;
    const res = await conn.execute(sql, binds as Record<string, unknown> | unknown[], {
      outFormat: OUT_FORMAT_OBJECT,
      autoCommit: true,
    });
    return {
      outputs: { rows: res.rows ?? [], rowsAffected: res.rowsAffected ?? 0 },
      logs: [`Oracle execute → ${res.rows?.length ?? res.rowsAffected ?? 0} rows`],
    };
  });
}

async function queryInsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const table = asString(ctx.options.table);
  const columns = asString(ctx.options.columns);
  const rowsRaw = asString(ctx.options.rows);
  if (!table) throw new Error('Oracle: table is required');
  if (!columns) throw new Error('Oracle: columns is required');
  if (!rowsRaw) throw new Error('Oracle: rows is required');
  let rows: unknown;
  try {
    rows = JSON.parse(rowsRaw);
  } catch (err) {
    throw new Error(`Oracle: rows is not valid JSON — ${(err as Error).message}`);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Oracle: rows must be a non-empty JSON array');
  }
  const cols = columns.split(',').map((c) => c.trim()).filter(Boolean);
  if (cols.length === 0) throw new Error('Oracle: columns must contain at least one name');

  return withConn(ctx, async (conn) => {
    let total = 0;
    for (const row of rows as unknown[][]) {
      if (!Array.isArray(row)) throw new Error('Oracle: each row must be an array of values');
      if (row.length !== cols.length) {
        throw new Error(`Oracle: row has ${row.length} values, expected ${cols.length}`);
      }
      const placeholders = row.map((_, i) => `:b${i + 1}`).join(', ');
      const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
      const res = await conn.execute(sql, row, { autoCommit: true });
      total += res.rowsAffected ?? 0;
    }
    return { outputs: { rowsAffected: total }, logs: [`Oracle insert → ${total} rows into ${table}`] };
  });
}

const CRED_FIELDS = [
  { id: 'user', label: 'User', type: 'text' as const, required: true },
  { id: 'password', label: 'Password', type: 'password' as const, required: true },
  { id: 'connectString', label: 'Connect string', type: 'text' as const, placeholder: 'host:1521/XEPDB1' },
  { id: 'host', label: 'Host (when connectString blank)', type: 'text' as const },
  { id: 'port', label: 'Port', type: 'number' as const, defaultValue: 1521 },
  { id: 'serviceName', label: 'Service name', type: 'text' as const },
  { id: 'sid', label: 'SID', type: 'text' as const },
];

const block: ForgeBlock = {
  id: 'forge_oracle',
  name: 'Oracle SQL',
  description: 'Run SQL against an Oracle database via the oracledb driver.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'query_execute',
      label: 'Execute query',
      description: 'Run any SQL statement with bind parameters (array or object).',
      fields: [
        ...CRED_FIELDS,
        { id: 'sql', label: 'SQL', type: 'textarea', required: true, placeholder: 'SELECT * FROM users WHERE id = :id' },
        { id: 'params', label: 'Binds (JSON array or object)', type: 'json', defaultValue: '[]' },
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
        { id: 'columns', label: 'Columns (CSV)', type: 'text', required: true, placeholder: 'NAME, EMAIL' },
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
  ],
};

registerForgeBlock(block);
export default block;
