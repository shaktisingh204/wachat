/**
 * Forge block: SeaTable
 *
 * Source: n8n-master/packages/nodes-base/nodes/SeaTable/SeaTable.node.ts
 * Credential type: 'seatable' — fields: { baseUrl, apiToken }
 *
 * SeaTable auth flow: the base API token is exchanged for a per-base
 * `access_token` + `dtable_uuid` + `dtable_server` via
 *   GET {baseUrl}/api/v2.1/dtable/app-access-token/
 * That access token is then used against the dtable server endpoints.
 *
 * Operations covered (row resource):
 *   - row.list     GET    {server}/api/v1/dtables/{uuid}/rows/?table_name={t}
 *   - row.get      GET    {server}/api/v1/dtables/{uuid}/rows/{rowId}/?table_name={t}
 *   - row.create   POST   {server}/api/v1/dtables/{uuid}/rows/
 *   - row.update   PUT    {server}/api/v1/dtables/{uuid}/rows/
 *   - row.delete   DELETE {server}/api/v1/dtables/{uuid}/rows/
 *
 * Out of scope:
 *   - LoadOptions for table picker
 *   - Linked-record column resolution
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

type SeaTableSession = {
  accessToken: string;
  dtableUuid: string;
  dtableServer: string;
};

async function getSession(ctx: ForgeActionContext): Promise<SeaTableSession> {
  const cred = requireCredential('SeaTable', ctx.credential);
  const baseUrl = (cred.baseUrl || 'https://cloud.seatable.io').replace(/\/+$/, '');
  const apiToken = cred.apiToken ?? cred.accessToken;
  if (!apiToken) throw new Error('SeaTable: credential is missing `apiToken`');

  const res = await apiRequest({
    service: 'SeaTable',
    method: 'GET',
    url: `${baseUrl}/api/v2.1/dtable/app-access-token/`,
    headers: { Authorization: `Token ${apiToken}` },
  });
  const data = res.data as {
    access_token?: string;
    dtable_uuid?: string;
    dtable_server?: string;
  } | null;
  if (!data?.access_token || !data.dtable_uuid || !data.dtable_server) {
    throw new Error('SeaTable: failed to exchange API token for app access token');
  }
  return {
    accessToken: data.access_token,
    dtableUuid: data.dtable_uuid,
    dtableServer: data.dtable_server.replace(/\/+$/, ''),
  };
}

async function dtableApi(
  ctx: ForgeActionContext,
  session: SeaTableSession,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'SeaTable',
    method,
    url: `${session.dtableServer}/api/v1/dtables/${encodeURIComponent(session.dtableUuid)}${path}`,
    headers: { Authorization: `Token ${session.accessToken}` },
    json,
  });
  return res.data;
}

function parseJsonObject(label: string, raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) throw new Error(`SeaTable: ${label} is required`);
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error(`SeaTable: ${label} must be a JSON object`);
}

function requireTableName(ctx: ForgeActionContext): string {
  const t = asString(ctx.options.tableName);
  if (!t) throw new Error('SeaTable: tableName is required');
  return t;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function rowList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const session = await getSession(ctx);
  const tableName = requireTableName(ctx);
  const data = await dtableApi(
    ctx,
    session,
    'GET',
    `/rows/?table_name=${encodeURIComponent(tableName)}`,
  );
  return { outputs: { result: data }, logs: [`SeaTable row list → ${tableName}`] };
}

async function rowGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const session = await getSession(ctx);
  const tableName = requireTableName(ctx);
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('SeaTable: rowId is required');
  const data = await dtableApi(
    ctx,
    session,
    'GET',
    `/rows/${encodeURIComponent(rowId)}/?table_name=${encodeURIComponent(tableName)}`,
  );
  return { outputs: { row: data }, logs: [`SeaTable row get → ${rowId}`] };
}

async function rowCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const session = await getSession(ctx);
  const tableName = requireTableName(ctx);
  const row = parseJsonObject('row', ctx.options.row);
  const body = { table_name: tableName, row };
  const data = await dtableApi(ctx, session, 'POST', '/rows/', body);
  return { outputs: { row: data }, logs: [`SeaTable row create → ${tableName}`] };
}

async function rowUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const session = await getSession(ctx);
  const tableName = requireTableName(ctx);
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('SeaTable: rowId is required');
  const row = parseJsonObject('row', ctx.options.row);
  const body = { table_name: tableName, row_id: rowId, row };
  const data = await dtableApi(ctx, session, 'PUT', '/rows/', body);
  return { outputs: { row: data }, logs: [`SeaTable row update → ${rowId}`] };
}

async function rowDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const session = await getSession(ctx);
  const tableName = requireTableName(ctx);
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('SeaTable: rowId is required');
  const body = { table_name: tableName, row_ids: [rowId] };
  const data = await dtableApi(ctx, session, 'DELETE', '/rows/', body);
  return { outputs: { result: data }, logs: [`SeaTable row delete → ${rowId}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_seatable',
  name: 'SeaTable',
  description: 'CRUD rows inside a SeaTable table.',
  iconName: 'LuTable',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'seatable' },
  actions: [
    {
      id: 'row_list',
      label: 'List rows',
      description: 'List rows in a table.',
      fields: [
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
      ],
      run: rowList,
    },
    {
      id: 'row_get',
      label: 'Get row',
      description: 'Fetch a single row by id.',
      fields: [
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID', type: 'text', required: true },
      ],
      run: rowGet,
    },
    {
      id: 'row_create',
      label: 'Create row',
      description: 'Create a new row.',
      fields: [
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'row', label: 'Row (JSON object)', type: 'json', required: true },
      ],
      run: rowCreate,
    },
    {
      id: 'row_update',
      label: 'Update row',
      description: 'Patch an existing row.',
      fields: [
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID', type: 'text', required: true },
        { id: 'row', label: 'Row (JSON object)', type: 'json', required: true },
      ],
      run: rowUpdate,
    },
    {
      id: 'row_delete',
      label: 'Delete row',
      description: 'Permanently delete a row.',
      fields: [
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'rowId', label: 'Row ID', type: 'text', required: true },
      ],
      run: rowDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
