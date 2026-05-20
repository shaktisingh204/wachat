/**
 * Forge block: Grist
 *
 * Source: n8n-master/packages/nodes-base/nodes/Grist/Grist.node.ts
 * Credential type: 'grist' — fields: { baseUrl, apiKey }
 *
 * Operations covered (record + metadata):
 *   - record.list           GET    /api/docs/{docId}/tables/{tableId}/records
 *   - record.list_with_opts GET    /api/docs/{docId}/tables/{tableId}/records?sort=…&filter=…&limit=…
 *   - record.get            GET    /api/docs/{docId}/tables/{tableId}/records?filter=…
 *   - record.create         POST   /api/docs/{docId}/tables/{tableId}/records
 *   - record.update         PATCH  /api/docs/{docId}/tables/{tableId}/records
 *   - record.delete         POST   /api/docs/{docId}/tables/{tableId}/data/delete
 *   - record.bulk_create    POST   /api/docs/{docId}/tables/{tableId}/records  (array of records)
 *   - record.bulk_update    PATCH  /api/docs/{docId}/tables/{tableId}/records  (array of records)
 *   - record.bulk_delete    POST   /api/docs/{docId}/tables/{tableId}/data/delete (array of ids)
 *   - column.list           GET    /api/docs/{docId}/tables/{tableId}/columns
 *   - org.list              GET    /api/orgs
 *
 * Out of scope:
 *   - LoadOptions for docs / tables
 *   - Workspaces / users metadata endpoints (not used by core Grist node)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { parseJsonArray, parseJsonObject } from '../_shared/json';

function getBase(ctx: ForgeActionContext): { url: string; key: string } {
  const cred = requireCredential('Grist', ctx.credential);
  const baseUrl = (cred.baseUrl || 'https://docs.getgrist.com').replace(/\/+$/, '');
  const key = cred.apiKey ?? cred.accessToken;
  if (!key) throw new Error('Grist: credential is missing `apiKey`');
  return { url: baseUrl, key };
}

async function gristApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { url, key } = getBase(ctx);
  const res = await apiRequest({
    service: 'Grist',
    method,
    url: `${url}${path}`,
    headers: { Authorization: `Bearer ${key}` },
    json,
  });
  return res.data;
}

function recordsPath(ctx: ForgeActionContext): string {
  const docId = asString(ctx.options.docId);
  const tableId = asString(ctx.options.tableId);
  if (!docId) throw new Error('Grist: docId is required');
  if (!tableId) throw new Error('Grist: tableId is required');
  return `/api/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/records`;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function recordList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await gristApi(ctx, 'GET', recordsPath(ctx));
  return { outputs: { result: data }, logs: ['Grist record list'] };
}

async function recordListWithOpts(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sort = asString(ctx.options.sort);
  const filterRaw = asString(ctx.options.filter).trim();
  const limit = asNumber(ctx.options.limit);
  const parts: string[] = [];
  if (sort) parts.push(`sort=${encodeURIComponent(sort)}`);
  if (filterRaw) {
    // Per Grist docs, `filter` must be a JSON string of column → array-of-values.
    parts.push(`filter=${encodeURIComponent(filterRaw)}`);
  }
  if (limit !== undefined) parts.push(`limit=${limit}`);
  const qs = parts.length ? `?${parts.join('&')}` : '';
  const data = await gristApi(ctx, 'GET', `${recordsPath(ctx)}${qs}`);
  return { outputs: { result: data }, logs: ['Grist record list with options'] };
}

async function recordGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const recordId = asString(ctx.options.recordId);
  if (!recordId) throw new Error('Grist: recordId is required');
  const filter = encodeURIComponent(JSON.stringify({ id: [Number(recordId)] }));
  const data = await gristApi(ctx, 'GET', `${recordsPath(ctx)}?filter=${filter}`);
  return { outputs: { result: data }, logs: [`Grist record get → ${recordId}`] };
}

async function recordCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const fields = parseJsonObject(ctx.options.fields, 'Grist: fields');
  if (Object.keys(fields).length === 0) throw new Error('Grist: fields is required');
  const body = { records: [{ fields }] };
  const data = await gristApi(ctx, 'POST', recordsPath(ctx), body);
  return { outputs: { result: data }, logs: ['Grist record create'] };
}

async function recordUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const recordId = asString(ctx.options.recordId);
  if (!recordId) throw new Error('Grist: recordId is required');
  const fields = parseJsonObject(ctx.options.fields, 'Grist: fields');
  if (Object.keys(fields).length === 0) throw new Error('Grist: fields is required');
  const body = { records: [{ id: Number(recordId), fields }] };
  const data = await gristApi(ctx, 'PATCH', recordsPath(ctx), body);
  return { outputs: { result: data }, logs: [`Grist record update → ${recordId}`] };
}

async function recordDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = asString(ctx.options.docId);
  const tableId = asString(ctx.options.tableId);
  const recordId = asString(ctx.options.recordId);
  if (!docId) throw new Error('Grist: docId is required');
  if (!tableId) throw new Error('Grist: tableId is required');
  if (!recordId) throw new Error('Grist: recordId is required');
  const body = [Number(recordId)];
  const data = await gristApi(
    ctx,
    'POST',
    `/api/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/data/delete`,
    body,
  );
  return { outputs: { result: data }, logs: [`Grist record delete → ${recordId}`] };
}

async function recordBulkCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const items = parseJsonArray<Record<string, unknown>>(ctx.options.items, 'Grist: items');
  if (items.length === 0) throw new Error('Grist: items must be a non-empty JSON array');
  const records = items.map((fields) => ({ fields }));
  const data = await gristApi(ctx, 'POST', recordsPath(ctx), { records });
  return { outputs: { result: data }, logs: [`Grist bulk create → ${items.length}`] };
}

async function recordBulkUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  // Each item must contain { id, fields }.
  const items = parseJsonArray<{ id: number; fields: Record<string, unknown> }>(
    ctx.options.items,
    'Grist: items',
  );
  if (items.length === 0) throw new Error('Grist: items must be a non-empty JSON array');
  const data = await gristApi(ctx, 'PATCH', recordsPath(ctx), { records: items });
  return { outputs: { result: data }, logs: [`Grist bulk update → ${items.length}`] };
}

async function recordBulkDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = asString(ctx.options.docId);
  const tableId = asString(ctx.options.tableId);
  if (!docId) throw new Error('Grist: docId is required');
  if (!tableId) throw new Error('Grist: tableId is required');
  const ids = parseJsonArray<number>(ctx.options.ids, 'Grist: ids');
  if (ids.length === 0) throw new Error('Grist: ids must be a non-empty JSON array of numbers');
  const data = await gristApi(
    ctx,
    'POST',
    `/api/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/data/delete`,
    ids,
  );
  return { outputs: { result: data }, logs: [`Grist bulk delete → ${ids.length}`] };
}

async function columnList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const docId = asString(ctx.options.docId);
  const tableId = asString(ctx.options.tableId);
  if (!docId) throw new Error('Grist: docId is required');
  if (!tableId) throw new Error('Grist: tableId is required');
  const data = await gristApi(
    ctx,
    'GET',
    `/api/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/columns`,
  );
  return { outputs: { result: data }, logs: ['Grist column list'] };
}

async function orgList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await gristApi(ctx, 'GET', '/api/orgs');
  return { outputs: { result: data }, logs: ['Grist org list'] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_grist',
  name: 'Grist',
  description: 'CRUD records, columns and orgs in a Grist document, with bulk operations.',
  iconName: 'LuTable',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'grist' },
  actions: [
    {
      id: 'record_list',
      label: 'List records',
      description: 'List records in a table.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
      ],
      run: recordList,
    },
    {
      id: 'record_list_with_opts',
      label: 'List records (sort/filter/limit)',
      description: 'List records with optional sort, filter and limit query strings.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'sort', label: 'Sort (comma list, prefix - for desc)', type: 'text', placeholder: '-Updated_At,Name' },
        { id: 'filter', label: 'Filter (JSON: column → array of values)', type: 'json' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: recordListWithOpts,
    },
    {
      id: 'record_get',
      label: 'Get record',
      description: 'Fetch a single record by numeric id.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'recordId', label: 'Record ID', type: 'number', required: true },
      ],
      run: recordGet,
    },
    {
      id: 'record_create',
      label: 'Create record',
      description: 'Create a new record. Fields is a JSON object of column → value.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'fields', label: 'Fields (JSON)', type: 'json', required: true },
      ],
      run: recordCreate,
    },
    {
      id: 'record_update',
      label: 'Update record',
      description: 'Patch an existing record.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'recordId', label: 'Record ID', type: 'number', required: true },
        { id: 'fields', label: 'Fields (JSON)', type: 'json', required: true },
      ],
      run: recordUpdate,
    },
    {
      id: 'record_delete',
      label: 'Delete record',
      description: 'Permanently delete a record.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'recordId', label: 'Record ID', type: 'number', required: true },
      ],
      run: recordDelete,
    },
    {
      id: 'record_bulk_create',
      label: 'Bulk create records',
      description: 'Create many records at once. items is a JSON array of field objects.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'items', label: 'Items (JSON array of field objects)', type: 'json', required: true },
      ],
      run: recordBulkCreate,
    },
    {
      id: 'record_bulk_update',
      label: 'Bulk update records',
      description: 'Patch many records at once. items is a JSON array of { id, fields }.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'items', label: 'Items (JSON array of {id, fields})', type: 'json', required: true },
      ],
      run: recordBulkUpdate,
    },
    {
      id: 'record_bulk_delete',
      label: 'Bulk delete records',
      description: 'Delete many records by id. ids is a JSON array of numbers.',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'ids', label: 'Record IDs (JSON array of numbers)', type: 'json', required: true },
      ],
      run: recordBulkDelete,
    },
    {
      id: 'column_list',
      label: 'List columns',
      description: 'List columns of a table (schema metadata).',
      fields: [
        { id: 'docId', label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
      ],
      run: columnList,
    },
    {
      id: 'org_list',
      label: 'List organizations',
      description: 'List Grist organizations visible to the credential.',
      fields: [],
      run: orgList,
    },
  ],
};

registerForgeBlock(block);
export default block;
