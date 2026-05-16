/**
 * Forge block: Postgres (extended ops)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Postgres/v2/PostgresV2.node.ts
 *
 * This block delegates execution to an internal PostgREST-style HTTP proxy
 * pointed at by the inline `proxyUrl` field. The proxy interprets the
 * payload `{ sql, params }` and returns rows. This keeps the block edge-safe
 * without bundling `pg`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function headers(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.proxyToken);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function proxyUrl(ctx: ForgeActionContext): string {
  const u = asString(ctx.options.proxyUrl);
  if (!u) throw new Error('Postgres: proxyUrl is required');
  return u.replace(/\/+$/, '');
}

async function executeQuery(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sql = asString(ctx.options.sql);
  if (!sql) throw new Error('Postgres: sql is required');
  let params: unknown[] = [];
  const rawParams = asString(ctx.options.params).trim();
  if (rawParams) {
    try {
      const v = JSON.parse(rawParams);
      if (Array.isArray(v)) params = v;
    } catch {
      params = rawParams.split(',').map((s) => s.trim());
    }
  }
  const res = await apiRequest({
    service: 'Postgres',
    method: 'POST',
    url: `${proxyUrl(ctx)}/query`,
    headers: headers(ctx),
    json: { sql, params },
  });
  return { outputs: { rows: res.data }, logs: [`Postgres execute → ${sql.slice(0, 60)}`] };
}

async function insertRow(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const table = asString(ctx.options.table);
  const dataRaw = asString(ctx.options.data);
  if (!table || !dataRaw) throw new Error('Postgres: table and data are required');
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(dataRaw);
  } catch {
    throw new Error('Postgres: data must be valid JSON');
  }
  const cols = Object.keys(data);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;
  const res = await apiRequest({
    service: 'Postgres',
    method: 'POST',
    url: `${proxyUrl(ctx)}/query`,
    headers: headers(ctx),
    json: { sql, params: cols.map((c) => data[c]) },
  });
  return { outputs: { row: res.data }, logs: [`Postgres insert → ${table}`] };
}

async function deleteRows(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const table = asString(ctx.options.table);
  const where = asString(ctx.options.where);
  if (!table || !where) throw new Error('Postgres: table and where are required');
  const sql = `DELETE FROM ${table} WHERE ${where} RETURNING *`;
  const res = await apiRequest({
    service: 'Postgres',
    method: 'POST',
    url: `${proxyUrl(ctx)}/query`,
    headers: headers(ctx),
    json: { sql, params: [] },
  });
  return { outputs: { rows: res.data }, logs: [`Postgres delete → ${table}`] };
}

const block: ForgeBlock = {
  id: 'forge_postgres_ext',
  name: 'Postgres (extended)',
  description: 'Execute arbitrary SQL, insert rows, delete rows via Postgres proxy.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'execute_query',
      label: 'Execute SQL',
      fields: [
        { id: 'proxyUrl', label: 'Proxy URL', type: 'text', required: true },
        { id: 'proxyToken', label: 'Proxy token', type: 'password' },
        { id: 'sql', label: 'SQL', type: 'textarea', required: true },
        { id: 'params', label: 'Params (JSON array or CSV)', type: 'text' },
      ],
      run: executeQuery,
    },
    {
      id: 'insert_row',
      label: 'Insert row',
      fields: [
        { id: 'proxyUrl', label: 'Proxy URL', type: 'text', required: true },
        { id: 'proxyToken', label: 'Proxy token', type: 'password' },
        { id: 'table', label: 'Table name', type: 'text', required: true },
        { id: 'data', label: 'Row JSON', type: 'json', required: true },
      ],
      run: insertRow,
    },
    {
      id: 'delete_rows',
      label: 'Delete rows',
      fields: [
        { id: 'proxyUrl', label: 'Proxy URL', type: 'text', required: true },
        { id: 'proxyToken', label: 'Proxy token', type: 'password' },
        { id: 'table', label: 'Table name', type: 'text', required: true },
        { id: 'where', label: 'WHERE clause', type: 'text', required: true },
      ],
      run: deleteRows,
    },
  ],
};

registerForgeBlock(block);
export default block;
