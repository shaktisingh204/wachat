/**
 * Forge block: Coda
 *
 * Source: n8n-master/packages/nodes-base/nodes/Coda/Coda.node.ts
 * Credential type: 'coda' — fields: { apiToken }
 *
 * Operations covered (selection across docs / tables / rows):
 *   - doc.list                GET   /docs
 *   - doc.get                 GET   /docs/{docId}
 *   - table.listRows          GET   /docs/{docId}/tables/{tableIdOrName}/rows
 *   - row.insert              POST  /docs/{docId}/tables/{tableIdOrName}/rows
 *   - row.update              PUT   /docs/{docId}/tables/{tableIdOrName}/rows/{rowIdOrName}
 *   - row.delete              DELETE /docs/{docId}/tables/{tableIdOrName}/rows/{rowIdOrName}
 *
 * Out of scope for the first port:
 *   - LoadOptions for docs/tables/columns
 *   - Formulas, controls, views resources
 *   - Pagination (uses first page only — paginator deferred to a shared helper)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://coda.io/apis/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Coda', ctx.credential);
  const token = cred.apiToken ?? cred.accessToken;
  if (!token) throw new Error('Coda: credential is missing `apiToken`');
  return { Authorization: `Bearer ${token}` };
}

async function codaApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Coda',
    method,
    url: `${BASE}${path}`,
    headers: authHeaders(ctx),
    json,
  });
  return res.data;
}

function parseJsonObject(label: string, raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error(`Coda: ${label} must be a JSON object`);
}

function cellsFromJsonObject(obj: Record<string, unknown>): Array<{ column: string; value: unknown }> {
  return Object.entries(obj).map(([column, value]) => ({ column, value }));
}

// ── Doc ────────────────────────────────────────────────────────────────────

async function docList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await codaApi(ctx, 'GET', '/docs');
  return { outputs: { result: data }, logs: ['Coda doc list'] };
}

async function docGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = asString(ctx.options.docId);
  if (!docId) throw new Error('Coda: docId is required');
  const data = await codaApi(ctx, 'GET', `/docs/${encodeURIComponent(docId)}`);
  return { outputs: { doc: data }, logs: [`Coda doc get → ${docId}`] };
}

// ── Table ──────────────────────────────────────────────────────────────────

async function tableListRows(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = asString(ctx.options.docId);
  const tableId = asString(ctx.options.tableId);
  if (!docId) throw new Error('Coda: docId is required');
  if (!tableId) throw new Error('Coda: tableId is required');
  const data = await codaApi(
    ctx,
    'GET',
    `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows`,
  );
  return { outputs: { result: data }, logs: [`Coda table rows → ${tableId}`] };
}

// ── Row ────────────────────────────────────────────────────────────────────

async function rowInsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = asString(ctx.options.docId);
  const tableId = asString(ctx.options.tableId);
  if (!docId) throw new Error('Coda: docId is required');
  if (!tableId) throw new Error('Coda: tableId is required');
  const cellsObj = parseJsonObject('cells', ctx.options.cells);
  const cells = cellsFromJsonObject(cellsObj);
  if (cells.length === 0) throw new Error('Coda: cells JSON must contain at least one column');

  const body = { rows: [{ cells }] };
  const data = await codaApi(
    ctx,
    'POST',
    `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows`,
    body,
  );
  return { outputs: { result: data }, logs: [`Coda row insert → ${tableId}`] };
}

async function rowUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = asString(ctx.options.docId);
  const tableId = asString(ctx.options.tableId);
  const rowId = asString(ctx.options.rowId);
  if (!docId) throw new Error('Coda: docId is required');
  if (!tableId) throw new Error('Coda: tableId is required');
  if (!rowId) throw new Error('Coda: rowId is required');
  const cellsObj = parseJsonObject('cells', ctx.options.cells);
  const cells = cellsFromJsonObject(cellsObj);
  if (cells.length === 0) throw new Error('Coda: cells JSON must contain at least one column');

  const body = { row: { cells } };
  const data = await codaApi(
    ctx,
    'PUT',
    `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(rowId)}`,
    body,
  );
  return { outputs: { result: data }, logs: [`Coda row update → ${rowId}`] };
}

async function rowDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = asString(ctx.options.docId);
  const tableId = asString(ctx.options.tableId);
  const rowId = asString(ctx.options.rowId);
  if (!docId) throw new Error('Coda: docId is required');
  if (!tableId) throw new Error('Coda: tableId is required');
  if (!rowId) throw new Error('Coda: rowId is required');
  const data = await codaApi(
    ctx,
    'DELETE',
    `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(rowId)}`,
  );
  return { outputs: { result: data }, logs: [`Coda row delete → ${rowId}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_coda',
  name: 'Coda',
  description: 'Read docs and manage table rows in Coda.',
  iconName: 'LuFileSpreadsheet',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'coda' },
  actions: [
    {
      id: 'doc_list',
      label: 'List docs',
      description: 'List the docs accessible to the credential.',
      fields: [],
      run: docList,
    },
    {
      id: 'doc_get',
      label: 'Get doc',
      description: 'Fetch a doc by id.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
      ],
      run: docGet,
    },
    {
      id: 'table_list_rows',
      label: 'List rows',
      description: 'List rows of a table.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID or name', type: 'text', required: true },
      ],
      run: tableListRows,
    },
    {
      id: 'row_insert',
      label: 'Insert row',
      description: 'Insert a single row. Cells must be `{ "Column Name": "value", … }`.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID or name', type: 'text', required: true },
        { id: 'cells', label: 'Cells (JSON object)', type: 'json', required: true },
      ],
      run: rowInsert,
    },
    {
      id: 'row_update',
      label: 'Update row',
      description: 'Update an existing row by id or name.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID or name', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID or name', type: 'text', required: true },
        { id: 'cells', label: 'Cells (JSON object)', type: 'json', required: true },
      ],
      run: rowUpdate,
    },
    {
      id: 'row_delete',
      label: 'Delete row',
      description: 'Delete a single row.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID or name', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID or name', type: 'text', required: true },
      ],
      run: rowDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
