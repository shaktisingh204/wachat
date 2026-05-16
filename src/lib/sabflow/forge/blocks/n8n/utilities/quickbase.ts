/**
 * Forge block: QuickBase
 *
 * Source: n8n-master/packages/nodes-base/nodes/QuickBase/QuickBase.node.ts
 * Auth: `QB-USER-TOKEN: <userToken>` + `QB-Realm-Hostname: <hostname>` headers,
 *       inline as `password` / `text` fields.
 *
 * Operations covered:
 *   - record.query   POST /records/query
 *   - record.insert  POST /records
 *   - record.update  POST /records (with `data[].rid`)
 *   - table.fields   GET  /fields?tableId=…
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.quickbase.com/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.userToken);
  const hostname = asString(ctx.options.hostname);
  if (!token) throw new Error('QuickBase: userToken is required');
  if (!hostname) throw new Error('QuickBase: hostname is required (e.g. acme.quickbase.com)');
  return {
    Authorization: `QB-USER-TOKEN ${token}`,
    'QB-Realm-Hostname': hostname,
  };
}

function parseJson(raw: unknown, label: string): unknown {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    throw new Error(`QuickBase: ${label} must be valid JSON`);
  }
}

async function recordQuery(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const tableId = asString(ctx.options.tableId);
  if (!tableId) throw new Error('QuickBase: tableId is required');
  const body: Record<string, unknown> = { from: tableId };
  const select = parseJson(ctx.options.select, 'select');
  const where = asString(ctx.options.where);
  const sortBy = parseJson(ctx.options.sortBy, 'sortBy');
  if (select) body.select = select;
  if (where) body.where = where;
  if (sortBy) body.sortBy = sortBy;
  const res = await apiRequest({
    service: 'QuickBase',
    method: 'POST',
    url: `${API}/records/query`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`QuickBase record.query → ${tableId}`] };
}

async function recordInsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const tableId = asString(ctx.options.tableId);
  if (!tableId) throw new Error('QuickBase: tableId is required');
  const data = parseJson(ctx.options.data, 'data');
  if (!data) throw new Error('QuickBase: data is required');
  const body: Record<string, unknown> = { to: tableId, data };
  const fieldsToReturn = parseJson(ctx.options.fieldsToReturn, 'fieldsToReturn');
  if (fieldsToReturn) body.fieldsToReturn = fieldsToReturn;
  const res = await apiRequest({
    service: 'QuickBase',
    method: 'POST',
    url: `${API}/records`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`QuickBase record.insert → ${tableId}`] };
}

async function recordUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  // QuickBase uses the same /records endpoint for updates — rows with a `3` (RID)
  // key are merged; rows without are inserted.
  const tableId = asString(ctx.options.tableId);
  if (!tableId) throw new Error('QuickBase: tableId is required');
  const data = parseJson(ctx.options.data, 'data');
  if (!data) throw new Error('QuickBase: data is required (include field id "3" for RID)');
  const body: Record<string, unknown> = { to: tableId, data };
  const mergeFieldId = asString(ctx.options.mergeFieldId);
  if (mergeFieldId) body.mergeFieldId = Number(mergeFieldId) || mergeFieldId;
  const res = await apiRequest({
    service: 'QuickBase',
    method: 'POST',
    url: `${API}/records`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`QuickBase record.update → ${tableId}`] };
}

async function tableFields(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const tableId = asString(ctx.options.tableId);
  if (!tableId) throw new Error('QuickBase: tableId is required');
  const params = new URLSearchParams({ tableId });
  const res = await apiRequest({
    service: 'QuickBase',
    method: 'GET',
    url: `${API}/fields?${params.toString()}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { fields: res.data }, logs: [`QuickBase table.fields → ${tableId}`] };
}

const block: ForgeBlock = {
  id: 'forge_quickbase',
  name: 'QuickBase',
  description: 'Query and modify QuickBase records and fields.',
  iconName: 'LuTable',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'record_query',
      label: 'Query records',
      description: 'Run a records query against a table.',
      fields: [
        { id: 'userToken', label: 'User token', type: 'password', required: true },
        {
          id: 'hostname',
          label: 'Realm hostname',
          type: 'text',
          required: true,
          placeholder: 'acme.quickbase.com',
        },
        { id: 'tableId', label: 'Table id', type: 'text', required: true },
        { id: 'select', label: 'Field ids to select (JSON array)', type: 'json', placeholder: '[3, 6, 7]' },
        { id: 'where', label: 'Where clause', type: 'text', placeholder: "{6.EX.'active'}" },
        { id: 'sortBy', label: 'Sort by (JSON array)', type: 'json' },
      ],
      run: recordQuery,
    },
    {
      id: 'record_insert',
      label: 'Insert records',
      description: 'Insert one or more new records.',
      fields: [
        { id: 'userToken', label: 'User token', type: 'password', required: true },
        { id: 'hostname', label: 'Realm hostname', type: 'text', required: true },
        { id: 'tableId', label: 'Table id', type: 'text', required: true },
        {
          id: 'data',
          label: 'Data (JSON array)',
          type: 'json',
          required: true,
          placeholder: '[{ "6": { "value": "Hello" } }]',
        },
        { id: 'fieldsToReturn', label: 'Fields to return (JSON array)', type: 'json' },
      ],
      run: recordInsert,
    },
    {
      id: 'record_update',
      label: 'Update records',
      description: 'Update records by RID (field 3) or merge field.',
      fields: [
        { id: 'userToken', label: 'User token', type: 'password', required: true },
        { id: 'hostname', label: 'Realm hostname', type: 'text', required: true },
        { id: 'tableId', label: 'Table id', type: 'text', required: true },
        {
          id: 'data',
          label: 'Data (JSON array, include RID under field 3)',
          type: 'json',
          required: true,
        },
        { id: 'mergeFieldId', label: 'Merge field id', type: 'text', placeholder: '3' },
      ],
      run: recordUpdate,
    },
    {
      id: 'table_fields',
      label: 'List table fields',
      description: 'List the field definitions for a table.',
      fields: [
        { id: 'userToken', label: 'User token', type: 'password', required: true },
        { id: 'hostname', label: 'Realm hostname', type: 'text', required: true },
        { id: 'tableId', label: 'Table id', type: 'text', required: true },
      ],
      run: tableFields,
    },
  ],
};

registerForgeBlock(block);
export default block;
