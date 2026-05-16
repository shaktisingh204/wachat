/**
 * Forge block: Grist
 *
 * Source: n8n-master/packages/nodes-base/nodes/Grist/Grist.node.ts
 * Credential type: 'grist' — fields: { baseUrl, apiKey }
 *
 * Operations covered (record resource, table-scoped):
 *   - record.list     GET    /api/docs/{docId}/tables/{tableId}/records
 *   - record.get      GET    /api/docs/{docId}/tables/{tableId}/records?filter=…
 *   - record.create   POST   /api/docs/{docId}/tables/{tableId}/records
 *   - record.update   PATCH  /api/docs/{docId}/tables/{tableId}/records
 *   - record.delete   POST   /api/docs/{docId}/tables/{tableId}/data/delete
 *
 * Out of scope:
 *   - LoadOptions for docs / tables
 *   - Sort/limit/filter parameter UX
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

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

function parseJsonObject(label: string, raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) throw new Error(`Grist: ${label} is required`);
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error(`Grist: ${label} must be a JSON object`);
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

async function recordGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const recordId = asString(ctx.options.recordId);
  if (!recordId) throw new Error('Grist: recordId is required');
  const filter = encodeURIComponent(JSON.stringify({ id: [Number(recordId)] }));
  const data = await gristApi(ctx, 'GET', `${recordsPath(ctx)}?filter=${filter}`);
  return { outputs: { result: data }, logs: [`Grist record get → ${recordId}`] };
}

async function recordCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const fields = parseJsonObject('fields', ctx.options.fields);
  const body = { records: [{ fields }] };
  const data = await gristApi(ctx, 'POST', recordsPath(ctx), body);
  return { outputs: { result: data }, logs: ['Grist record create'] };
}

async function recordUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const recordId = asString(ctx.options.recordId);
  if (!recordId) throw new Error('Grist: recordId is required');
  const fields = parseJsonObject('fields', ctx.options.fields);
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

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_grist',
  name: 'Grist',
  description: 'CRUD records in a Grist document table.',
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
  ],
};

registerForgeBlock(block);
export default block;
