/**
 * SabNode MCP endpoint — SabCRM.
 *
 *   POST /api/mcp/sabcrm
 *
 * A stateless Streamable-HTTP MCP server exposing the workspace's SabCRM
 * (objects, records, search, pipelines + gated stage moves, activity
 * timelines) as agent tools. Authentication reuses the developer
 * platform: send a SabNode API key as `Authorization: Bearer <key>`
 * (or `X-Api-Key`). The key must hold a `sabcrm:read` or `sabcrm:write`
 * scope to reach the server; per-tool scope is enforced again at call
 * time inside the dispatcher, and every tool's required `projectId` is
 * validated against the key owner's project membership.
 *
 * Transport notes: this is the *stateless* JSON variant of Streamable
 * HTTP — every call is a self-contained POST and the response is plain
 * `application/json`. We do not open SSE streams (no server-initiated
 * messages), so GET/DELETE return 405, which compliant clients tolerate.
 *
 * Smoke test (running server):
 *
 *   curl -sS -X POST http://localhost:9002/api/mcp/sabcrm \
 *     -H 'Authorization: Bearer <api-key>' -H 'Content-Type: application/json' \
 *     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}'
 *
 * or `node scripts/sabcrm-mcp-smoke.mjs` (see its header).
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';

import { verifyApiKey, requireScope } from '@/lib/api-platform/auth';
import { consumeToken, rateLimitHeaders } from '@/lib/api-platform/rate-limit';
import { ApiError } from '@/lib/api-platform/errors';
import {
  LATEST_PROTOCOL_VERSION,
  RpcErrorCode,
  isJsonRpcRequest,
  rpcError,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from '@/lib/api-platform/mcp/protocol';
import { dispatchSabcrmMcp } from '@/lib/api-platform/mcp/sabcrm-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ── CORS (lets in-app, browser-side agents reach the endpoint) ───────────── */

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Api-Key, MCP-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'MCP-Protocol-Version, X-Request-Id',
};

function baseHeaders(requestId: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...CORS_HEADERS,
    'MCP-Protocol-Version': LATEST_PROTOCOL_VERSION,
    'X-Request-Id': requestId,
    ...extra,
  };
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** GET/DELETE imply the SSE / session transports we don't run statelessly. */
function methodNotAllowed(): Response {
  return NextResponse.json(
    { jsonrpc: '2.0', id: null, error: { code: RpcErrorCode.InvalidRequest, message: 'Method Not Allowed. Use POST.' } },
    { status: 405, headers: { ...CORS_HEADERS, Allow: 'POST, OPTIONS' } },
  );
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;

/* ── POST: the JSON-RPC entrypoint ────────────────────────────────────────── */

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = req.headers.get('x-request-id')?.slice(0, 128) || `req_${randomUUID()}`;

  // 1. Authenticate via API key.
  const ctx = await verifyApiKey(req);
  if (!ctx) {
    return ApiError.authRequired().toResponse(requestId);
  }

  // 2. Per-tier token-bucket rate limit (shared with the rest of /api/v1).
  const rl = await consumeToken(ctx.keyId, ctx.tier);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return ApiError.rateLimited('Tier rate limit exceeded', {
      ...rlHeaders,
      'retry-after': String(rl.resetSeconds),
    }).toResponse(requestId);
  }

  // 3. Plan gate: the key must carry at least one SabCRM scope to reach the
  //    server (keys only receive these scopes on plans that include SabCRM).
  if (!requireScope('sabcrm:read', ctx) && !requireScope('sabcrm:write', ctx)) {
    return ApiError.scopeMissing('sabcrm:read').toResponse(requestId);
  }

  // 4. Parse the JSON-RPC payload (single message or batch).
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, RpcErrorCode.ParseError, 'Invalid JSON.'), {
      status: 400,
      headers: baseHeaders(requestId, rlHeaders),
    });
  }

  const isBatch = Array.isArray(payload);
  const messages = (isBatch ? payload : [payload]) as unknown[];
  if (isBatch && messages.length === 0) {
    return NextResponse.json(rpcError(null, RpcErrorCode.InvalidRequest, 'Empty batch.'), {
      status: 400,
      headers: baseHeaders(requestId, rlHeaders),
    });
  }

  // 5. Dispatch each message; collect only the responses (notifications → none).
  const responses: JsonRpcResponse[] = [];
  for (const raw of messages) {
    if (!isJsonRpcRequest(raw)) {
      responses.push(rpcError(null, RpcErrorCode.InvalidRequest, 'Invalid JSON-RPC 2.0 message.'));
      continue;
    }
    const res = await dispatchSabcrmMcp(raw as JsonRpcRequest, ctx);
    if (res) responses.push(res);
  }

  // 6. If every message was a notification, there is nothing to return.
  if (responses.length === 0) {
    return new Response(null, { status: 202, headers: baseHeaders(requestId, rlHeaders) });
  }

  const body = isBatch ? responses : responses[0];
  return NextResponse.json(body, { status: 200, headers: baseHeaders(requestId, rlHeaders) });
}
