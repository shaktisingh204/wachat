/**
 * SabNode MCP — method dispatcher for the Ad Manager server.
 *
 * Maps a single parsed JSON-RPC message to its MCP response, scoped to
 * the authenticated developer-platform context. Auth, rate-limiting and
 * HTTP framing live in the Route Handler; this module is pure protocol
 * logic over the {@link AD_MANAGER_TOOLS} registry and is unit-testable
 * without a request.
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
import { AD_MANAGER_TOOLS, AD_MANAGER_TOOL_MAP, type McpTool } from './ad-manager-tools';

export const MCP_SERVER_INFO = {
  name: 'sabnode-ad-manager',
  title: 'SabNode Meta Ad Manager',
  version: '1.0.0',
} as const;

const SERVER_INSTRUCTIONS =
  'Tools for managing Meta (Facebook/Instagram) ads in this SabNode workspace: ad accounts, ' +
  'campaigns, ad sets, ads, custom audiences, and performance insights. Newly created campaigns, ' +
  'ad sets and ads default to PAUSED — call update_entity_status with status ACTIVE to start delivery.';

/** Tools the calling key is allowed to see/use, given its granted scopes. */
function toolsForContext(ctx: ApiAuthContext): McpTool[] {
  return AD_MANAGER_TOOLS.filter((t) => requireScope(t.scope, ctx));
}

/** Serialise a tool's zod schema to the JSON Schema MCP hosts expect. */
function toInputSchema(tool: McpTool): Record<string, unknown> {
  const json = z.toJSONSchema(tool.schema, { target: 'draft-7', io: 'input' }) as Record<string, unknown>;
  // MCP requires an object schema at the top level.
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

/* ── Method handlers ──────────────────────────────────────────────────────── */

function handleInitialize(params: unknown) {
  const requested = (params as { protocolVersion?: unknown } | undefined)?.protocolVersion;
  return {
    protocolVersion: negotiateProtocolVersion(requested),
    capabilities: { tools: { listChanged: false } },
    serverInfo: MCP_SERVER_INFO,
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

  const tool = AD_MANAGER_TOOL_MAP.get(p.name);
  // Hide existence of out-of-scope tools behind the same "unavailable" result
  // we'd give for an unknown name, but keep it in-band so the model can adapt.
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

/* ── Public dispatcher ────────────────────────────────────────────────────── */

/**
 * Dispatch one JSON-RPC message. Returns the response object, or `null`
 * for notifications (which get no reply). Protocol errors are returned
 * as JSON-RPC `error` responses for requests, and swallowed for
 * notifications.
 */
export async function dispatchMcp(
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
          // Client → server notifications (e.g. notifications/initialized,
          // notifications/cancelled). Nothing to do; never reply.
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
