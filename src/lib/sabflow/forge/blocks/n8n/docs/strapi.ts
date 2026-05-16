/**
 * Forge block: Strapi
 *
 * Source: n8n-master/packages/nodes-base/nodes/Strapi/Strapi.node.ts
 * Credential type: 'strapi' — fields: { baseUrl, apiToken }
 *
 * Authentication:
 *   - If the credential `apiToken` looks like a Strapi v4 API token, it's used
 *     directly as a Bearer.
 *   - Optionally, the block fields `authIdentifier` + `authPassword` can be
 *     supplied to log in via `POST /api/auth/local` and use the resulting JWT.
 *     This mirrors n8n's username/password Strapi credential flow.
 *
 * Operations covered (entries — collection-type scoped, v4 paths):
 *   - entry.list     GET    /api/{collection}
 *   - entry.get      GET    /api/{collection}/{id}
 *   - entry.create   POST   /api/{collection}
 *   - entry.update   PUT    /api/{collection}/{id}
 *   - entry.delete   DELETE /api/{collection}/{id}
 *
 * Out of scope:
 *   - LoadOptions for collections
 *   - Population / filter / sort UX
 *   - Strapi v3 (legacy /content-manager paths)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function getBase(ctx: ForgeActionContext): string {
  const cred = requireCredential('Strapi', ctx.credential);
  const baseUrl = (cred.baseUrl || '').replace(/\/+$/, '');
  if (!baseUrl) throw new Error('Strapi: credential is missing `baseUrl`');
  return baseUrl;
}

async function resolveToken(ctx: ForgeActionContext): Promise<string> {
  const cred = requireCredential('Strapi', ctx.credential);
  const identifier = asString(ctx.options.authIdentifier);
  const password = asString(ctx.options.authPassword);
  if (identifier && password) {
    const baseUrl = getBase(ctx);
    const res = await apiRequest({
      service: 'Strapi',
      method: 'POST',
      url: `${baseUrl}/api/auth/local`,
      json: { identifier, password },
    });
    const data = res.data as { jwt?: string } | null;
    if (!data?.jwt) throw new Error('Strapi: login did not return a JWT');
    return data.jwt;
  }
  const apiToken = cred.apiToken ?? cred.accessToken;
  if (!apiToken) {
    throw new Error('Strapi: provide `apiToken` in the credential, or set authIdentifier + authPassword on the action');
  }
  return apiToken;
}

async function strapiApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const token = await resolveToken(ctx);
  const baseUrl = getBase(ctx);
  const res = await apiRequest({
    service: 'Strapi',
    method,
    url: `${baseUrl}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    json,
  });
  return res.data;
}

function parseJsonObject(label: string, raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) throw new Error(`Strapi: ${label} is required`);
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error(`Strapi: ${label} must be a JSON object`);
}

function collectionPath(ctx: ForgeActionContext, id?: string): string {
  const collection = asString(ctx.options.collection);
  if (!collection) throw new Error('Strapi: collection is required');
  const base = `/api/${encodeURIComponent(collection)}`;
  return id ? `${base}/${encodeURIComponent(id)}` : base;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function entryList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await strapiApi(ctx, 'GET', collectionPath(ctx));
  return { outputs: { result: data }, logs: ['Strapi entry list'] };
}

async function entryGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.entryId);
  if (!id) throw new Error('Strapi: entryId is required');
  const data = await strapiApi(ctx, 'GET', collectionPath(ctx, id));
  return { outputs: { entry: data }, logs: [`Strapi entry get → ${id}`] };
}

async function entryCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const fields = parseJsonObject('data', ctx.options.data);
  const body = { data: fields };
  const data = await strapiApi(ctx, 'POST', collectionPath(ctx), body);
  return { outputs: { entry: data }, logs: ['Strapi entry create'] };
}

async function entryUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.entryId);
  if (!id) throw new Error('Strapi: entryId is required');
  const fields = parseJsonObject('data', ctx.options.data);
  const body = { data: fields };
  const data = await strapiApi(ctx, 'PUT', collectionPath(ctx, id), body);
  return { outputs: { entry: data }, logs: [`Strapi entry update → ${id}`] };
}

async function entryDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.entryId);
  if (!id) throw new Error('Strapi: entryId is required');
  const data = await strapiApi(ctx, 'DELETE', collectionPath(ctx, id));
  return { outputs: { result: data }, logs: [`Strapi entry delete → ${id}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_strapi',
  name: 'Strapi',
  description: 'CRUD entries inside a Strapi collection type.',
  iconName: 'LuLayoutDashboard',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'strapi' },
  actions: [
    {
      id: 'entry_list',
      label: 'List entries',
      description: 'List entries in a collection type.',
      fields: [
        { id: 'collection', label: 'Collection (plural API id)', type: 'text', required: true, placeholder: 'articles' },
        { id: 'authIdentifier', label: 'Login identifier (optional)', type: 'text' },
        { id: 'authPassword', label: 'Login password (optional)', type: 'password' },
      ],
      run: entryList,
    },
    {
      id: 'entry_get',
      label: 'Get entry',
      description: 'Fetch a single entry by id.',
      fields: [
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'entryId', label: 'Entry ID', type: 'text', required: true },
        { id: 'authIdentifier', label: 'Login identifier (optional)', type: 'text' },
        { id: 'authPassword', label: 'Login password (optional)', type: 'password' },
      ],
      run: entryGet,
    },
    {
      id: 'entry_create',
      label: 'Create entry',
      description: 'Create a new entry. Data is a JSON object of attribute → value.',
      fields: [
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'data', label: 'Data (JSON)', type: 'json', required: true },
        { id: 'authIdentifier', label: 'Login identifier (optional)', type: 'text' },
        { id: 'authPassword', label: 'Login password (optional)', type: 'password' },
      ],
      run: entryCreate,
    },
    {
      id: 'entry_update',
      label: 'Update entry',
      description: 'Patch an existing entry.',
      fields: [
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'entryId', label: 'Entry ID', type: 'text', required: true },
        { id: 'data', label: 'Data (JSON)', type: 'json', required: true },
        { id: 'authIdentifier', label: 'Login identifier (optional)', type: 'text' },
        { id: 'authPassword', label: 'Login password (optional)', type: 'password' },
      ],
      run: entryUpdate,
    },
    {
      id: 'entry_delete',
      label: 'Delete entry',
      description: 'Permanently delete an entry.',
      fields: [
        { id: 'collection', label: 'Collection', type: 'text', required: true },
        { id: 'entryId', label: 'Entry ID', type: 'text', required: true },
        { id: 'authIdentifier', label: 'Login identifier (optional)', type: 'text' },
        { id: 'authPassword', label: 'Login password (optional)', type: 'password' },
      ],
      run: entryDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
