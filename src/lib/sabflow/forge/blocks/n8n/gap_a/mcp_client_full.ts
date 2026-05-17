/**
 * Forge block: LangChain MCP Client (full).
 *
 * Superset of `langchain_misc/mcp_client.ts`. Implements the broader MCP REST
 * surface — list_tools, list_prompts, list_resources, call_tool, read_resource.
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

async function listGeneric(
  ctx: ForgeActionContext,
  segment: 'tools' | 'prompts' | 'resources',
): Promise<ForgeActionResult> {
  const server = normaliseServerUrl(ctx.options.server_url);
  const token = asString(ctx.options.auth_token);
  const res = await apiRequest({
    service: 'MCP',
    method: 'GET',
    url: `${server}/${segment}`,
    headers: authHeaders(token),
  });
  const body = res.data as Record<string, unknown>;
  const items = Array.isArray(body?.[segment])
    ? (body[segment] as unknown[])
    : Array.isArray(res.data)
      ? (res.data as unknown[])
      : [];
  return {
    outputs: { [segment]: items, count: items.length },
    logs: [`MCP list_${segment} → ${items.length}`],
  };
}

async function listTools(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return listGeneric(ctx, 'tools');
}
async function listPrompts(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return listGeneric(ctx, 'prompts');
}
async function listResources(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return listGeneric(ctx, 'resources');
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

async function readResource(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const server = normaliseServerUrl(ctx.options.server_url);
  const token = asString(ctx.options.auth_token);
  const uri = asString(ctx.options.uri);
  if (!uri) throw new Error('MCP: uri is required');
  const url = new URL(`${server}/resources/read`);
  url.searchParams.set('uri', uri);
  const res = await apiRequest({
    service: 'MCP',
    method: 'GET',
    url: url.toString(),
    headers: authHeaders(token),
  });
  return {
    outputs: { contents: res.data, status: res.status },
    logs: [`MCP read_resource "${uri}" → ${res.status}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_mcp_client_full',
  name: 'MCP Client (full)',
  description:
    'Full MCP HTTP client — list_tools/prompts/resources + call_tool + read_resource.',
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
      id: 'list_prompts',
      label: 'List prompts',
      fields: [
        { id: 'server_url', label: 'MCP server URL', type: 'text', required: true },
        { id: 'auth_token', label: 'Bearer token (optional)', type: 'password' },
      ],
      run: listPrompts,
    },
    {
      id: 'list_resources',
      label: 'List resources',
      fields: [
        { id: 'server_url', label: 'MCP server URL', type: 'text', required: true },
        { id: 'auth_token', label: 'Bearer token (optional)', type: 'password' },
      ],
      run: listResources,
    },
    {
      id: 'call_tool',
      label: 'Call tool',
      fields: [
        { id: 'server_url', label: 'MCP server URL', type: 'text', required: true },
        { id: 'auth_token', label: 'Bearer token (optional)', type: 'password' },
        { id: 'tool_name', label: 'Tool name', type: 'text', required: true },
        { id: 'args', label: 'Arguments (JSON object)', type: 'json', defaultValue: '{}' },
      ],
      run: callTool,
    },
    {
      id: 'read_resource',
      label: 'Read resource',
      fields: [
        { id: 'server_url', label: 'MCP server URL', type: 'text', required: true },
        { id: 'auth_token', label: 'Bearer token (optional)', type: 'password' },
        { id: 'uri', label: 'Resource URI', type: 'text', required: true },
      ],
      run: readResource,
    },
  ],
};

registerForgeBlock(block);
export default block;
