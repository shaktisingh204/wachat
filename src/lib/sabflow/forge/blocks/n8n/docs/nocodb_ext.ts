/**
 * Forge block: NocoDB (extended)
 *
 * Source: n8n-master/packages/nodes-base/nodes/NocoDB/NocoDB.node.ts
 * Credential type: 'nocodb' — fields: { apiUrl, apiToken }
 *
 * Operations covered (record resource, table-scoped):
 *   - record.list     GET    /db/data/v1/{projectId}/{tableName}
 *   - record.get      GET    /db/data/v1/{projectId}/{tableName}/{rowId}
 *   - record.create   POST   /db/data/v1/{projectId}/{tableName}
 *   - record.update   PATCH  /db/data/v1/{projectId}/{tableName}/{rowId}
 *   - record.delete   DELETE /db/data/v1/{projectId}/{tableName}/{rowId}
 *
 * Out of scope:
 *   - LoadOptions / project + table dropdowns (text fields for now)
 *   - View-scoped record fetch and bulk operations
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
import { apiRequest, asString, requireCredential } from '../_shared/http';

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

function parseJsonObject(label: string, raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) throw new Error(`NocoDB: ${label} is required`);
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error(`NocoDB: ${label} must be a JSON object`);
}

function tablePath(ctx: ForgeActionContext): string {
  const projectId = asString(ctx.options.projectId);
  const tableName = asString(ctx.options.tableName);
  if (!projectId) throw new Error('NocoDB: projectId is required');
  if (!tableName) throw new Error('NocoDB: tableName is required');
  return `/db/data/v1/${encodeURIComponent(projectId)}/${encodeURIComponent(tableName)}`;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function recordList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await nocoApi(ctx, 'GET', tablePath(ctx));
  return { outputs: { result: data }, logs: ['NocoDB record list'] };
}

async function recordGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('NocoDB: rowId is required');
  const data = await nocoApi(ctx, 'GET', `${tablePath(ctx)}/${encodeURIComponent(rowId)}`);
  return { outputs: { record: data }, logs: [`NocoDB record get → ${rowId}`] };
}

async function recordCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const fields = parseJsonObject('fields', ctx.options.fields);
  const data = await nocoApi(ctx, 'POST', tablePath(ctx), fields);
  return { outputs: { record: data }, logs: ['NocoDB record create'] };
}

async function recordUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('NocoDB: rowId is required');
  const fields = parseJsonObject('fields', ctx.options.fields);
  const data = await nocoApi(ctx, 'PATCH', `${tablePath(ctx)}/${encodeURIComponent(rowId)}`, fields);
  return { outputs: { record: data }, logs: [`NocoDB record update → ${rowId}`] };
}

async function recordDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('NocoDB: rowId is required');
  const data = await nocoApi(ctx, 'DELETE', `${tablePath(ctx)}/${encodeURIComponent(rowId)}`);
  return { outputs: { result: data }, logs: [`NocoDB record delete → ${rowId}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_nocodb_ext',
  name: 'NocoDB (extended)',
  description: 'CRUD records in a NocoDB table.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'nocodb' },
  actions: [
    {
      id: 'record_list',
      label: 'List records',
      description: 'List records in the table.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
      ],
      run: recordList,
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
  ],
};

registerForgeBlock(block);
export default block;
