/**
 * Forge block: ERPNext
 *
 * Source: n8n-master/packages/nodes-base/nodes/ERPNext/ERPNext.node.ts
 * Credential type: 'erpnext' — fields: { baseUrl, apiKey, apiSecret }
 *
 * Operations (subset):
 *   - document.list      GET    /api/resource/{doctype}
 *   - document.get       GET    /api/resource/{doctype}/{name}
 *   - document.create    POST   /api/resource/{doctype}
 *   - document.update    PUT    /api/resource/{doctype}/{name}
 *
 * Deferred: child tables, file attachments, server-script calls.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function getAuth(ctx: ForgeActionContext): { base: string; headers: Record<string, string> } {
  const cred = requireCredential('ERPNext', ctx.credential);
  const baseUrl = cred.baseUrl;
  const apiKey = cred.apiKey;
  const apiSecret = cred.apiSecret;
  if (!baseUrl) throw new Error('ERPNext: credential is missing `baseUrl` field');
  if (!apiKey) throw new Error('ERPNext: credential is missing `apiKey` field');
  if (!apiSecret) throw new Error('ERPNext: credential is missing `apiSecret` field');
  return {
    base: baseUrl.replace(/\/+$/, ''),
    headers: {
      Authorization: `token ${apiKey}:${apiSecret}`,
      Accept: 'application/json',
    },
  };
}

async function erpApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { base, headers } = getAuth(ctx);
  const res = await apiRequest({
    service: 'ERPNext',
    method,
    url: `${base}${path}`,
    headers,
    json,
  });
  return res.data;
}

function parseJsonObject(label: string, raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error(`ERPNext: ${label} must be a JSON object`);
}

// ── Actions ────────────────────────────────────────────────────────────────

async function documentList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const doctype = asString(ctx.options.doctype);
  if (!doctype) throw new Error('ERPNext: doctype is required');

  const qs = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  const fields = asString(ctx.options.fields);
  const filters = asString(ctx.options.filters).trim();
  if (limit) qs.set('limit_page_length', limit);
  if (fields) qs.set('fields', fields);
  if (filters) qs.set('filters', filters); // expected JSON string per ERPNext docs

  const path = `/api/resource/${encodeURIComponent(doctype)}${qs.size ? `?${qs.toString()}` : ''}`;
  const data = await erpApi(ctx, 'GET', path);
  return { outputs: { result: data }, logs: [`ERPNext list ${doctype}`] };
}

async function documentGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const doctype = asString(ctx.options.doctype);
  const name = asString(ctx.options.name);
  if (!doctype) throw new Error('ERPNext: doctype is required');
  if (!name) throw new Error('ERPNext: name is required');
  const data = await erpApi(
    ctx,
    'GET',
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
  );
  return { outputs: { document: data }, logs: [`ERPNext get ${doctype}/${name}`] };
}

async function documentCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const doctype = asString(ctx.options.doctype);
  if (!doctype) throw new Error('ERPNext: doctype is required');
  const body = parseJsonObject('data', ctx.options.data);
  if (Object.keys(body).length === 0) throw new Error('ERPNext: data is required');

  const data = (await erpApi(ctx, 'POST', `/api/resource/${encodeURIComponent(doctype)}`, body)) as
    | { data?: { name?: string } }
    | null;
  return {
    outputs: { document: data, name: data?.data?.name ?? null },
    logs: [`ERPNext create ${doctype} → ${data?.data?.name ?? '?'}`],
  };
}

async function documentUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const doctype = asString(ctx.options.doctype);
  const name = asString(ctx.options.name);
  if (!doctype) throw new Error('ERPNext: doctype is required');
  if (!name) throw new Error('ERPNext: name is required');
  const body = parseJsonObject('data', ctx.options.data);
  if (Object.keys(body).length === 0) throw new Error('ERPNext: data is required');

  const data = await erpApi(
    ctx,
    'PUT',
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    body,
  );
  return { outputs: { document: data }, logs: [`ERPNext update ${doctype}/${name}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_erpnext',
  name: 'ERPNext',
  description: 'Read and write ERPNext / Frappe documents over the REST resource API.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'erpnext' },
  actions: [
    {
      id: 'document_list',
      label: 'List documents',
      fields: [
        { id: 'doctype', label: 'Doctype', type: 'text', required: true, placeholder: 'Customer' },
        { id: 'limit', label: 'Limit page length', type: 'number', defaultValue: 50 },
        {
          id: 'fields',
          label: 'Fields',
          type: 'text',
          helperText: 'JSON array, e.g. ["name","customer_name"]',
        },
        {
          id: 'filters',
          label: 'Filters',
          type: 'text',
          helperText: 'JSON, e.g. [["status","=","Open"]]',
        },
      ],
      run: documentList,
    },
    {
      id: 'document_get',
      label: 'Get document',
      fields: [
        { id: 'doctype', label: 'Doctype', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
      ],
      run: documentGet,
    },
    {
      id: 'document_create',
      label: 'Create document',
      fields: [
        { id: 'doctype', label: 'Doctype', type: 'text', required: true },
        { id: 'data', label: 'Document (JSON)', type: 'json', required: true },
      ],
      run: documentCreate,
    },
    {
      id: 'document_update',
      label: 'Update document',
      fields: [
        { id: 'doctype', label: 'Doctype', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'data', label: 'Patch (JSON)', type: 'json', required: true },
      ],
      run: documentUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
