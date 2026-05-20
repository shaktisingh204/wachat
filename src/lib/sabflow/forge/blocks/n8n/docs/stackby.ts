/**
 * Forge block: Stackby
 *
 * Source: n8n-master/packages/nodes-base/nodes/Stackby/Stackby.node.ts
 * Credential type: 'stackby' — fields: { apiKey }
 *
 * Operations covered (row resource):
 *   - row.list     GET    /rowlist/{stackId}/{tableName}        (optional ?view= filter)
 *   - row.create   POST   /rowcreate/{stackId}/{tableName}
 *   - row.update   POST   /rowupdate/{stackId}/{tableName}
 *   - row.delete   DELETE /rowdelete/{stackId}/{tableName}?rowIds[]={id}
 *
 * Out of scope:
 *   - LoadOptions / stack + table dropdowns
 *   - Bulk-row payloads (single-row only)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://stackby.com/api/betav1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Stackby', ctx.credential);
  const apiKey = cred.apiKey ?? cred.accessToken;
  if (!apiKey) throw new Error('Stackby: credential is missing `apiKey`');
  return { 'api-key': apiKey };
}

async function stackbyApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Stackby',
    method,
    url: `${BASE}${path}`,
    headers: authHeaders(ctx),
    json,
  });
  return res.data;
}

function parseJsonObject(label: string, raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) throw new Error(`Stackby: ${label} is required`);
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error(`Stackby: ${label} must be a JSON object`);
}

function tablePath(ctx: ForgeActionContext, op: 'rowlist' | 'rowcreate' | 'rowupdate' | 'rowdelete'): string {
  const stackId = asString(ctx.options.stackId);
  const tableName = asString(ctx.options.tableName);
  if (!stackId) throw new Error('Stackby: stackId is required');
  if (!tableName) throw new Error('Stackby: tableName is required');
  return `/${op}/${encodeURIComponent(stackId)}/${encodeURIComponent(tableName)}`;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function rowList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const view = asString(ctx.options.view);
  const qs = view ? `?view=${encodeURIComponent(view)}` : '';
  const data = await stackbyApi(ctx, 'GET', `${tablePath(ctx, 'rowlist')}${qs}`);
  return { outputs: { result: data }, logs: ['Stackby row list'] };
}

async function rowCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const fields = parseJsonObject('fields', ctx.options.fields);
  const body = { records: [{ field: fields }] };
  const data = await stackbyApi(ctx, 'POST', tablePath(ctx, 'rowcreate'), body);
  return { outputs: { result: data }, logs: ['Stackby row create'] };
}

async function rowUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('Stackby: rowId is required');
  const fields = parseJsonObject('fields', ctx.options.fields);
  const body = { records: [{ id: rowId, field: fields }] };
  const data = await stackbyApi(ctx, 'POST', tablePath(ctx, 'rowupdate'), body);
  return { outputs: { result: data }, logs: [`Stackby row update → ${rowId}`] };
}

async function rowDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('Stackby: rowId is required');
  const path = `${tablePath(ctx, 'rowdelete')}?rowIds[]=${encodeURIComponent(rowId)}`;
  const data = await stackbyApi(ctx, 'DELETE', path);
  return { outputs: { result: data }, logs: [`Stackby row delete → ${rowId}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_stackby',
  name: 'Stackby',
  description: 'CRUD rows inside a Stackby table.',
  iconName: 'LuTable',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'stackby' },
  actions: [
    {
      id: 'row_list',
      label: 'List rows',
      description: 'List rows in a table. Optionally restrict to a saved view.',
      fields: [
        { id: 'stackId', label: 'Stack ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'view', label: 'View name or ID (optional)', type: 'text', placeholder: 'All Stories' },
      ],
      run: rowList,
    },
    {
      id: 'row_create',
      label: 'Create row',
      description: 'Create a row. Fields is a JSON object of column → value.',
      fields: [
        { id: 'stackId', label: 'Stack ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'fields', label: 'Fields (JSON)', type: 'json', required: true },
      ],
      run: rowCreate,
    },
    {
      id: 'row_update',
      label: 'Update row',
      description: 'Patch an existing row.',
      fields: [
        { id: 'stackId', label: 'Stack ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
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
        { id: 'stackId', label: 'Stack ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID', type: 'text', required: true },
      ],
      run: rowDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
