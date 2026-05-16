/**
 * Forge block: LangChain Tool — HTTP Request
 *
 * Source: @n8n/nodes-langchain/nodes/tools/ToolHttpRequest/
 *
 * Same wire-shape as `forge_http_request` but with a string-oriented output
 * (`text` + parsed `data`) tuned for LLM tool-call callers. Headers are an
 * inline JSON object — easier for an LLM to emit than a key-value list.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString, type HttpMethod } from '../_shared/http';

function parseHeaders(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) out[k] = asString(v);
    return out;
  } catch (err) {
    throw new Error(`HTTP Tool: headers must be valid JSON — ${(err as Error).message}`);
  }
}

async function request(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url).trim();
  if (!url) throw new Error('HTTP Tool: url is required');

  const method = (asString(ctx.options.method) || 'GET').toUpperCase() as HttpMethod;
  const headers = parseHeaders(asString(ctx.options.headers));
  const bodyRaw = asString(ctx.options.body);

  let json: unknown;
  let body: string | undefined;
  if (bodyRaw) {
    try {
      json = JSON.parse(bodyRaw);
    } catch {
      body = bodyRaw;
    }
  }

  const res = await apiRequest({
    service: 'HTTP Tool',
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
      text: res.text,
    },
    logs: [`HTTP Tool ${method} ${url} → ${res.status}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_tool_http_request',
  name: 'LangChain Tool — HTTP Request',
  description: 'LLM-friendly HTTP caller. Headers + body accepted as JSON strings.',
  iconName: 'LuGlobe',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'request',
      label: 'Send request',
      fields: [
        {
          id: 'method',
          label: 'Method',
          type: 'select',
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
        { id: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://api.example.com/things' },
        {
          id: 'headers',
          label: 'Headers (JSON object)',
          type: 'json',
          placeholder: '{ "Authorization": "Bearer …" }',
          helperText: 'A JSON object whose keys/values become request headers.',
        },
        {
          id: 'body',
          label: 'Body',
          type: 'textarea',
          placeholder: '{ "name": "value" }',
          helperText: 'Sent as JSON if it parses; otherwise as raw text.',
        },
      ],
      run: request,
    },
  ],
};

registerForgeBlock(block);
export default block;
