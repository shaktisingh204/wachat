/**
 * Forge block: Modal Labs
 *
 * Trigger deployed Modal functions / web endpoints. Modal exposes per-app
 * HTTPS endpoints; we authenticate using `Modal-Key` + `Modal-Secret` headers
 * (per Modal's API auth) and POST a JSON payload.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function modalHeaders(ctx: ForgeActionContext): Record<string, string> {
  const tokenId = asString(ctx.options.tokenId);
  const tokenSecret = asString(ctx.options.tokenSecret);
  if (!tokenId || !tokenSecret) throw new Error('Modal: tokenId and tokenSecret are required');
  return { 'Modal-Key': tokenId, 'Modal-Secret': tokenSecret };
}

function parseOptionalJson(input: unknown, label: string): unknown {
  const s = asString(input).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`Modal: ${label} must be valid JSON`);
  }
}

async function triggerEndpoint(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.endpointUrl);
  const payload = parseOptionalJson(ctx.options.payload, 'payload');
  if (!url) throw new Error('Modal: endpointUrl is required');
  const res = await apiRequest({
    service: 'Modal',
    method: 'POST',
    url,
    headers: modalHeaders(ctx),
    json: payload ?? {},
  });
  return { outputs: { response: res.data, status: res.status }, logs: [`Modal POST → ${url}`] };
}

async function getEndpoint(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.endpointUrl);
  if (!url) throw new Error('Modal: endpointUrl is required');
  const res = await apiRequest({
    service: 'Modal',
    method: 'GET',
    url,
    headers: modalHeaders(ctx),
  });
  return { outputs: { response: res.data, status: res.status }, logs: [`Modal GET → ${url}`] };
}

async function customRequest(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.endpointUrl);
  const method = (asString(ctx.options.method) || 'POST').toUpperCase();
  const payload = parseOptionalJson(ctx.options.payload, 'payload');
  if (!url) throw new Error('Modal: endpointUrl is required');
  const allowed = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const;
  if (!allowed.includes(method as typeof allowed[number])) {
    throw new Error(`Modal: unsupported method ${method}`);
  }
  const res = await apiRequest({
    service: 'Modal',
    method: method as typeof allowed[number],
    url,
    headers: modalHeaders(ctx),
    json: method === 'GET' ? undefined : payload ?? {},
  });
  return { outputs: { response: res.data, status: res.status }, logs: [`Modal ${method} → ${url}`] };
}

const block: ForgeBlock = {
  id: 'forge_modal_labs',
  name: 'Modal Labs',
  description: 'Invoke Modal-deployed functions via their HTTPS endpoints.',
  iconName: 'LuZap',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'trigger_endpoint',
      label: 'Trigger endpoint (POST)',
      fields: [
        { id: 'tokenId', label: 'Token ID', type: 'password', required: true },
        { id: 'tokenSecret', label: 'Token secret', type: 'password', required: true },
        { id: 'endpointUrl', label: 'Endpoint URL', type: 'text', required: true },
        { id: 'payload', label: 'Payload (JSON)', type: 'json' },
      ],
      run: triggerEndpoint,
    },
    {
      id: 'get_endpoint',
      label: 'Call endpoint (GET)',
      fields: [
        { id: 'tokenId', label: 'Token ID', type: 'password', required: true },
        { id: 'tokenSecret', label: 'Token secret', type: 'password', required: true },
        { id: 'endpointUrl', label: 'Endpoint URL', type: 'text', required: true },
      ],
      run: getEndpoint,
    },
    {
      id: 'custom_request',
      label: 'Custom HTTP request',
      fields: [
        { id: 'tokenId', label: 'Token ID', type: 'password', required: true },
        { id: 'tokenSecret', label: 'Token secret', type: 'password', required: true },
        { id: 'endpointUrl', label: 'Endpoint URL', type: 'text', required: true },
        { id: 'method', label: 'Method', type: 'select', options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PATCH', value: 'PATCH' },
          { label: 'PUT', value: 'PUT' },
          { label: 'DELETE', value: 'DELETE' },
        ], defaultValue: 'POST' },
        { id: 'payload', label: 'Payload (JSON)', type: 'json' },
      ],
      run: customRequest,
    },
  ],
};

registerForgeBlock(block);
export default block;
