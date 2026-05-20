/**
 * Forge block: SeaTable
 *
 * Source: n8n-master/packages/nodes-base/nodes/SeaTable/SeaTable.node.ts
 *   (+ v2/actions/row/*, v2/actions/base/metadata.operation.ts,
 *    v2/actions/link/*, v2/GenericFunctions.ts)
 * Credential type: 'seatable' — fields: { baseUrl, apiToken }
 *
 * SeaTable auth flow: the base API token is exchanged for a per-base
 * `access_token` + `dtable_uuid` + `dtable_server` via
 *   GET {baseUrl}/api/v2.1/dtable/app-access-token/
 * That access token is then used against the dtable server endpoints.
 *
 * Operations covered (row + metadata + link + sql):
 *   - row.list     GET    {server}/api/v1/dtables/{uuid}/rows/?table_name={t}
 *   - row.get      GET    {server}/api/v1/dtables/{uuid}/rows/{rowId}/?table_name={t}
 *   - row.create   POST   {server}/api/v1/dtables/{uuid}/rows/
 *   - row.update   PUT    {server}/api/v1/dtables/{uuid}/rows/
 *   - row.delete   DELETE {server}/api/v1/dtables/{uuid}/rows/
 *   - row.append   POST   {server}/api/v1/dtables/{uuid}/batch-append-rows/
 *   - metadata.get GET    {server}/api/v1/dtables/{uuid}/metadata/
 *   - sql.query    POST   {server}/api-gateway/api/v2/dtables/{uuid}/sql
 *   - link.add     POST   {server}/api/v1/dtables/{uuid}/links/
 *   - link.remove  DELETE {server}/api/v1/dtables/{uuid}/links/
 *
 * Out of scope:
 *   - LoadOptions for table picker
 *   - Asset (file) upload — needs binary-stream plumbing
 *   - Snapshot / collaborator base ops
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';
import { parseJsonArray, parseJsonObject } from '../_shared/json';

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

/**
 * Call a dtable-server endpoint scoped to the base. Path is the suffix after
 * `/api/v1/dtables/{uuid}` — e.g. `/rows/` or `/metadata/`.
 */
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

/**
 * Call the api-gateway/v2 endpoint (used for SQL). Different host prefix from
 * the dtable-server endpoints above.
 */
async function gatewayApi(
  ctx: ForgeActionContext,
  session: SeaTableSession,
  method: 'GET' | 'POST',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'SeaTable',
    method,
    url: `${session.dtableServer}/api-gateway/api/v2/dtables/${encodeURIComponent(session.dtableUuid)}${path}`,
    headers: { Authorization: `Token ${session.accessToken}` },
    json,
  });
  return res.data;
}

function requireTableName(ctx: ForgeActionContext): string {
  const t = asString(ctx.options.tableName);
  if (!t) throw new Error('SeaTable: tableName is required');
  return t;
}

// ── Row ────────────────────────────────────────────────────────────────────

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
  const row = parseJsonObject(ctx.options.row, 'SeaTable: row');
  if (Object.keys(row).length === 0) throw new Error('SeaTable: row is required');
  const body = { table_name: tableName, row };
  const data = await dtableApi(ctx, session, 'POST', '/rows/', body);
  return { outputs: { row: data }, logs: [`SeaTable row create → ${tableName}`] };
}

async function rowUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const session = await getSession(ctx);
  const tableName = requireTableName(ctx);
  const rowId = asString(ctx.options.rowId);
  if (!rowId) throw new Error('SeaTable: rowId is required');
  const row = parseJsonObject(ctx.options.row, 'SeaTable: row');
  if (Object.keys(row).length === 0) throw new Error('SeaTable: row is required');
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

async function rowAppend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const session = await getSession(ctx);
  const tableName = requireTableName(ctx);
  const rows = parseJsonArray<Record<string, unknown>>(ctx.options.rows, 'SeaTable: rows');
  if (rows.length === 0) throw new Error('SeaTable: rows must be a non-empty JSON array');
  const body = { table_name: tableName, rows };
  const data = await dtableApi(ctx, session, 'POST', '/batch-append-rows/', body);
  return { outputs: { result: data }, logs: [`SeaTable row append → ${rows.length}`] };
}

// ── Metadata ───────────────────────────────────────────────────────────────

async function metadataGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const session = await getSession(ctx);
  const data = await dtableApi(ctx, session, 'GET', '/metadata/');
  return { outputs: { metadata: data }, logs: ['SeaTable metadata get'] };
}

// ── SQL ────────────────────────────────────────────────────────────────────

