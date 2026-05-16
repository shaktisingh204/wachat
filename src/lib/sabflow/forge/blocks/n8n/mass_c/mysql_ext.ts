/**
 * Forge block: MySQL (extended ops)
 *
 * Source: n8n-master/packages/nodes-base/nodes/MySql/v2/MySqlV2.node.ts
 *
 * Like postgres_ext, this delegates to an HTTP proxy that accepts
 * `{ sql, params }` and returns rows. Keeps the block edge-safe.
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
  if (!u) throw new Error('MySQL: proxyUrl is required');
  return u.replace(/\/+$/, '');
}

async function executeQuery(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sql = asString(ctx.options.sql);
  if (!sql) throw new Error('MySQL: sql is required');
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
    service: 'MySQL',
    method: 'POST',
    url: `${proxyUrl(ctx)}/query`,
    headers: headers(ctx),
    json: { sql, params },
  });
  return { outputs: { rows: res.data }, logs: [`MySQL execute → ${sql.slice(0, 60)}`] };
}

async function insertRow(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const table = asString(ctx.options.table);
  const dataRaw = asString(ctx.options.data);
  if (!table || !dataRaw) throw new Error('MySQL: table and data are required');
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataRaw);
  } catch {
    throw new Error('MySQL: data must be valid JSON');
  }
  const cols = Object.keys(data);
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;
  const res = await apiRequest({
    service: 'MySQL',
    method: 'POST',
    url: `${proxyUrl(ctx)}/query`,
    headers: headers(ctx),
    json: { sql, params: cols.map((c) => data[c]) },
  });
  return { outputs: { result: res.data }, logs: [`MySQL insert → ${table}`] };
}

async function updateRows(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const table = asString(ctx.options.table);
  const dataRaw = asString(ctx.options.data);
  const where = asString(ctx.options.where);
  if (!table || !dataRaw || !where) throw new Error('MySQL: table, data and where are required');
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataRaw);
  } catch {
    throw new Error('MySQL: data must be valid JSON');
  }
  const cols = Object.keys(data);
  const set = cols.map((c) => `\`${c}\` = ?`).join(', ');
  const sql = `UPDATE \`${table}\` SET ${set} WHERE ${where}`;
  const res = await apiRequest({
    service: 'MySQL',
    method: 'POST',
    url: `${proxyUrl(ctx)}/query`,
    headers: headers(ctx),
    json: { sql, params: cols.map((c) => data[c]) },
  });
  return { outputs: { result: res.data }, logs: [`MySQL update → ${table}`] };
}

const block: ForgeBlock = {
  id: 'forge_mysql_ext',
  name: 'MySQL (extended)',
  description: 'Execute SQL, insert rows, update rows via MySQL proxy.',
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
      id: 'update_rows',
      label: 'Update rows',
      fields: [
        { id: 'proxyUrl', label: 'Proxy URL', type: 'text', required: true },
        { id: 'proxyToken', label: 'Proxy token', type: 'password' },
        { id: 'table', label: 'Table name', type: 'text', required: true },
        { id: 'data', label: 'Update JSON', type: 'json', required: true },
        { id: 'where', label: 'WHERE clause', type: 'text', required: true },
      ],
      run: updateRows,
    },
  ],
};

registerForgeBlock(block);
export default block;
