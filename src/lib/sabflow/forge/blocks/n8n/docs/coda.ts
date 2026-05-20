/**
 * Forge block: Coda
 *
 * Source: n8n-master/packages/nodes-base/nodes/Coda/Coda.node.ts
 *   (+ TableDescription.ts, FormulaDescription.ts, ControlDescription.ts,
 *    ViewDescription.ts, GenericFunctions.ts)
 * Credential type: 'coda' — fields: { apiToken }
 *
 * Operations covered:
 *   - doc.list                 GET    /docs
 *   - doc.get                  GET    /docs/{docId}
 *   - table.list               GET    /docs/{docId}/tables
 *   - table.get                GET    /docs/{docId}/tables/{tableId}
 *   - table.list_rows          GET    /docs/{docId}/tables/{tableId}/rows
 *   - table.list_rows_all      GET    /docs/{docId}/tables/{tableId}/rows  (paginated via nextPageLink)
 *   - row.get                  GET    /docs/{docId}/tables/{tableId}/rows/{rowId}
 *   - row.insert               POST   /docs/{docId}/tables/{tableId}/rows
 *   - row.update               PUT    /docs/{docId}/tables/{tableId}/rows/{rowId}
 *   - row.delete               DELETE /docs/{docId}/tables/{tableId}/rows/{rowId}
 *   - row.push_button          POST   /docs/{docId}/tables/{tableId}/rows/{rowId}/buttons/{columnId}
 *   - column.list              GET    /docs/{docId}/tables/{tableId}/columns
 *   - column.get               GET    /docs/{docId}/tables/{tableId}/columns/{columnId}
 *   - formula.list             GET    /docs/{docId}/formulas
 *   - formula.get              GET    /docs/{docId}/formulas/{formulaId}
 *   - control.list             GET    /docs/{docId}/controls
 *   - control.get              GET    /docs/{docId}/controls/{controlId}
 *   - view.list                GET    /docs/{docId}/tables?tableTypes=view
 *   - view.list_rows           GET    /docs/{docId}/tables/{viewId}/rows
 *
 * Out of scope for this port:
 *   - LoadOptions for docs/tables/columns
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { parseJsonObject } from '../_shared/json';
import { paginateAll } from '../_shared/paginate';

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

function cellsFromJsonObject(obj: Record<string, unknown>): Array<{ column: string; value: unknown }> {
  return Object.entries(obj).map(([column, value]) => ({ column, value }));
}

function requireOpt(ctx: ForgeActionContext, id: string): string {
  const v = asString(ctx.options[id]);
  if (!v) throw new Error(`Coda: ${id} is required`);
  return v;
}

// ── Doc ────────────────────────────────────────────────────────────────────

async function docList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await codaApi(ctx, 'GET', '/docs');
  return { outputs: { result: data }, logs: ['Coda doc list'] };
}

async function docGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const data = await codaApi(ctx, 'GET', `/docs/${encodeURIComponent(docId)}`);
  return { outputs: { doc: data }, logs: [`Coda doc get → ${docId}`] };
}

// ── Table ──────────────────────────────────────────────────────────────────

async function tableList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const data = await codaApi(ctx, 'GET', `/docs/${encodeURIComponent(docId)}/tables`);
  return { outputs: { result: data }, logs: [`Coda table list → ${docId}`] };
}

async function tableGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const tableId = requireOpt(ctx, 'tableId');
  const data = await codaApi(
    ctx,
    'GET',
    `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}`,
  );
  return { outputs: { table: data }, logs: [`Coda table get → ${tableId}`] };
}

async function tableListRows(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const tableId = requireOpt(ctx, 'tableId');
  const useColumnNames = asString(ctx.options.useColumnNames) !== 'false';
  const data = await codaApi(
    ctx,
    'GET',
    `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows?useColumnNames=${useColumnNames}`,
  );
  return { outputs: { result: data }, logs: [`Coda table rows → ${tableId}`] };
}

async function tableListRowsAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const tableId = requireOpt(ctx, 'tableId');
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const useColumnNames = asString(ctx.options.useColumnNames) !== 'false';
  const headers = authHeaders(ctx);
  const firstUrl = `${BASE}/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows?useColumnNames=${useColumnNames}&limit=200`;

  const rows = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      // Coda returns `nextPageLink` as an absolute URL pre-formatted with cursor params.
      const url = cursor ?? firstUrl;
      const res = await apiRequest({ service: 'Coda', method: 'GET', url, headers });
      const body = res.data as { items?: unknown[]; nextPageLink?: string } | null;
      const items = (body?.items ?? []) as unknown[];
      const nextCursor = body?.nextPageLink && body.nextPageLink !== '' ? body.nextPageLink : undefined;
      return { items, nextCursor };
    },
  });

  return { outputs: { rows, count: rows.length }, logs: [`Coda table rows all → ${rows.length}`] };
}

// ── Row ────────────────────────────────────────────────────────────────────

async function rowGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const tableId = requireOpt(ctx, 'tableId');
  const rowId = requireOpt(ctx, 'rowId');
  const useColumnNames = asString(ctx.options.useColumnNames) !== 'false';
  const data = await codaApi(
    ctx,
    'GET',
    `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(rowId)}?useColumnNames=${useColumnNames}`,
  );
  return { outputs: { row: data }, logs: [`Coda row get → ${rowId}`] };
}

async function rowInsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const tableId = requireOpt(ctx, 'tableId');
  const cellsObj = parseJsonObject(ctx.options.cells, 'Coda: cells');
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
  const docId = requireOpt(ctx, 'docId');
  const tableId = requireOpt(ctx, 'tableId');
  const rowId = requireOpt(ctx, 'rowId');
  const cellsObj = parseJsonObject(ctx.options.cells, 'Coda: cells');
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
  const docId = requireOpt(ctx, 'docId');
  const tableId = requireOpt(ctx, 'tableId');
  const rowId = requireOpt(ctx, 'rowId');
  const data = await codaApi(
    ctx,
    'DELETE',
    `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(rowId)}`,
  );
  return { outputs: { result: data }, logs: [`Coda row delete → ${rowId}`] };
}

async function rowPushButton(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const tableId = requireOpt(ctx, 'tableId');
  const rowId = requireOpt(ctx, 'rowId');
  const columnId = requireOpt(ctx, 'columnId');
  const data = await codaApi(
    ctx,
    'POST',
    `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(rowId)}/buttons/${encodeURIComponent(columnId)}`,
  );
  return { outputs: { result: data }, logs: [`Coda row push button → ${rowId}/${columnId}`] };
}

// ── Column ─────────────────────────────────────────────────────────────────

async function columnList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const tableId = requireOpt(ctx, 'tableId');
  const data = await codaApi(
    ctx,
    'GET',
    `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/columns`,
  );
  return { outputs: { result: data }, logs: [`Coda column list → ${tableId}`] };
}

async function columnGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const tableId = requireOpt(ctx, 'tableId');
  const columnId = requireOpt(ctx, 'columnId');
  const data = await codaApi(
    ctx,
    'GET',
    `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/columns/${encodeURIComponent(columnId)}`,
  );
  return { outputs: { column: data }, logs: [`Coda column get → ${columnId}`] };
}

// ── Formula ────────────────────────────────────────────────────────────────

async function formulaList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const data = await codaApi(ctx, 'GET', `/docs/${encodeURIComponent(docId)}/formulas`);
  return { outputs: { result: data }, logs: [`Coda formula list → ${docId}`] };
}

async function formulaGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const formulaId = requireOpt(ctx, 'formulaId');
  const data = await codaApi(
    ctx,
    'GET',
    `/docs/${encodeURIComponent(docId)}/formulas/${encodeURIComponent(formulaId)}`,
  );
  return { outputs: { formula: data }, logs: [`Coda formula get → ${formulaId}`] };
}

// ── Control ────────────────────────────────────────────────────────────────

async function controlList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const data = await codaApi(ctx, 'GET', `/docs/${encodeURIComponent(docId)}/controls`);
  return { outputs: { result: data }, logs: [`Coda control list → ${docId}`] };
}

async function controlGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const controlId = requireOpt(ctx, 'controlId');
  const data = await codaApi(
    ctx,
    'GET',
    `/docs/${encodeURIComponent(docId)}/controls/${encodeURIComponent(controlId)}`,
  );
  return { outputs: { control: data }, logs: [`Coda control get → ${controlId}`] };
}

// ── View ───────────────────────────────────────────────────────────────────

async function viewList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  // Per n8n ViewDescription, views are exposed via /tables?tableTypes=view.
  const data = await codaApi(
    ctx,
    'GET',
    `/docs/${encodeURIComponent(docId)}/tables?tableTypes=view`,
  );
  return { outputs: { result: data }, logs: [`Coda view list → ${docId}`] };
}

async function viewListRows(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = requireOpt(ctx, 'docId');
  const viewId = requireOpt(ctx, 'viewId');
  const data = await codaApi(
    ctx,
    'GET',
    `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(viewId)}/rows`,
  );
  return { outputs: { result: data }, logs: [`Coda view rows → ${viewId}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_coda',
  name: 'Coda',
  description: 'Read docs, tables, formulas, controls, views and CRUD rows in Coda.',
  iconName: 'LuFileSpreadsheet',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'coda' },
  actions: [
    // Doc
    { id: 'doc_list', label: 'List docs', description: 'List the docs accessible to the credential.',
      fields: [], run: docList },
    { id: 'doc_get', label: 'Get doc', description: 'Fetch a doc by id.',
      fields: [{ id: 'docId', label: 'Doc ID', type: 'text', required: true }], run: docGet },

    // Table
    { id: 'table_list', label: 'List tables', description: 'List tables in a doc.',
      fields: [{ id: 'docId', label: 'Doc ID', type: 'text', required: true }], run: tableList },
    { id: 'table_get', label: 'Get table', description: 'Fetch a table by id or name.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID or name', type: 'text', required: true },
      ], run: tableGet },
    { id: 'table_list_rows', label: 'List rows',
      description: 'List rows of a table (single page).',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID or name', type: 'text', required: true },
        { id: 'useColumnNames', label: 'useColumnNames (true/false)', type: 'text', defaultValue: 'true' },
      ], run: tableListRows },
    { id: 'table_list_rows_all', label: 'List all rows (paginated)',
      description: 'Walk Coda\'s nextPageLink pagination and return every row up to the cap.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID or name', type: 'text', required: true },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'useColumnNames', label: 'useColumnNames (true/false)', type: 'text', defaultValue: 'true' },
      ], run: tableListRowsAll },

    // Row
    { id: 'row_get', label: 'Get row', description: 'Fetch a single row by id or name.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID or name', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID or name', type: 'text', required: true },
        { id: 'useColumnNames', label: 'useColumnNames (true/false)', type: 'text', defaultValue: 'true' },
      ], run: rowGet },
    { id: 'row_insert', label: 'Insert row',
      description: 'Insert a single row. Cells must be `{ "Column Name": "value", … }`.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID or name', type: 'text', required: true },
        { id: 'cells', label: 'Cells (JSON object)', type: 'json', required: true },
      ], run: rowInsert },
    { id: 'row_update', label: 'Update row', description: 'Update an existing row by id or name.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID or name', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID or name', type: 'text', required: true },
        { id: 'cells', label: 'Cells (JSON object)', type: 'json', required: true },
      ], run: rowUpdate },
    { id: 'row_delete', label: 'Delete row', description: 'Delete a single row.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID or name', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID or name', type: 'text', required: true },
      ], run: rowDelete },
    { id: 'row_push_button', label: 'Push button cell',
      description: 'Click a button column on a single row.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID or name', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID or name', type: 'text', required: true },
        { id: 'columnId', label: 'Column ID (button)', type: 'text', required: true },
      ], run: rowPushButton },

    // Column
    { id: 'column_list', label: 'List columns', description: 'List columns of a table.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID or name', type: 'text', required: true },
      ], run: columnList },
    { id: 'column_get', label: 'Get column', description: 'Fetch a column by id.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID or name', type: 'text', required: true },
        { id: 'columnId', label: 'Column ID', type: 'text', required: true },
      ], run: columnGet },

    // Formula
    { id: 'formula_list', label: 'List formulas', description: 'List named formulas in a doc.',
      fields: [{ id: 'docId', label: 'Doc ID', type: 'text', required: true }], run: formulaList },
    { id: 'formula_get', label: 'Get formula', description: 'Fetch a named formula and its current value.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'formulaId', label: 'Formula ID', type: 'text', required: true },
      ], run: formulaGet },

    // Control
    { id: 'control_list', label: 'List controls', description: 'List interactive controls in a doc.',
      fields: [{ id: 'docId', label: 'Doc ID', type: 'text', required: true }], run: controlList },
    { id: 'control_get', label: 'Get control', description: 'Fetch a control and its current value.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'controlId', label: 'Control ID', type: 'text', required: true },
      ], run: controlGet },

    // View
    { id: 'view_list', label: 'List views', description: 'List view-type tables in a doc.',
      fields: [{ id: 'docId', label: 'Doc ID', type: 'text', required: true }], run: viewList },
    { id: 'view_list_rows', label: 'List view rows', description: 'List rows of a view.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'viewId', label: 'View ID', type: 'text', required: true },
      ], run: viewListRows },
  ],
};

registerForgeBlock(block);
export default block;