async function sqlQuery(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const session = await getSession(ctx);
  const sql = asString(ctx.options.sql);
  if (!sql) throw new Error('SeaTable: sql is required');
  const convertKeys = asString(ctx.options.convertKeys) !== 'false';
  const data = await gatewayApi(ctx, session, 'POST', '/sql', { sql, convert_keys: convertKeys });
  return { outputs: { result: data }, logs: ['SeaTable sql query'] };
}

// ── Link ───────────────────────────────────────────────────────────────────

async function linkAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const session = await getSession(ctx);
  const tableName = requireTableName(ctx);
  const otherTableName = asString(ctx.options.otherTableName);
  const linkId = asString(ctx.options.linkId);
  const tableRowId = asString(ctx.options.tableRowId);
  const otherTableRowId = asString(ctx.options.otherTableRowId);
  if (!otherTableName) throw new Error('SeaTable: otherTableName is required');
  if (!linkId) throw new Error('SeaTable: linkId is required');
  if (!tableRowId) throw new Error('SeaTable: tableRowId is required');
  if (!otherTableRowId) throw new Error('SeaTable: otherTableRowId is required');

  const body = {
    table_name: tableName,
    other_table_name: otherTableName,
    link_id: linkId,
    table_row_id: tableRowId,
    other_table_row_id: otherTableRowId,
  };
  const data = await dtableApi(ctx, session, 'POST', '/links/', body);
  return { outputs: { result: data }, logs: ['SeaTable link add'] };
}

async function linkRemove(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const session = await getSession(ctx);
  const tableName = requireTableName(ctx);
  const otherTableName = asString(ctx.options.otherTableName);
  const linkId = asString(ctx.options.linkId);
  const tableRowId = asString(ctx.options.tableRowId);
  const otherTableRowId = asString(ctx.options.otherTableRowId);
  if (!otherTableName) throw new Error('SeaTable: otherTableName is required');
  if (!linkId) throw new Error('SeaTable: linkId is required');
  if (!tableRowId) throw new Error('SeaTable: tableRowId is required');
  if (!otherTableRowId) throw new Error('SeaTable: otherTableRowId is required');

  const body = {
    table_name: tableName,
    other_table_name: otherTableName,
    link_id: linkId,
    table_row_id: tableRowId,
    other_table_row_id: otherTableRowId,
  };
  const data = await dtableApi(ctx, session, 'DELETE', '/links/', body);
  return { outputs: { result: data }, logs: ['SeaTable link remove'] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_seatable',
  name: 'SeaTable',
  description: 'CRUD rows, append bulk, query SQL, fetch metadata and manage links in a SeaTable base.',
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
    {
      id: 'row_append',
      label: 'Append rows (batch)',
      description: 'Append many rows in one request. rows is a JSON array of row objects.',
      fields: [
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'rows', label: 'Rows (JSON array of row objects)', type: 'json', required: true },
      ],
      run: rowAppend,
    },
    {
      id: 'metadata_get',
      label: 'Get metadata',
      description: 'Fetch the base metadata (tables, columns, views).',
      fields: [],
      run: metadataGet,
    },
    {
      id: 'sql_query',
      label: 'Run SQL query',
      description: 'Execute a SQL string against the base (read or DML).',
      fields: [
        { id: 'sql', label: 'SQL', type: 'textarea', required: true,
          placeholder: 'SELECT * FROM `Table1` WHERE Name = "Alice"' },
        { id: 'convertKeys', label: 'convert_keys (true/false)', type: 'text', defaultValue: 'true' },
      ],
      run: sqlQuery,
    },
    {
      id: 'link_add',
      label: 'Add link',
      description: 'Link a row in this table to a row in another table.',
      fields: [
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'otherTableName', label: 'Other table name', type: 'text', required: true },
        { id: 'linkId', label: 'Link column ID', type: 'text', required: true },
        { id: 'tableRowId', label: 'Row ID in this table', type: 'text', required: true },
        { id: 'otherTableRowId', label: 'Row ID in other table', type: 'text', required: true },
      ],
      run: linkAdd,
    },
    {
      id: 'link_remove',
      label: 'Remove link',
      description: 'Unlink a row in this table from a row in another table.',
      fields: [
        { id: 'tableName', label: 'Table name', type: 'text', required: true },
        { id: 'otherTableName', label: 'Other table name', type: 'text', required: true },
        { id: 'linkId', label: 'Link column ID', type: 'text', required: true },
        { id: 'tableRowId', label: 'Row ID in this table', type: 'text', required: true },
        { id: 'otherTableRowId', label: 'Row ID in other table', type: 'text', required: true },
      ],
      run: linkRemove,
    },
  ],
};

registerForgeBlock(block);
export default block;
