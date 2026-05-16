/**
 * Forge block: FileMaker (Data API)
 *
 * Source: n8n-master/packages/nodes-base/nodes/FileMaker/FileMaker.node.ts
 *
 * FileMaker Server requires a token-exchange flow: Basic-auth into
 * `/fmi/data/v1/databases/{db}/sessions` to obtain a bearer token, then call
 * subsequent endpoints with that token. We perform the exchange inline on
 * every action so credentials stay request-scoped.
 *
 * Operations covered:
 *   - layout.list              GET  /databases/{db}/layouts
 *   - record.create            POST /databases/{db}/layouts/{layout}/records
 *   - record.get               GET  /databases/{db}/layouts/{layout}/records/{recordId}
 *   - record.find              POST /databases/{db}/layouts/{layout}/_find
 *   - record.delete            DELETE /databases/{db}/layouts/{layout}/records/{recordId}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function dbBase(ctx: ForgeActionContext): string {
  const host = asString(ctx.options.host).trim();
  const db = asString(ctx.options.database).trim();
  if (!host) throw new Error('FileMaker: host is required');
  if (!db) throw new Error('FileMaker: database is required');
  const root = /^https?:\/\//i.test(host) ? host : `https://${host}`;
  return `${root.replace(/\/$/, '')}/fmi/data/v1/databases/${encodeURIComponent(db)}`;
}

async function login(ctx: ForgeActionContext): Promise<string> {
  const username = asString(ctx.options.username);
  const password = asString(ctx.options.password);
  if (!username) throw new Error('FileMaker: username is required');
  if (!password) throw new Error('FileMaker: password is required');
  const basic = Buffer.from(`${username}:${password}`).toString('base64');
  const res = await apiRequest({
    service: 'FileMaker',
    method: 'POST',
    url: `${dbBase(ctx)}/sessions`,
    headers: { Authorization: `Basic ${basic}` },
    json: {},
  });
  const data = res.data as { response?: { token?: string } } | undefined;
  const token = data?.response?.token;
  if (!token) throw new Error('FileMaker: login response missing token');
  return token;
}

async function logout(ctx: ForgeActionContext, token: string): Promise<void> {
  try {
    await apiRequest({
      service: 'FileMaker',
      method: 'DELETE',
      url: `${dbBase(ctx)}/sessions/${encodeURIComponent(token)}`,
      throwOnError: false,
    });
  } catch {
    /* best-effort */
  }
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function parseJsonOption(v: unknown, field: string): Record<string, unknown> {
  if (v == null || v === '') return {};
  if (typeof v === 'object') return v as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(v));
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`FileMaker: ${field} must be valid JSON`);
  }
  throw new Error(`FileMaker: ${field} must be a JSON object`);
}

async function layoutList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = await login(ctx);
  try {
    const res = await apiRequest({
      service: 'FileMaker',
      method: 'GET',
      url: `${dbBase(ctx)}/layouts`,
      headers: bearer(token),
    });
    return { outputs: { layouts: res.data }, logs: ['FileMaker layout list'] };
  } finally {
    await logout(ctx, token);
  }
}

async function recordCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const layout = asString(ctx.options.layout);
  if (!layout) throw new Error('FileMaker: layout is required');
  const fieldData = parseJsonOption(ctx.options.fieldData, 'fieldData');
  const token = await login(ctx);
  try {
    const res = await apiRequest({
      service: 'FileMaker',
      method: 'POST',
      url: `${dbBase(ctx)}/layouts/${encodeURIComponent(layout)}/records`,
      headers: bearer(token),
      json: { fieldData },
    });
    return { outputs: { result: res.data }, logs: [`FileMaker record create → ${layout}`] };
  } finally {
    await logout(ctx, token);
  }
}

async function recordGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const layout = asString(ctx.options.layout);
  const recordId = asString(ctx.options.recordId);
  if (!layout) throw new Error('FileMaker: layout is required');
  if (!recordId) throw new Error('FileMaker: recordId is required');
  const token = await login(ctx);
  try {
    const res = await apiRequest({
      service: 'FileMaker',
      method: 'GET',
      url: `${dbBase(ctx)}/layouts/${encodeURIComponent(layout)}/records/${encodeURIComponent(recordId)}`,
      headers: bearer(token),
    });
    return { outputs: { record: res.data }, logs: [`FileMaker record get → ${recordId}`] };
  } finally {
    await logout(ctx, token);
  }
}

