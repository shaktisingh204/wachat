/**
 * SabNode MCP — method dispatcher for the SabCall server.
 *
 * Maps a single parsed JSON-RPC message to its MCP response, scoped to the
 * authenticated developer-platform context. Auth, rate-limiting and HTTP
 * framing live in the Route Handler (`/api/mcp/sabcall`); this module is pure
 * protocol logic over the {@link SABCALL_TOOLS} registry. Mirrors
 * `./sabcrm-server.ts` one-to-one.
 */

import 'server-only';

import { z } from 'zod';

import { requireScope, type ApiAuthContext } from '../auth';
import {
  RpcError,
  RpcErrorCode,
  isNotification,
  negotiateProtocolVersion,
  rpcError,
  rpcSuccess,
  toolError,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './protocol';
import { SABCALL_TOOLS, SABCALL_TOOL_MAP, type McpTool } from './sabcall-tools';

export const SABCALL_MCP_SERVER_INFO = {
  name: 'sabnode-sabcall',
  title: 'SabNode SabCall',
  version: '1.0.0',
} as const;

const SERVER_INSTRUCTIONS =
  "Tools for this SabNode workspace's SabCall (cloud PBX): place outbound calls, " +
  'browse the call log, and manage contacts. Every tool requires a `projectId` — ' +
  'if you do not know it, ask the user for their SabCall project id. Placing a call ' +
  'requires the engine to be enabled and connected to Asterisk; if place_call returns ' +
  'an error about the engine, tell the user it must be enabled in their SabCall setup.';

function toolsForContext(ctx: ApiAuthContext): McpTool[] {
  return SABCALL_TOOLS.filter((t) => requireScope(t.scope, ctx));
}

function toInputSchema(tool: McpTool): Record<string, unknown> {
  const json = z.toJSONSchema(tool.schema, { target: 'draft-7', io: 'input' }) as Record<
    string,
    unknown
  >;
  if (json.type !== 'object') return { type: 'object', properties: {} };
  return json;
}

function describeTool(tool: McpTool) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: toInputSchema(tool),
  };
}

function handleInitialize(params: unknown) {
  const requested = (params as { protocolVersion?: unknown } | undefined)?.protocolVersion;
  return {
    protocolVersion: negotiateProtocolVersion(requested),
    capabilities: { tools: { listChanged: false } },
    serverInfo: SABCALL_MCP_SERVER_INFO,
    instructions: SERVER_INSTRUCTIONS,
  };
}

function handleToolsList(ctx: ApiAuthContext) {
  return { tools: toolsForContext(ctx).map(describeTool) };
}

async function handleToolsCall(ctx: ApiAuthContext, params: unknown) {
  const p = (params ?? {}) as { name?: unknown; arguments?: unknown };
  if (typeof p.name !== 'string') {
    throw new RpcError(RpcErrorCode.InvalidParams, 'tools/call requires a string `name`.');
  }

  const tool = SABCALL_TOOL_MAP.get(p.name);
  if (!tool || !requireScope(tool.scope, ctx)) {
    return toolError(
      `Tool "${p.name}" is not available for this API key.` +
        (tool ? ` It requires the "${tool.scope}" scope.` : ''),
    );
  }

  const parsed = tool.schema.safeParse(p.arguments ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return toolError(`Invalid arguments for ${tool.name}: ${issues}`);
  }

  const userId = ctx.userId ?? ctx.tenantId;
  return tool.run(userId, parsed.data);
}

export async function dispatchSabcallMcp(
  msg: JsonRpcRequest,
  ctx: ApiAuthContext,
): Promise<JsonRpcResponse | null> {
  const notification = isNotification(msg);
  const id = notification ? null : (msg.id ?? null);

  try {
    let result: unknown;
    switch (msg.method) {
      case 'initialize':
        result = handleInitialize(msg.params);
        break;
      case 'ping':
        result = {};
        break;
      case 'tools/list':
        result = handleToolsList(ctx);
        break;
      case 'tools/call':
        result = await handleToolsCall(ctx, msg.params);
        break;
      default:
        if (msg.method.startsWith('notifications/')) {
          return null;
        }
        if (notification) return null;
        return rpcError(id, RpcErrorCode.MethodNotFound, `Method not found: ${msg.method}`);
    }

    if (notification) return null;
    return rpcSuccess(id, result);
  } catch (err) {
    if (notification) return null;
    if (err instanceof RpcError) return rpcError(id, err.code, err.message, err.data);
    const message = err instanceof Error ? err.message : 'Internal error';
    return rpcError(id, RpcErrorCode.InternalError, message);
  }
}
