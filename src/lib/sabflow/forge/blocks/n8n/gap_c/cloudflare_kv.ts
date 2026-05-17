/**
 * Forge block: Cloudflare Workers KV
 *
 * `https://api.cloudflare.com/client/v4/accounts/{account}/storage/kv` —
 * list namespaces and read/write values.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const account = asString(ctx.options.accountId);
  if (!account) throw new Error('Cloudflare KV: accountId is required');
  return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/storage/kv`;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiToken = asString(ctx.options.apiToken);
  if (!apiToken) throw new Error('Cloudflare KV: apiToken is required');
  return { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' };
}

async function listNamespaces(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Cloudflare KV',
    method: 'GET',
    url: `${baseUrl(ctx)}/namespaces`,
    headers: authHeaders(ctx),
  });
  return { outputs: { namespaces: res.data }, logs: ['Cloudflare KV list namespaces'] };
}

async function getValue(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const ns = asString(ctx.options.namespaceId);
  const key = asString(ctx.options.key);
  if (!ns || !key) throw new Error('Cloudflare KV: namespaceId and key are required');
  const res = await apiRequest({
    service: 'Cloudflare KV',
    method: 'GET',
    url: `${baseUrl(ctx)}/namespaces/${encodeURIComponent(ns)}/values/${encodeURIComponent(key)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { value: res.data }, logs: [`Cloudflare KV get → ${key}`] };
}

async function putValue(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const ns = asString(ctx.options.namespaceId);
  const key = asString(ctx.options.key);
  const value = asString(ctx.options.value);
  if (!ns || !key) throw new Error('Cloudflare KV: namespaceId and key are required');
  const res = await apiRequest({
    service: 'Cloudflare KV',
    method: 'PUT',
    url: `${baseUrl(ctx)}/namespaces/${encodeURIComponent(ns)}/values/${encodeURIComponent(key)}`,
    headers: { ...authHeaders(ctx), 'Content-Type': 'text/plain' },
    body: value,
  });
  return { outputs: { result: res.data }, logs: [`Cloudflare KV put → ${key}`] };
}

async function deleteValue(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const ns = asString(ctx.options.namespaceId);
  const key = asString(ctx.options.key);
  if (!ns || !key) throw new Error('Cloudflare KV: namespaceId and key are required');
  const res = await apiRequest({
    service: 'Cloudflare KV',
    method: 'DELETE',
    url: `${baseUrl(ctx)}/namespaces/${encodeURIComponent(ns)}/values/${encodeURIComponent(key)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Cloudflare KV delete → ${key}`] };
}

const block: ForgeBlock = {
  id: 'forge_cloudflare_kv',
  name: 'Cloudflare KV',
  description: 'Read, write and delete values in a Cloudflare Workers KV namespace.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_namespaces',
      label: 'List namespaces',
      fields: [
        { id: 'accountId', label: 'Account ID', type: 'text', required: true },
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
      ],
      run: listNamespaces,
    },
    {
      id: 'get_value',
      label: 'Get value',
      fields: [
        { id: 'accountId', label: 'Account ID', type: 'text', required: true },
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'namespaceId', label: 'Namespace ID', type: 'text', required: true },
        { id: 'key', label: 'Key', type: 'text', required: true },
      ],
      run: getValue,
    },
    {
      id: 'put_value',
      label: 'Put value',
      fields: [
        { id: 'accountId', label: 'Account ID', type: 'text', required: true },
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'namespaceId', label: 'Namespace ID', type: 'text', required: true },
        { id: 'key', label: 'Key', type: 'text', required: true },
        { id: 'value', label: 'Value', type: 'textarea', required: true },
      ],
      run: putValue,
    },
    {
      id: 'delete_value',
      label: 'Delete value',
      fields: [
        { id: 'accountId', label: 'Account ID', type: 'text', required: true },
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'namespaceId', label: 'Namespace ID', type: 'text', required: true },
        { id: 'key', label: 'Key', type: 'text', required: true },
      ],
      run: deleteValue,
    },
  ],
};

registerForgeBlock(block);
export default block;