async function recordFind(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const layout = asString(ctx.options.layout);
  if (!layout) throw new Error('FileMaker: layout is required');
  const query = ctx.options.query;
  let queryArr: unknown[];
  if (typeof query === 'string' && query.trim().length > 0) {
    try {
      const parsed = JSON.parse(query);
      queryArr = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      throw new Error('FileMaker: query must be valid JSON');
    }
  } else if (Array.isArray(query)) {
    queryArr = query;
  } else if (query && typeof query === 'object') {
    queryArr = [query];
  } else {
    throw new Error('FileMaker: query is required');
  }
  const token = await login(ctx);
  try {
    const res = await apiRequest({
      service: 'FileMaker',
      method: 'POST',
      url: `${dbBase(ctx)}/layouts/${encodeURIComponent(layout)}/_find`,
      headers: bearer(token),
      json: { query: queryArr },
    });
    return { outputs: { results: res.data }, logs: [`FileMaker record find → ${layout}`] };
  } finally {
    await logout(ctx, token);
  }
}

async function recordDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const layout = asString(ctx.options.layout);
  const recordId = asString(ctx.options.recordId);
  if (!layout) throw new Error('FileMaker: layout is required');
  if (!recordId) throw new Error('FileMaker: recordId is required');
  const token = await login(ctx);
  try {
    const res = await apiRequest({
      service: 'FileMaker',
      method: 'DELETE',
      url: `${dbBase(ctx)}/layouts/${encodeURIComponent(layout)}/records/${encodeURIComponent(recordId)}`,
      headers: bearer(token),
    });
    return { outputs: { result: res.data }, logs: [`FileMaker record delete → ${recordId}`] };
  } finally {
    await logout(ctx, token);
  }
}

const CRED_FIELDS = [
  {
    id: 'host',
    label: 'Host',
    type: 'text' as const,
    required: true,
    placeholder: 'fms.example.com',
    helperText: 'FileMaker Server host — HTTPS is added automatically.',
  },
  { id: 'database', label: 'Database', type: 'text' as const, required: true },
  { id: 'username', label: 'Username', type: 'text' as const, required: true },
  { id: 'password', label: 'Password', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_filemaker',
  name: 'FileMaker',
  description: 'Query and mutate FileMaker Server records via the Data API.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'layout_list',
      label: 'List layouts',
      description: 'Fetch every layout in the database.',
      fields: [...CRED_FIELDS],
      run: layoutList,
    },
    {
      id: 'record_create',
      label: 'Create record',
      description: 'Create a record on a layout with the given fieldData.',
      fields: [
        ...CRED_FIELDS,
        { id: 'layout', label: 'Layout', type: 'text', required: true },
        {
          id: 'fieldData',
          label: 'Field data',
          type: 'json',
          required: true,
          placeholder: '{"FirstName": "Ada", "LastName": "Lovelace"}',
        },
      ],
      run: recordCreate,
    },
    {
      id: 'record_get',
      label: 'Get record',
      description: 'Fetch a single record by id.',
      fields: [
        ...CRED_FIELDS,
        { id: 'layout', label: 'Layout', type: 'text', required: true },
        { id: 'recordId', label: 'Record ID', type: 'text', required: true },
      ],
      run: recordGet,
    },
    {
      id: 'record_find',
      label: 'Find records',
      description: 'Run a find request against a layout.',
      fields: [
        ...CRED_FIELDS,
        { id: 'layout', label: 'Layout', type: 'text', required: true },
        {
          id: 'query',
          label: 'Query',
          type: 'json',
          required: true,
          placeholder: '[{"FirstName": "Ada"}]',
          helperText: 'Array of find request objects — each is a `{ field: criterion }` map.',
        },
      ],
      run: recordFind,
    },
    {
      id: 'record_delete',
      label: 'Delete record',
      description: 'Delete a record by id.',
      fields: [
        ...CRED_FIELDS,
        { id: 'layout', label: 'Layout', type: 'text', required: true },
        { id: 'recordId', label: 'Record ID', type: 'text', required: true },
      ],
      run: recordDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
