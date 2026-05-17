/**
 * Forge block: Upstash Redis (REST)
 *
 * Talk to an Upstash Redis instance via its REST endpoint. Common ops:
 * GET / SET / DEL / INCR / EXPIRE.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function endpoint(ctx: ForgeActionContext): string {
  const url = asString(ctx.options.restUrl);
  if (!url) throw new Error('Upstash Redis: restUrl is required');
  return url.replace(/\/$/, '');
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.restToken);
  if (!token) throw new Error('Upstash Redis: restToken is required');
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function get(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = asString(ctx.options.key);
  if (!key) throw new Error('Upstash Redis: key is required');
  const res = await apiRequest({
    service: 'Upstash Redis',
    method: 'GET',
    url: `${endpoint(ctx)}/get/${encodeURIComponent(key)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { value: res.data }, logs: [`Upstash GET ${key}`] };
}

async function set(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = asString(ctx.options.key);
  const value = asString(ctx.options.value);
  const ex = asString(ctx.options.exSeconds);
  if (!key) throw new Error('Upstash Redis: key is required');
  const path = ex
    ? `/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${encodeURIComponent(ex)}`
    : `/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
  const res = await apiRequest({
    service: 'Upstash Redis',
    method: 'POST',
    url: `${endpoint(ctx)}${path}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Upstash SET ${key}`] };
}

async function del(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = asString(ctx.options.key);
  if (!key) throw new Error('Upstash Redis: key is required');
  const res = await apiRequest({
    service: 'Upstash Redis',
    method: 'POST',
    url: `${endpoint(ctx)}/del/${encodeURIComponent(key)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { deleted: res.data }, logs: [`Upstash DEL ${key}`] };
}

async function incr(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = asString(ctx.options.key);
  if (!key) throw new Error('Upstash Redis: key is required');
  const res = await apiRequest({
    service: 'Upstash Redis',
    method: 'POST',
    url: `${endpoint(ctx)}/incr/${encodeURIComponent(key)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { value: res.data }, logs: [`Upstash INCR ${key}`] };
}

const block: ForgeBlock = {
  id: 'forge_upstash_redis',
  name: 'Upstash Redis',
  description: 'Read and write keys against an Upstash Redis REST endpoint.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'get',
      label: 'GET key',
      fields: [
        { id: 'restUrl', label: 'REST URL', type: 'text', required: true },
        { id: 'restToken', label: 'REST token', type: 'password', required: true },
        { id: 'key', label: 'Key', type: 'text', required: true },
      ],
      run: get,
    },
    {
      id: 'set',
      label: 'SET key',
      fields: [
        { id: 'restUrl', label: 'REST URL', type: 'text', required: true },
        { id: 'restToken', label: 'REST token', type: 'password', required: true },
        { id: 'key', label: 'Key', type: 'text', required: true },
        { id: 'value', label: 'Value', type: 'text', required: true },
        { id: 'exSeconds', label: 'TTL seconds', type: 'number' },
      ],
      run: set,
    },
    {
      id: 'del',
      label: 'DEL key',
      fields: [
        { id: 'restUrl', label: 'REST URL', type: 'text', required: true },
        { id: 'restToken', label: 'REST token', type: 'password', required: true },
        { id: 'key', label: 'Key', type: 'text', required: true },
      ],
      run: del,
    },
    {
      id: 'incr',
      label: 'INCR key',
      fields: [
        { id: 'restUrl', label: 'REST URL', type: 'text', required: true },
        { id: 'restToken', label: 'REST token', type: 'password', required: true },
        { id: 'key', label: 'Key', type: 'text', required: true },
      ],
      run: incr,
    },
  ],
};

registerForgeBlock(block);
export default block;
