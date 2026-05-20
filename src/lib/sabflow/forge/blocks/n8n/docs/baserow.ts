/**
 * Forge block: Baserow
 *
 * Source: n8n-master/packages/nodes-base/nodes/Baserow/Baserow.node.ts
 * Credential type: 'baserow' — fields: { baseUrl, apiToken }
 *
 * Operations covered (row resource, table-scoped):
 *   - row.list          GET    /api/database/rows/table/{tableId}/
 *   - row.list_all      GET    /api/database/rows/table/{tableId}/  (paginated)
 *   - row.get           GET    /api/database/rows/table/{tableId}/{rowId}/
 *   - row.create        POST   /api/database/rows/table/{tableId}/
 *   - row.update        PATCH  /api/database/rows/table/{tableId}/{rowId}/
 *   - row.delete        DELETE /api/database/rows/table/{tableId}/{rowId}/
 *   - row.batch_create  POST   /api/database/rows/table/{tableId}/batch/
 *   - row.batch_update  PATCH  /api/database/rows/table/{tableId}/batch/
 *   - row.batch_delete  POST   /api/database/rows/table/{tableId}/batch-delete/
 *
 * Out of scope:
 *   - LoadOptions for table picker
 *   - user_field_names query toggle (uses Baserow default: column-id keys)
 *   - List database/tables/fields metadata endpoints
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { parseJsonArray, parseJsonObject } from '../_shared/json';
import { paginateAll } from '../_shared/paginate';

function getBase(ctx: ForgeActionContext): { url: string; token: string } {
  const cred = requireCredential('Baserow', ctx.credential);
  const baseUrl = (cred.baseUrl || 'https://api.baserow.io').replace(/\/+$/, '');
  const token = cred.apiToken ?? cred.accessToken;
  if (!token) throw new Error('Baserow: credential is missing `apiToken`');
  return { url: baseUrl, token };
}

async function baserowApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { url, token } = getBase(ctx);
  const res = await apiRequest({
    service: 'Baserow',
    method,
    url: `${url}${path}`,
    headers: { Authorization: `Token ${token}` },
    json,
  });
  return res.data;
}

function tableId(ctx: ForgeActionContext): string {
  const id = asString(ctx.options.tableId);
  if (!id) throw new Error('Baserow: tableId is required');
  return id;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function rowList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = tableId(ctx);
  const data = await baserowApi(ctx, 'GET', `/api/database/rows/table/${encodeURIComponent(id)}/`);
  return { outputs: { result: data }, logs: [`Baserow row list → ${id}`] };
}

async function rowListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = tableId(ctx);
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const { url, token } = getBase(ctx);
  const endpoint = `${url}/api/database/rows/table/${encodeURIComponent(id)}/`;
  const search = asString(ctx.options.search);

  const rows = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const u = new URL(endpoint);
      u.searchParams.set('page', cursor ?? '1');
      u.searchParams.set('size', '100');
      if (search) u.searchParams.set('search', search);
      const res = await apiRequest({
        service: 'Baserow',
        method: 'GET',
        url: u.toString(),
        headers: { Authorization: `Token ${token}` },
      });
      const body = res.data as { results?: unknown[]; next?: string | null } | null;
      const items = (body?.results ?? []) as unknown[];
      const nextCursor = body?.next ? String(Number(cursor ?? '1') + 1) : undefined;
      return { items, nextCursor };
    },
  });

  return { outputs: { rows, count: rows.length }, logs: [`Baserow row list all → ${rows.length}`] };
}

async function rowGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = tableId(ctx);
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('Baserow: rowId is required');
  const data = await baserowApi(
    ctx,
    'GET',
    `/api/database/rows/table/${encodeURIComponent(id)}/${encodeURIComponent(rowId)}/`,
  );
  return { outputs: { row: data }, logs: [`Baserow row get → ${rowId}`] };
}

async function rowCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = tableId(ctx);
  const fields = parseJsonObject(ctx.options.fields, 'Baserow: fields');
  if (Object.keys(fields).length === 0) throw new Error('Baserow: fields is required');
  const data = await baserowApi(
    ctx,
    'POST',
    `/api/database/rows/table/${encodeURIComponent(id)}/`,
    fields,
  );
  return { outputs: { row: data }, logs: [`Baserow row create → ${id}`] };
}

async function rowUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = tableId(ctx);
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('Baserow: rowId is required');
  const fields = parseJsonObject(ctx.options.fields, 'Baserow: fields');
  if (Object.keys(fields).length === 0) throw new Error('Baserow: fields is required');
  const data = await baserowApi(
    ctx,
    'PATCH',
    `/api/database/rows/table/${encodeURIComponent(id)}/${encodeURIComponent(rowId)}/`,
    fields,
  );
  return { outputs: { row: data }, logs: [`Baserow row update → ${rowId}`] };
}

async function rowDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = tableId(ctx);
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('Baserow: rowId is required');
  const data = await baserowApi(
    ctx,
    'DELETE',
    `/api/database/rows/table/${encodeURIComponent(id)}/${encodeURIComponent(rowId)}/`,
  );
  return { outputs: { result: data }, logs: [`Baserow row delete → ${rowId}`] };
}

async function rowBatchCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = tableId(ctx);
  const items = parseJsonArray<Record<string, unknown>>(ctx.options.items, 'Baserow: items');
  if (items.length === 0) throw new Error('Baserow: items must be a non-empty JSON array');
  const data = await baserowApi(
    ctx,
    'POST',
    `/api/database/rows/table/${encodeURIComponent(id)}/batch/`,
    { items },
  );
  return { outputs: { result: data }, logs: [`Baserow row batch create → ${items.length}`] };
}

async function rowBatchUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = tableId(ctx);
  // Each item must already have an `id` (per Baserow batch_update_database_table_rows).
  const items = parseJsonArray<Record<string, unknown>>(ctx.options.items, 'Baserow: items');
  if (items.length === 0) throw new Error('Baserow: items must be a non-empty JSON array');
  const data = await baserowApi(
    ctx,
    'PATCH',
    `/api/database/rows/table/${encodeURIComponent(id)}/batch/`,
    { items },
  );
  return { outputs: { result: data }, logs: [`Baserow row batch update → ${items.length}`] };
}

async function rowBatchDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = tableId(ctx);
  const ids = parseJsonArray<number>(ctx.options.ids, 'Baserow: ids');
  if (ids.length === 0) throw new Error('Baserow: ids must be a non-empty JSON array of row ids');
  const data = await baserowApi(
    ctx,
    'POST',
    `/api/database/rows/table/${encodeURIComponent(id)}/batch-delete/`,
    { items: ids },
  );
  return { outputs: { result: data }, logs: [`Baserow row batch delete → ${ids.length}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_baserow',
  name: 'Baserow',
  description: 'CRUD + batch operations on Baserow table rows, with paginated list.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'baserow' },
  actions: [
    {
      id: 'row_list',
      label: 'List rows',
      description: 'List one page of rows in a table.',
      fields: [
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
      ],
      run: rowList,
    },
    {
      id: 'row_list_all',
      label: 'List all rows (paginated)',
      description: 'Walk Baserow\'s page/size pagination and return every row up to the cap.',
      fields: [
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'search', label: 'Search term (optional)', type: 'text' },
      ],
      run: rowListAll,
    },
    {
      id: 'row_get',
      label: 'Get row',
      description: 'Fetch a single row by id.',
      fields: [
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID', type: 'text', required: true },
      ],
      run: rowGet,
    },
    {
      id: 'row_create',
      label: 'Create row',
      description: 'Create a new row. Fields keyed by field_<id> by default.',
      fields: [
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'fields', label: 'Fields (JSON)', type: 'json', required: true },
      ],
      run: rowCreate,
    },
    {
      id: 'row_update',
      label: 'Update row',
      description: 'Patch an existing row.',
      fields: [
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID', type: 'text', required: true },
        { id: 'fields', label: 'Fields (JSON)', type: 'json', required: true },
      ],
      run: rowUpdate,
    },
    {
      id: 'row_delete',
      label: 'Delete row',
      description: 'Permanently delete a row.',
      fields: [
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID', type: 'text', required: true },
      ],
      run: rowDelete,
    },
    {
      id: 'row_batch_create',
      label: 'Batch create rows',
      description: 'Create many rows in a single request. items is a JSON array of row objects.',
      fields: [
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'items', label: 'Items (JSON array of row objects)', type: 'json', required: true },
      ],
      run: rowBatchCreate,
    },
    {
      id: 'row_batch_update',
      label: 'Batch update rows',
      description: 'Patch many rows in a single request. Each item must include `id`.',
      fields: [
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'items', label: 'Items (JSON array, each with id)', type: 'json', required: true },
      ],
      run: rowBatchUpdate,
    },
    {
      id: 'row_batch_delete',
      label: 'Batch delete rows',
      description: 'Delete many rows by id. ids is a JSON array of numeric row ids.',
      fields: [
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'ids', label: 'Row IDs (JSON array of numbers)', type: 'json', required: true },
      ],
      run: rowBatchDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
