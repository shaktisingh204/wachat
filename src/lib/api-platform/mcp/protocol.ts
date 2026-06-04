/**
 * SabNode MCP — Streamable-HTTP / JSON-RPC 2.0 protocol primitives.
 *
 * A small, dependency-free implementation of the slice of the Model
 * Context Protocol we need to expose SabNode modules to AI agents:
 * the *stateless* Streamable-HTTP transport (single `POST` carrying one
 * JSON-RPC request, notification, or batch thereof).
 *
 * We deliberately avoid the official `@modelcontextprotocol/sdk` here —
 * its server transports are built around Node's `IncomingMessage` /
 * `ServerResponse`, whereas our Route Handlers run on the Web
 * `Request`/`Response` types. Hand-rolling the handful of methods an
 * MCP host actually calls (`initialize`, `tools/list`, `tools/call`,
 * `ping`) keeps this faithful to the repo's own
 * "build-your-own-primitive" style — see `src/lib/api-platform/*` — and
 * leaves auth, rate-limiting and tenancy in the hands of the existing
 * developer-platform plumbing.
 *
 * Server-agnostic: nothing in here touches Mongo, Rust, or `next/*`.
 */

/* ── Protocol version negotiation ─────────────────────────────────────────── */

/**
 * Revisions we can speak, newest first. During `initialize` we echo the
 * client's requested version when we support it, otherwise we answer
 * with {@link LATEST_PROTOCOL_VERSION} and let the client decide whether
 * to proceed (per the MCP spec).
 */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const;

export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export function negotiateProtocolVersion(requested: unknown): string {
  if (typeof requested === 'string' && (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)) {
    return requested;
  }
  return LATEST_PROTOCOL_VERSION;
}

/* ── JSON-RPC 2.0 wire types ──────────────────────────────────────────────── */

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcErrorBody {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcFailure {
  jsonrpc: '2.0';
  id: JsonRpcId;
  error: JsonRpcErrorBody;
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

/** Standard JSON-RPC 2.0 error codes (plus the MCP reserved range). */
export const RpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;

/* ── Constructors ─────────────────────────────────────────────────────────── */

export function rpcSuccess(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: '2.0', id, result };
}

export function rpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcFailure {
  const error: JsonRpcErrorBody = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id, error };
}

/**
 * A protocol-level error a method handler can throw to short-circuit
 * into a JSON-RPC `error` response. Tool *execution* failures should NOT
 * use this — those are surfaced in-band as `isError` tool results so the
 * calling model can read and react to them.
 */
export class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

/* ── Request classification ───────────────────────────────────────────────── */

/** A JSON-RPC message is a *notification* when it carries no `id`. */
export function isNotification(msg: JsonRpcRequest): boolean {
  return !('id' in msg) || msg.id === undefined;
}

export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as JsonRpcRequest).jsonrpc === '2.0' &&
    typeof (value as JsonRpcRequest).method === 'string'
  );
}

/* ── MCP tool content helpers ─────────────────────────────────────────────── */

export interface McpTextContent {
  type: 'text';
  text: string;
}

export interface McpToolResult {
  content: McpTextContent[];
  isError?: boolean;
  /** Optional machine-readable mirror of the content (MCP 2025-06-18+). */
  structuredContent?: unknown;
}

/** A successful tool result carrying a JSON payload (pretty-printed text + structured mirror). */
export function toolJson(payload: unknown): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload === undefined ? undefined : { data: payload },
  };
}

/** An in-band tool error — the model sees this and can retry/adjust. */
export function toolError(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}
