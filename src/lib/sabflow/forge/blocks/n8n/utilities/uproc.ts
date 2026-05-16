/**
 * Forge block: uProc
 *
 * Source: n8n-master/packages/nodes-base/nodes/UProc/UProc.node.ts
 * Auth: Basic (email:apiKey) inline as `password` fields.
 *
 * Operations covered:
 *   - tool.run     POST /process — run any uProc tool with parameters
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.uproc.io/api/v2/process';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const email = asString(ctx.options.email);
  const apiKey = asString(ctx.options.apiKey);
  if (!email) throw new Error('uProc: email is required');
  if (!apiKey) throw new Error('uProc: apiKey is required');
  const token = Buffer.from(`${email}:${apiKey}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

function parseJson(raw: unknown, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : fallback;
  } catch {
    throw new Error('uProc: parameters must be valid JSON');
  }
}

async function toolRun(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const tool = asString(ctx.options.toolId);
  if (!tool) throw new Error('uProc: toolId is required');
  const params = parseJson(ctx.options.params);
  const body = {
    processor: tool,
    params,
  };
  const res = await apiRequest({
    service: 'uProc',
    method: 'POST',
    url: API,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`uProc tool.run → ${tool}`] };
}

const block: ForgeBlock = {
  id: 'forge_uproc',
  name: 'uProc',
  description: 'Run uProc data-processing tools (email/phone validation, enrichments, more).',
  iconName: 'LuWrench',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'tool_run',
      label: 'Run tool',
      description: 'Execute a uProc tool by its processor id with input parameters.',
      fields: [
        { id: 'email', label: 'Account email', type: 'password', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        {
          id: 'toolId',
          label: 'Tool / processor id',
          type: 'text',
          required: true,
          placeholder: 'tools/email-check-existence',
        },
        {
          id: 'params',
          label: 'Parameters (JSON)',
          type: 'json',
          placeholder: '{ "email": "person@example.com" }',
          helperText: 'JSON object passed as `params` to the tool.',
        },
      ],
      run: toolRun,
    },
  ],
};

registerForgeBlock(block);
export default block;
