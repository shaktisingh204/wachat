/**
 * Forge block: Baserow
 *
 * Source: n8n-master/packages/nodes-base/nodes/Baserow/Baserow.node.ts
 * Credential type: 'baserow' — fields: { baseUrl, apiToken }
 *
 * Operations covered (row resource, table-scoped):
 *   - row.list     GET    /api/database/rows/table/{tableId}/
 *   - row.get      GET    /api/database/rows/table/{tableId}/{rowId}/
 *   - row.create   POST   /api/database/rows/table/{tableId}/
 *   - row.update   PATCH  /api/database/rows/table/{tableId}/{rowId}/
 *   - row.delete   DELETE /api/database/rows/table/{tableId}/{rowId}/
 *
 * Out of scope:
 *   - LoadOptions for table picker
 *   - user_field_names query toggle (uses Baserow default: column-id keys)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

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

function parseJsonObject(label: string, raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) throw new Error(`Baserow: ${label} is required`);
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error(`Baserow: ${label} must be a JSON object`);
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
  const fields = parseJsonObject('fields', ctx.options.fields);
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
  const fields = parseJsonObject('fields', ctx.options.fields);
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

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_baserow',
  name: 'Baserow',
  description: 'CRUD rows inside a Baserow table.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'baserow' },
  actions: [
    {
      id: 'row_list',
      label: 'List rows',
      description: 'List rows in a table.',
      fields: [
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
      ],
      run: rowList,
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
  ],
};

registerForgeBlock(block);
export default block;
