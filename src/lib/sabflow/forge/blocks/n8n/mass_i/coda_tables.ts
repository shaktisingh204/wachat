/**
 * Forge block: Coda (Tables ext)
 *
 * API: https://coda.io/developers/apis/v1
 * Auth: `Authorization: Bearer <api_token>`.
 *
 * Operations covered:
 *   - doc.list                  GET   /docs
 *   - table.list                GET   /docs/{docId}/tables
 *   - row.list                  GET   /docs/{docId}/tables/{tableId}/rows
 *   - row.upsert                POST  /docs/{docId}/tables/{tableId}/rows
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://coda.io/apis/v1';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.apiToken);
  if (!token) throw new Error('Coda: apiToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function docList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Coda',
    method: 'GET',
    url: `${API}/docs${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { docs: res.data }, logs: ['Coda doc list'] };
}

async function tableList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = asString(ctx.options.docId);
  if (!docId) throw new Error('Coda: docId is required');
  const res = await apiRequest({
    service: 'Coda',
    method: 'GET',
    url: `${API}/docs/${encodeURIComponent(docId)}/tables`,
    headers: authHeader(ctx),
  });
  return { outputs: { tables: res.data }, logs: [`Coda table list → ${docId}`] };
}

async function rowList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = asString(ctx.options.docId);
  const tableId = asString(ctx.options.tableId);
  if (!docId || !tableId) throw new Error('Coda: docId and tableId are required');
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  const useColumnNames = asString(ctx.options.useColumnNames);
  if (limit) params.set('limit', limit);
  if (useColumnNames) params.set('useColumnNames', useColumnNames);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Coda',
    method: 'GET',
    url: `${API}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { rows: res.data }, logs: [`Coda row list → ${tableId}`] };
}

async function rowUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = asString(ctx.options.docId);
  const tableId = asString(ctx.options.tableId);
  const cellsJson = asString(ctx.options.cells);
  if (!docId || !tableId || !cellsJson) throw new Error('Coda: docId, tableId and cells JSON are required');
  let cells: unknown;
  try {
    cells = JSON.parse(cellsJson);
  } catch {
    throw new Error('Coda: cells must be valid JSON (array of {column, value})');
  }
  if (!Array.isArray(cells)) throw new Error('Coda: cells must be an array');
  const body = { rows: [{ cells }] };
  const res = await apiRequest({
    service: 'Coda',
    method: 'POST',
    url: `${API}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Coda row upsert → ${tableId}`] };
}

const block: ForgeBlock = {
  id: 'forge_coda_tables',
  name: 'Coda (Tables)',
  description: 'Coda docs, tables and row CRUD.',
  iconName: 'LuTable',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'doc_list',
      label: 'List docs',
      description: 'List accessible Coda docs.',
      fields: [
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: docList,
    },
    {
      id: 'table_list',
      label: 'List tables',
      description: 'List tables in a doc.',
      fields: [
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
      ],
      run: tableList,
    },
    {
      id: 'row_list',
      label: 'List rows',
      description: 'List rows in a table.',
      fields: [
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'useColumnNames', label: 'Use column names', type: 'text', placeholder: 'true' },
      ],
      run: rowList,
    },
    {
      id: 'row_upsert',
      label: 'Insert row',
      description: 'Insert a single row. Cells is a JSON array of {column, value}.',
      fields: [
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'cells', label: 'Cells JSON', type: 'textarea', required: true },
      ],
      run: rowUpsert,
    },
  ],
};

registerForgeBlock(block);
export default block;
