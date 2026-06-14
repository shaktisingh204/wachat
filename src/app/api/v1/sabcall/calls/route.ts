/**
 * SabNode Developer Platform — SabCall calls REST resource.
 *
 *   GET  /api/v1/sabcall/calls?projectId=&limit=   (scope: calls:read)
 *   POST /api/v1/sabcall/calls                     (scope: calls:write)
 *
 * Public REST surface for a workspace's SabCall (cloud PBX) call log and
 * outbound origination. Authentication reuses the developer platform: send a
 * SabNode API key as `Authorization: Bearer <key>` (or `X-Api-Key`). The key
 * must hold `calls:read` (GET) or `calls:write` (POST). Mirrors the MCP route's
 * verifyApiKey → consumeToken/rateLimitHeaders → requireScope flow and the
 * direct-Mongo data path scoped by `{ userId: projectId }` (projectId is the
 * SabCall workspace id string).
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';

import { verifyApiKey, requireScope } from '@/lib/api-platform/auth';
import { consumeToken, rateLimitHeaders } from '@/lib/api-platform/rate-limit';
import { ApiError } from '@/lib/api-platform/errors';
import { connectToDatabase } from '@/lib/mongodb';
import { sabcallEngine } from '@/lib/sabcall/engine-client';
import type { ApiAuthContext } from '@/lib/api-platform/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Api-Key',
  'Access-Control-Expose-Headers': 'X-Request-Id',
};

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function requestIdOf(req: NextRequest): string {
  return req.headers.get('x-request-id')?.slice(0, 128) || `req_${randomUUID()}`;
}

function withStringId<T extends { _id: unknown }>(doc: T): T & { _id: string } {
  return { ...doc, _id: String(doc._id) } as T & { _id: string };
}

/**
 * Shared auth + rate-limit gate, mirroring the MCP route. Resolves to either an
 * authenticated context (with rate-limit headers to echo) or a ready Response to
 * return immediately.
 */
async function authorize(
  req: NextRequest,
  requestId: string,
): Promise<
  | { ok: true; ctx: ApiAuthContext; rlHeaders: Record<string, string> }
  | { ok: false; response: Response }
> {
  const ctx = await verifyApiKey(req);
  if (!ctx) {
    return { ok: false, response: ApiError.authRequired().toResponse(requestId) };
  }

  const rl = await consumeToken(ctx.keyId, ctx.tier);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return {
      ok: false,
      response: ApiError.rateLimited('Tier rate limit exceeded', {
        ...rlHeaders,
        'retry-after': String(rl.resetSeconds),
      }).toResponse(requestId),
    };
  }

  return { ok: true, ctx, rlHeaders };
}

function jsonOk(
  body: unknown,
  requestId: string,
  rlHeaders: Record<string, string>,
  status = 200,
): Response {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, ...rlHeaders, 'x-request-id': requestId },
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = requestIdOf(req);

  const auth = await authorize(req, requestId);
  if (!auth.ok) return auth.response;
  const { ctx, rlHeaders } = auth;

  if (!requireScope('calls:read', ctx)) {
    return ApiError.scopeMissing('calls:read').toResponse(requestId);
  }

  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId')?.trim();
  if (!projectId) {
    return ApiError.validationFailed(
      [{ path: 'projectId', message: 'projectId is required' }],
      'Missing required query parameter: projectId',
    ).toResponse(requestId);
  }

  const rawLimit = Number(url.searchParams.get('limit'));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 200) : 50;

  const { db } = await connectToDatabase();
  const rows = await db
    .collection('sabcall_calls')
    .find({ userId: projectId })
    .sort({ startedAt: -1 })
    .limit(limit)
    .toArray();

  return jsonOk(
    { calls: rows.map((r) => withStringId(r as { _id: unknown })) },
    requestId,
    rlHeaders,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = requestIdOf(req);

  const auth = await authorize(req, requestId);
  if (!auth.ok) return auth.response;
  const { ctx, rlHeaders } = auth;

  if (!requireScope('calls:write', ctx)) {
    return ApiError.scopeMissing('calls:write').toResponse(requestId);
  }

  let body: { projectId?: unknown; to?: unknown; callerId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return ApiError.validationFailed(
      [{ path: 'body', message: 'Invalid JSON body' }],
      'Request body must be valid JSON',
    ).toResponse(requestId);
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const to = typeof body.to === 'string' ? body.to.trim() : '';
  const callerId = typeof body.callerId === 'string' ? body.callerId : undefined;

  const errors: Array<{ path: string; message: string }> = [];
  if (!projectId) errors.push({ path: 'projectId', message: 'projectId is required' });
  if (!to) errors.push({ path: 'to', message: 'to is required' });
  if (errors.length) {
    return ApiError.validationFailed(errors).toResponse(requestId);
  }

  let channelId: string;
  try {
    const res = await sabcallEngine.originate({ tenant: projectId, to, callerId });
    channelId = res.channelId;
  } catch (e) {
    return NextResponse.json(
      {
        type: 'https://errors.sabnode.dev/v1/server_error',
        title: 'Call engine error',
        status: 502,
        detail: e instanceof Error ? e.message : 'Failed to place call',
        request_id: requestId,
      },
      {
        status: 502,
        headers: {
          ...CORS_HEADERS,
          ...rlHeaders,
          'content-type': 'application/problem+json; charset=utf-8',
          'x-request-id': requestId,
        },
      },
    );
  }

  return jsonOk({ channelId }, requestId, rlHeaders, 201);
}
