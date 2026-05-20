/**
 * Forge block: NocoDB (extended)
 *
 * Source: n8n-master/packages/nodes-base/nodes/NocoDB/NocoDB.node.ts
 * Credential type: 'nocodb' — fields: { apiUrl, apiToken }
 *
 * Operations covered (record resource, table-scoped):
 *   - record.list         GET    /db/data/v1/{projectId}/{tableName}
 *   - record.list_all     GET    /db/data/v1/{projectId}/{tableName} (paginated via offset/limit + pageInfo.isLastPage)
 *   - record.get          GET    /db/data/v1/{projectId}/{tableName}/{rowId}
 *   - record.create       POST   /db/data/v1/{projectId}/{tableName}
 *   - record.update       PATCH  /db/data/v1/{projectId}/{tableName}/{rowId}
 *   - record.delete       DELETE /db/data/v1/{projectId}/{tableName}/{rowId}
 *   - record.bulk_create  POST   /db/data/bulk/v1/{projectId}/{tableName}
 *   - record.bulk_update  PATCH  /db/data/bulk/v1/{projectId}/{tableName}
 *   - record.bulk_delete  DELETE /db/data/bulk/v1/{projectId}/{tableName}
 *   - record.list_by_view GET    /db/data/v1/{projectId}/{tableName}/views/{viewId}
 *
 * Out of scope:
 *   - LoadOptions / project + table dropdowns (text fields for now)
 *   - Workspace + base metadata endpoints (different per NocoDB version)
 *
 * NOTE: NocoDB API path layout differs between v1 (`/db/data/v1/{project}/{table}`)
 * and v2 (`/api/v2/tables/{tableId}/records`). This port targets v1; v2 users
 * should set `apiUrl` to the v2 base and the same handler will still work
 * because the path layout is composed from the `projectId` and `tableName`
 * fields. For pure v2 set projectId to "tables" and tableName to "{tableId}/records".
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
  const cred = requireCredential('NocoDB', ctx.credential);
  const apiUrl = (cred.apiUrl || '').replace(/\/+$/, '');
  const token = cred.apiToken ?? cred.accessToken;
  if (!apiUrl) throw new Error('NocoDB: credential is missing `apiUrl`');
  if (!token) throw new Error('NocoDB: credential is missing `apiToken`');
  return { url: apiUrl, token };
}

async function nocoApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { url, token } = getBase(ctx);
  const res = await apiRequest({
    service: 'NocoDB',
    method,
    url: `${url}${path}`,
    headers: { 'xc-token': token },
    json,
  });
  return res.data;
}

function tablePath(ctx: ForgeActionContext): string {
  const projectId = asString(ctx.options.projectId);
  const tableName = asString(ctx.options.tableName);
  if (!projectId) throw new Error('NocoDB: projectId is required');
  if (!tableName) throw new Error('NocoDB: tableName is required');
  return `/db/data/v1/${encodeURIComponent(projectId)}/${encodeURIComponent(tableName)}`;
}

function bulkPath(ctx: ForgeActionContext): string {
  const projectId = asString(ctx.options.projectId);
  const tableName = asString(ctx.options.tableName);
  if (!projectId) throw new Error('NocoDB: projectId is required');
  if (!tableName) throw new Error('NocoDB: tableName is required');
  return `/db/data/bulk/v1/${encodeURIComponent(projectId)}/${encodeURIComponent(tableName)}`;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function recordList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await nocoApi(ctx, 'GET', tablePath(ctx));
  return { outputs: { result: data }, logs: ['NocoDB record list'] };
}

async function recordListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const { url, token } = getBase(ctx);
  const base = `${url}${tablePath(ctx)}`;

  const records = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const offset = cursor ?? '0';
      const u = new URL(base);
      u.searchParams.set('limit', '100');
      u.searchParams.set('offset', offset);
      const res = await apiRequest({
        service: 'NocoDB',
        method: 'GET',
        url: u.toString(),
        headers: { 'xc-token': token },
      });
      // NocoDB v2 wraps in {list, pageInfo}; v1 returns a raw array. Handle both.
      const body = res.data as
        | { list?: unknown[]; pageInfo?: { isLastPage?: boolean } }
        | unknown[]
        | null;
      let items: unknown[];
      let nextCursor: string | undefined;
      if (Array.isArray(body)) {
        items = body;
        nextCursor = body.length === 0 ? undefined : String(Number(offset) + 100);
      } else if (body && Array.isArray(body.list)) {
        items = body.list;
        nextCursor = body.pageInfo?.isLastPage ? undefined : String(Number(offset) + 100);
      } else {
        items = [];
        nextCursor = undefined;
      }
      return { items, nextCursor };
    },
  });

  return { outputs: { records, count: records.length }, logs: [`NocoDB record list all → ${records.length}`] };
}

async function recordListByView(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const viewId = asString(ctx.options.viewId);
  if (!viewId) throw new Error('NocoDB: viewId is required');
  const data = await nocoApi(ctx, 'GET', `${tablePath(ctx)}/views/${encodeURIComponent(viewId)}`);
  return { outputs: { result: data }, logs: [`NocoDB record list by view → ${viewId}`] };
}

async function recordGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('NocoDB: rowId is required');
  const data = await nocoApi(ctx, 'GET', `${tablePath(ctx)}/${encodeURIComponent(rowId)}`);
  return { outputs: { record: data }, logs: [`NocoDB record get → ${rowId}`] };
}

async function recordCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const fields = parseJsonObject(ctx.options.fields, 'NocoDB: fields');
  if (Object.keys(fields).length === 0) throw new Error('NocoDB: fields is required');
  const data = await nocoApi(ctx, 'POST', tablePath(ctx), fields);
  return { outputs: { record: data }, logs: ['NocoDB record create'] };
}

async function recordUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('NocoDB: rowId is required');
  const fields = parseJsonObject(ctx.options.fields, 'NocoDB: fields');
  if (Object.keys(fields).length === 0) throw new Error('NocoDB: fields is required');
  const data = await nocoApi(ctx, 'PATCH', `${tablePath(ctx)}/${encodeURIComponent(rowId)}`, fields);
  return { outputs: { record: data }, logs: [`NocoDB record update → ${rowId}`] };
}

async function recordDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('NocoDB: rowId is required');
  const data = await nocoApi(ctx, 'DELETE', `${tablePath(ctx)}/${encodeURIComponent(rowId)}`);
  return { outputs: { result: data }, logs: [`NocoDB record delete → ${rowId}`] };
}

async function recordBulkCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const items = parseJsonArray<Record<string, unknown>>(ctx.options.items, 'NocoDB: items');
  if (items.length === 0) throw new Error('NocoDB: items must be a non-empty JSON array');
  const data = await nocoApi(ctx, 'POST', bulkPath(ctx), items);
  return { outputs: { result: data }, logs: [`NocoDB bulk create → ${items.length}`] };
}

async function recordBulkUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  // Each item must already contain its primary-key column.
  const items = parseJsonArray<Record<string, unknown>>(ctx.options.items, 'NocoDB: items');
  if (items.length === 0) throw new Error('NocoDB: items must be a non-empty JSON array');
  const data = await nocoApi(ctx, 'PATCH', bulkPath(ctx), items);
  return { outputs: { result: data }, logs: [`NocoDB bulk update → ${items.length}`] };
}

async function recordBulkDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const items = parseJsonArray<Record<string, unknown>>(ctx.options.items, 'NocoDB: items');
  if (items.length === 0) throw new Error('NocoDB: items must be a non-empty JSON array');
  const data = await nocoApi(ctx, 'DELETE', bulkPath(ctx), items);
  return { outputs: { result: data }, logs: [`NocoDB bulk delete → ${items.length}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_nocodb_ext',
  name: 'NocoDB (extended)',
  description: 'CRUD + bulk + view-scoped record operations in a NocoDB table.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'nocodb' },
  actions: [
    {
      id: 'record_list',
      label: 'List records',
      description: 'List records in the table (single page).',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
      ],
      run: recordList,
    },
    {
      id: 'record_list_all',
      label: 'List all records (paginated)',
      description: 'Walk NocoDB\'s offset/limit pagination and return every record up to the cap.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
      ],
      run: recordListAll,
    },
    {
      id: 'record_list_by_view',
      label: 'List records by view',
      description: 'List records filtered by a specific view id.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'viewId', label: 'View ID', type: 'text', required: true },
      ],
      run: recordListByView,
    },
    {
      id: 'record_get',
      label: 'Get record',
      description: 'Fetch a single record by id.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID', type: 'text', required: true },
      ],
      run: recordGet,
    },
    {
      id: 'record_create',
      label: 'Create record',
      description: 'Create a record. Fields is a JSON object of column → value.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'fields', label: 'Fields (JSON)', type: 'json', required: true },
      ],
      run: recordCreate,
    },
    {
      id: 'record_update',
      label: 'Update record',
      description: 'Patch an existing record.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID', type: 'text', required: true },
        { id: 'fields', label: 'Fields (JSON)', type: 'json', required: true },
      ],
      run: recordUpdate,
    },
    {
      id: 'record_delete',
      label: 'Delete record',
      description: 'Permanently delete a record.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID', type: 'text', required: true },
      ],
      run: recordDelete,
    },
    {
      id: 'record_bulk_create',
      label: 'Bulk create records',
      description: 'Create many records in one request. items is a JSON array of field objects.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'items', label: 'Items (JSON array of field objects)', type: 'json', required: true },
      ],
      run: recordBulkCreate,
    },
    {
      id: 'record_bulk_update',
      label: 'Bulk update records',
      description: 'Patch many records in one request. Each item must include its primary-key column.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'items', label: 'Items (JSON array, each with PK)', type: 'json', required: true },
      ],
      run: recordBulkUpdate,
    },
    {
      id: 'record_bulk_delete',
      label: 'Bulk delete records',
      description: 'Delete many records in one request. items is a JSON array of {pk} objects.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'items', label: 'Items (JSON array of {pk})', type: 'json', required: true },
      ],
      run: recordBulkDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
