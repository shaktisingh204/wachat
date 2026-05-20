/**
 * Forge block: HTTP Request
 *
 * Source: n8n-master/packages/nodes-base/nodes/HttpRequest/HttpRequest.node.ts
 *         (the V3 description lives in HttpRequest/V3/HttpRequestV3.node.ts —
 *         we cherry-pick the shape that's most useful in a flow).
 * Credential type: none — auth happens via headers the user enters.
 *
 * Operations covered:
 *   - request — generic call (method + url + headers + body)
 *
 * Body shapes: none / json / text / form (application/x-www-form-urlencoded).
 *
 * Out of scope for the first port:
 *   - OAuth2 / digest auth blocks (use HTTP Header Auth credential from Connections instead)
 *   - Multipart file upload (binary refs not yet exposed in ForgeActionContext)
 *   - Built-in retry/redirect tuning (handled by SabFlow engine runWithRetry already)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
  ForgeKeyValuePair,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function pairsToRecord(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(raw)) return out;
  for (const pair of raw as ForgeKeyValuePair[]) {
    if (!pair?.key) continue;
    out[pair.key] = asString(pair.value);
  }
  return out;
}

function buildHeaders(ctx: ForgeActionContext): Record<string, string> {
  const headers: Record<string, string> = {};
  const raw = ctx.options.headers as ForgeKeyValuePair[] | undefined;
  if (Array.isArray(raw)) {
    for (const pair of raw) {
      if (!pair?.key) continue;
      headers[pair.key] = asString(pair.value);
    }
  }
  return headers;
}

async function doRequest(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const method = (asString(ctx.options.method) || 'GET').toUpperCase() as
    | 'GET'
    | 'POST'
    | 'PATCH'
    | 'PUT'
    | 'DELETE'
    | 'HEAD';
  const url = asString(ctx.options.url);
  if (!url) throw new Error('HTTP Request: url is required');

  const bodyType = asString(ctx.options.bodyType) || 'none';
  const headers = buildHeaders(ctx);

  let json: unknown;
  let body: string | undefined;
  if (bodyType === 'json') {
    const raw = asString(ctx.options.jsonBody);
    if (raw) {
      try {
        json = JSON.parse(raw);
      } catch (err) {
        throw new Error(`HTTP Request: JSON body is not valid JSON — ${(err as Error).message}`);
      }
    }
  } else if (bodyType === 'text') {
    body = asString(ctx.options.textBody);
  } else if (bodyType === 'form') {
    // n8n's `form-urlencoded` body type — URLSearchParams encodes keys/values
    // and we tag the content-type so the receiver parses it correctly.
    const pairs = pairsToRecord(ctx.options.formBody);
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(pairs)) sp.append(k, v);
    body = sp.toString();
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }

  const res = await apiRequest({
    service: 'HTTP Request',
    method,
    url,
    headers,
    json,
    body,
    throwOnError: false,
  });

  return {
    outputs: {
      status: res.status,
      ok: res.ok,
      data: res.data,
    },
    logs: [`${method} ${url} → ${res.status}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_http_request',
  name: 'HTTP Request',
  description: 'Make a request to any URL with custom headers and body.',
  iconName: 'LuGlobe',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'request',
      label: 'Send request',
      description: 'Generic HTTP request. Use headers for auth.',
      fields: [
        {
          id: 'method',
          label: 'Method',
          type: 'select',
          required: true,
          defaultValue: 'GET',
          options: [
            { label: 'GET', value: 'GET' },
            { label: 'POST', value: 'POST' },
            { label: 'PATCH', value: 'PATCH' },
            { label: 'PUT', value: 'PUT' },
            { label: 'DELETE', value: 'DELETE' },
            { label: 'HEAD', value: 'HEAD' },
          ],
        },
        { id: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://api.example.com/v1/things' },
        {
          id: 'headers',
          label: 'Headers',
          type: 'key-value-list',
          helperText: 'Sent with the request. Use one entry per header.',
        },
        {
          id: 'bodyType',
          label: 'Body type',
          type: 'select',
          defaultValue: 'none',
          options: [
            { label: 'None', value: 'none' },
            { label: 'JSON', value: 'json' },
            { label: 'Raw text', value: 'text' },
            { label: 'Form (URL-encoded)', value: 'form' },
          ],
        },
        {
          id: 'jsonBody',
          label: 'JSON body',
          type: 'json',
          placeholder: '{ "name": "value" }',
          showIf: { field: 'bodyType', equals: 'json' },
        },
        {
          id: 'textBody',
          label: 'Body',
          type: 'textarea',
          showIf: { field: 'bodyType', equals: 'text' },
        },
        {
          id: 'formBody',
          label: 'Form fields',
          type: 'key-value-list',
          showIf: { field: 'bodyType', equals: 'form' },
          helperText: 'Sent as application/x-www-form-urlencoded.',
        },
      ],
      run: doRequest,
    },
  ],
};

registerForgeBlock(block);
export default block;
