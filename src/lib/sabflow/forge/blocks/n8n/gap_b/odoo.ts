/**
 * Forge block: Odoo
 *
 * Source: n8n-master/packages/nodes-base/nodes/Odoo
 *
 * Endpoint: {url}/jsonrpc — Odoo's JSON-RPC bridge over HTTP.
 * Auth: a 2-step flow — `common.login` to swap username + password (or API
 * key) for a numeric uid, then `object.execute_kw` for every CRUD call.
 *
 * Operations covered:
 *   - record.search_read   ORM `search_read`
 *   - record.create        ORM `create`
 *   - record.write         ORM `write`
 *   - record.unlink        ORM `unlink`
 *
 * Inline credentials — `auth: { type: 'none' }`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

type RpcResponse<T> = {
  jsonrpc: '2.0';
  id?: number | string;
  result?: T;
  error?: { message?: string; data?: { message?: string } };
};

function rpcUrl(ctx: ForgeActionContext): string {
  const url = asString(ctx.options.url).replace(/\/$/, '');
  if (!url) throw new Error('Odoo: url is required');
  return `${url}/jsonrpc`;
}

async function rpc<T>(
  ctx: ForgeActionContext,
  payload: { service: string; method: string; args: unknown[] },
): Promise<T> {
  const res = await apiRequest({
    service: 'Odoo',
    method: 'POST',
    url: rpcUrl(ctx),
    headers: { Accept: 'application/json' },
    json: {
      jsonrpc: '2.0',
      method: 'call',
      params: payload,
    },
  });
  const body = res.data as RpcResponse<T>;
  if (body?.error) {
    const msg = body.error?.data?.message || body.error?.message || 'unknown error';
    throw new Error(`Odoo RPC error: ${msg}`);
  }
  return body.result as T;
}

async function login(ctx: ForgeActionContext): Promise<{ uid: number; db: string; password: string }> {
  const db = asString(ctx.options.db);
  const username = asString(ctx.options.username);
  const password = asString(ctx.options.password) || asString(ctx.options.apikey);
  if (!db) throw new Error('Odoo: db is required');
  if (!username) throw new Error('Odoo: username is required');
  if (!password) throw new Error('Odoo: password or apikey is required');
  const uid = await rpc<number | false>(ctx, {
    service: 'common',
    method: 'login',
    args: [db, username, password],
  });
  if (!uid || typeof uid !== 'number') throw new Error('Odoo: login failed — bad credentials');
  return { uid, db, password };
}

function modelName(ctx: ForgeActionContext): string {
  const m = asString(ctx.options.model);
  if (!m) throw new Error('Odoo: model is required');
  return m;
}

async function recordSearchRead(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { uid, db, password } = await login(ctx);
  const domainRaw = asString(ctx.options.domain);
  const domain = domainRaw ? (JSON.parse(domainRaw) as unknown[]) : [];
  const fieldsRaw = asString(ctx.options.fields);
  const fields = fieldsRaw ? (JSON.parse(fieldsRaw) as string[]) : [];
  const limit = asNumber(ctx.options.limit) ?? 80;
  const offset = asNumber(ctx.options.offset) ?? 0;
  const records = await rpc<Array<Record<string, unknown>>>(ctx, {
    service: 'object',
    method: 'execute_kw',
    args: [db, uid, password, modelName(ctx), 'search_read', [domain], { fields, limit, offset }],
  });
  return {
    outputs: { records, count: records.length },
    logs: [`Odoo search_read ${modelName(ctx)} → ${records.length}`],
  };
}

async function recordCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { uid, db, password } = await login(ctx);
  const valuesRaw = asString(ctx.options.values);
  if (!valuesRaw) throw new Error('Odoo: values is required');
  const values = JSON.parse(valuesRaw) as Record<string, unknown>;
  const id = await rpc<number>(ctx, {
    service: 'object',
    method: 'execute_kw',
    args: [db, uid, password, modelName(ctx), 'create', [values]],
  });
  return {
    outputs: { id, model: modelName(ctx) },
    logs: [`Odoo create ${modelName(ctx)} → ${id}`],
  };
}

async function recordWrite(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { uid, db, password } = await login(ctx);
  const idsRaw = asString(ctx.options.ids);
  if (!idsRaw) throw new Error('Odoo: ids is required');
  const ids = (JSON.parse(idsRaw) as unknown[]).map((v) => Number(v));
  const valuesRaw = asString(ctx.options.values);
  if (!valuesRaw) throw new Error('Odoo: values is required');
  const values = JSON.parse(valuesRaw) as Record<string, unknown>;
  const ok = await rpc<boolean>(ctx, {
    service: 'object',
    method: 'execute_kw',
    args: [db, uid, password, modelName(ctx), 'write', [ids, values]],
  });
  return {
    outputs: { ok, ids, model: modelName(ctx) },
    logs: [`Odoo write ${modelName(ctx)} → ${ids.length}`],
  };
}

async function recordUnlink(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { uid, db, password } = await login(ctx);
  const idsRaw = asString(ctx.options.ids);
  if (!idsRaw) throw new Error('Odoo: ids is required');
  const ids = (JSON.parse(idsRaw) as unknown[]).map((v) => Number(v));
  const ok = await rpc<boolean>(ctx, {
    service: 'object',
    method: 'execute_kw',
    args: [db, uid, password, modelName(ctx), 'unlink', [ids]],
  });
  return {
    outputs: { ok, deleted: ids.length, model: modelName(ctx) },
    logs: [`Odoo unlink ${modelName(ctx)} → ${ids.length}`],
  };
}

const inlineCreds = [
  { id: 'url', label: 'Odoo URL', type: 'text' as const, required: true, placeholder: 'https://acme.odoo.com' },
  { id: 'db', label: 'Database', type: 'text' as const, required: true },
  { id: 'username', label: 'Username', type: 'text' as const, required: true },
  { id: 'password', label: 'Password', type: 'password' as const, helperText: 'Provide password OR apikey.' },
  { id: 'apikey', label: 'API key', type: 'password' as const, helperText: 'Used when password is empty.' },
];

const block: ForgeBlock = {
  id: 'forge_odoo',
  name: 'Odoo',
  description: 'CRUD against any Odoo model via the JSON-RPC bridge.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'record_search_read',
      label: 'Search records',
      description: 'ORM search_read on any model.',
      fields: [
        ...inlineCreds,
        { id: 'model', label: 'Model', type: 'text', required: true, placeholder: 'res.partner' },
        { id: 'domain', label: 'Domain (JSON array)', type: 'textarea', placeholder: '[["is_company","=",true]]' },
        { id: 'fields', label: 'Fields (JSON array)', type: 'textarea', placeholder: '["name","email"]' },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 80 },
        { id: 'offset', label: 'Offset', type: 'number', defaultValue: 0 },
      ],
      run: recordSearchRead,
    },
    {
      id: 'record_create',
      label: 'Create record',
      description: 'ORM create.',
      fields: [
        ...inlineCreds,
        { id: 'model', label: 'Model', type: 'text', required: true },
        { id: 'values', label: 'Values (JSON object)', type: 'textarea', required: true },
      ],
      run: recordCreate,
    },
    {
      id: 'record_write',
      label: 'Update records',
      description: 'ORM write.',
      fields: [
        ...inlineCreds,
        { id: 'model', label: 'Model', type: 'text', required: true },
        { id: 'ids', label: 'Record IDs (JSON array)', type: 'textarea', required: true },
        { id: 'values', label: 'Values (JSON object)', type: 'textarea', required: true },
      ],
      run: recordWrite,
    },
    {
      id: 'record_unlink',
      label: 'Delete records',
      description: 'ORM unlink.',
      fields: [
        ...inlineCreds,
        { id: 'model', label: 'Model', type: 'text', required: true },
        { id: 'ids', label: 'Record IDs (JSON array)', type: 'textarea', required: true },
      ],
      run: recordUnlink,
    },
  ],
};

registerForgeBlock(block);
export default block;
