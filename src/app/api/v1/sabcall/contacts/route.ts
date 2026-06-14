/**
 * SabNode Developer Platform — SabCall contacts REST resource.
 *
 *   GET  /api/v1/sabcall/contacts?projectId=&q=&limit=   (scope: calls:read)
 *   POST /api/v1/sabcall/contacts                        (scope: calls:write)
 *
 * Public REST surface for a workspace's SabCall contacts. Authentication reuses
 * the developer platform: send a SabNode API key as `Authorization: Bearer
 * <key>` (or `X-Api-Key`). The key must hold `calls:read` (GET) or `calls:write`
 * (POST). Mirrors the MCP route's verifyApiKey → consumeToken/rateLimitHeaders →
 * requireScope flow and the direct-Mongo data path scoped by
 * `{ userId: projectId }` (projectId is the SabCall workspace id string).
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';

import { verifyApiKey, requireScope } from '@/lib/api-platform/auth';
import { consumeToken, rateLimitHeaders } from '@/lib/api-platform/rate-limit';
import { ApiError } from '@/lib/api-platform/errors';
import { connectToDatabase } from '@/lib/mongodb';
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

  const q = url.searchParams.get('q')?.trim();
  const rawLimit = Number(url.searchParams.get('limit'));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 200) : 50;

  const filter: Record<string, unknown> = { userId: projectId };
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ];
  }

  const { db } = await connectToDatabase();
  const rows = await db
    .collection('sabcall_contacts')
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return jsonOk(
    { contacts: rows.map((r) => withStringId(r as { _id: unknown })) },
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

  let body: {
    projectId?: unknown;
    name?: unknown;
    phone?: unknown;
    email?: unknown;
    company?: unknown;
    vip?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return ApiError.validationFailed(
      [{ path: 'body', message: 'Invalid JSON body' }],
      'Request body must be valid JSON',
    ).toResponse(requestId);
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const email = typeof body.email === 'string' ? body.email : null;
  const company = typeof body.company === 'string' ? body.company : null;
  const vip = !!body.vip;

  const errors: Array<{ path: string; message: string }> = [];
  if (!projectId) errors.push({ path: 'projectId', message: 'projectId is required' });
  if (!name) errors.push({ path: 'name', message: 'name is required' });
  if (!phone) errors.push({ path: 'phone', message: 'phone is required' });
  if (errors.length) {
    return ApiError.validationFailed(errors).toResponse(requestId);
  }

  const now = new Date();
  const doc = {
    userId: projectId,
    name,
    phone,
    email,
    company,
    vip,
    tags: [] as string[],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  const { db } = await connectToDatabase();
  const res = await db.collection('sabcall_contacts').insertOne(doc as never);

  return jsonOk({ id: String(res.insertedId) }, requestId, rlHeaders, 201);
}
