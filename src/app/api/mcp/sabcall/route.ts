/**
 * SabNode MCP endpoint — SabCall (cloud PBX).
 *
 *   POST /api/mcp/sabcall
 *
 * A stateless Streamable-HTTP MCP server exposing the workspace's SabCall as
 * agent tools (place_call, list_calls, list_contacts, create_contact).
 * Authentication reuses the developer platform: send a SabNode API key as
 * `Authorization: Bearer <key>` (or `X-Api-Key`). The key must hold a
 * `calls:read` or `calls:write` scope; per-tool scope is enforced again inside
 * the dispatcher. Mirrors the Ad Manager / SabCRM MCP routes.
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
import { dispatchSabcallMcp } from '@/lib/api-platform/mcp/sabcall-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, X-Api-Key, MCP-Protocol-Version, Mcp-Session-Id',
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

function methodNotAllowed(): Response {
  return NextResponse.json(
    {
      jsonrpc: '2.0',
      id: null,
      error: { code: RpcErrorCode.InvalidRequest, message: 'Method Not Allowed. Use POST.' },
    },
    { status: 405, headers: { ...CORS_HEADERS, Allow: 'POST, OPTIONS' } },
  );
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = req.headers.get('x-request-id')?.slice(0, 128) || `req_${randomUUID()}`;

  const ctx = await verifyApiKey(req);
  if (!ctx) {
    return ApiError.authRequired().toResponse(requestId);
  }

  const rl = await consumeToken(ctx.keyId, ctx.tier);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return ApiError.rateLimited('Tier rate limit exceeded', {
      ...rlHeaders,
      'retry-after': String(rl.resetSeconds),
    }).toResponse(requestId);
  }

  // Plan gate: the key must carry at least one SabCall scope to reach the server.
  if (!requireScope('calls:read', ctx) && !requireScope('calls:write', ctx)) {
    return ApiError.scopeMissing('calls:read').toResponse(requestId);
  }

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

  const responses: JsonRpcResponse[] = [];
  for (const raw of messages) {
    if (!isJsonRpcRequest(raw)) {
      responses.push(rpcError(null, RpcErrorCode.InvalidRequest, 'Invalid JSON-RPC 2.0 message.'));
      continue;
    }
    const res = await dispatchSabcallMcp(raw as JsonRpcRequest, ctx);
    if (res) responses.push(res);
  }

  if (responses.length === 0) {
    return new Response(null, { status: 202, headers: baseHeaders(requestId, rlHeaders) });
  }

  const body = isBatch ? responses : responses[0];
  return NextResponse.json(body, { status: 200, headers: baseHeaders(requestId, rlHeaders) });
}
