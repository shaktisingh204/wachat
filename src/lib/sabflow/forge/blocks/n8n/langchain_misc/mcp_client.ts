/**
 * Forge block: LangChain MCP Client
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/mcp/
 *
 * Generic Model Context Protocol client over HTTP. Implements two actions:
 *   - `list_tools`: GET <server>/tools
 *   - `call_tool`: POST <server>/tools/<name> with JSON args
 *
 * Optional bearer token authentication. JSON-RPC-style servers may differ;
 * this block targets the simple REST-flavoured MCP HTTP transport.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function authHeaders(token: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normaliseServerUrl(raw: unknown): string {
  const s = asString(raw).trim().replace(/\/+$/, '');
  if (!s) throw new Error('MCP: server_url is required');
  return s;
}

async function listTools(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const server = normaliseServerUrl(ctx.options.server_url);
  const token = asString(ctx.options.auth_token);
  const res = await apiRequest({
    service: 'MCP',
    method: 'GET',
    url: `${server}/tools`,
    headers: authHeaders(token),
  });
  const body = res.data as { tools?: unknown };
  const tools = Array.isArray(body?.tools) ? body.tools : Array.isArray(res.data) ? (res.data as unknown[]) : [];
  return {
    outputs: { tools, count: tools.length },
    logs: [`MCP list_tools → ${tools.length} tool(s)`],
  };
}

function parseArgs(raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    throw new Error('args must be a JSON object');
  } catch (err) {
    throw new Error(`MCP: invalid args JSON — ${(err as Error).message}`);
  }
}

async function callTool(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const server = normaliseServerUrl(ctx.options.server_url);
  const token = asString(ctx.options.auth_token);
  const toolName = asString(ctx.options.tool_name);
  if (!toolName) throw new Error('MCP: tool_name is required');
  const args = parseArgs(ctx.options.args);

  const res = await apiRequest({
    service: 'MCP',
    method: 'POST',
    url: `${server}/tools/${encodeURIComponent(toolName)}`,
    headers: authHeaders(token),
    json: { arguments: args },
  });
  return {
    outputs: { result: res.data, status: res.status },
    logs: [`MCP call_tool "${toolName}" → ${res.status}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_mcp_client',
  name: 'MCP Client',
  description: 'Model Context Protocol client over HTTP — list_tools + call_tool.',
  iconName: 'LuPlug',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_tools',
      label: 'List tools',
      fields: [
        { id: 'server_url', label: 'MCP server URL', type: 'text', required: true, placeholder: 'https://mcp.example.com' },
        { id: 'auth_token', label: 'Bearer token (optional)', type: 'password' },
      ],
      run: listTools,
    },
    {
      id: 'call_tool',
      label: 'Call tool',
      fields: [
        { id: 'server_url', label: 'MCP server URL', type: 'text', required: true, placeholder: 'https://mcp.example.com' },
        { id: 'auth_token', label: 'Bearer token (optional)', type: 'password' },
        { id: 'tool_name', label: 'Tool name', type: 'text', required: true },
        { id: 'args', label: 'Arguments (JSON object)', type: 'json', defaultValue: '{}' },
      ],
      run: callTool,
    },
  ],
};

registerForgeBlock(block);
export default block;
