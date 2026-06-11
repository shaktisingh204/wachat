import 'server-only';

/**
 * Shared helpers for the SabPay public REST API routes (`/api/sabpay/v1/*`).
 *
 * Every entity route follows the same shape as `v1/payments/route.ts`:
 * verify the `sk_…` key, parse JSON, proxy to Rust acting as the merchant,
 * shape the response. These helpers remove the copy-paste so all routes stay
 * consistent (auth errors, Rust-error mapping, idempotency-key forwarding).
 */

import { createHash } from 'node:crypto';

import type { NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabpayApiError, verifySabpayApiKey, type SabpayApiContext } from './api-auth.server';

export { sabpayApiError };
export type { SabpayApiContext };

/** Verify the request's secret key, or return a 401 Response to send back. */
export async function requireSabpayKey(
  req: NextRequest,
): Promise<{ ctx: SabpayApiContext } | { error: Response }> {
  const ctx = await verifySabpayApiKey(req);
  if (!ctx) {
    return {
      error: sabpayApiError(
        401,
        'invalid_api_key',
        'Provide a valid secret key in the Authorization header: Bearer sk_test_… or sk_live_…',
      ),
    };
  }
  return { ctx };
}

/** Parse a JSON body, or return a 400 Response. */
export async function parseJsonBody(
  req: NextRequest,
): Promise<{ body: Record<string, unknown> } | { error: Response }> {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (body && typeof body === 'object') return { body };
    return { error: sabpayApiError(400, 'invalid_json', 'Request body must be a JSON object.') };
  } catch {
    return { error: sabpayApiError(400, 'invalid_json', 'Request body must be JSON.') };
  }
}

/** Map a thrown Rust error (or anything) to a Stripe-style error Response. */
export function fromRustError(err: unknown, fallback = 'Request failed.'): Response {
  if (err instanceof RustApiError) {
    const status = err.status >= 400 ? err.status : 400;
    const code = status >= 500 ? 'server_error' : status === 404 ? 'not_found' : 'invalid_request';
    return sabpayApiError(status, code, err.message);
  }
  return sabpayApiError(400, 'invalid_request', err instanceof Error ? err.message : fallback);
}

/** Forward the client's `Idempotency-Key` header (if any) to Rust. */
export function idempotencyHeaders(req: NextRequest): Record<string, string> {
  const key = req.headers.get('idempotency-key');
  return key ? { 'idempotency-key': key } : {};
}

/** Common query params for list endpoints (`?limit=&before=&status=`). */
export function listQuery(req: NextRequest): { limit: number; before?: string; status?: string } {
  const url = new URL(req.url);
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '25', 10) || 25;
  const before = url.searchParams.get('before') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  return { limit, before, status };
}

const IDEMPOTENCY_COLLECTION = 'sabpay_idempotency_keys';
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Enforce `Idempotency-Key` on a mutating public-API endpoint.
 *
 * The public REST API is the only external entry point (the Rust engine is
 * reachable only via Next-minted JWTs), so the merchant-facing idempotency
 * guarantee is enforced here, against the shared `sabpay_idempotency_keys`
 * collection (same shape + TTL/unique indexes the Rust crate defines).
 *
 * - No key → just run `op` (no idempotency).
 * - First-seen key → run `op`, persist its response, return it.
 * - Replay (same key + same request) → return the stored response verbatim.
 * - Same key + different body → `409 idempotency_key_reused`.
 * - Key still in flight → `409` (concurrent first request).
 *
 * `op` returns `{ status, body }`; thrown errors are mapped via `fromRustError`
 * and the pending row is released so the client can retry.
 */
export async function withIdempotency(
  req: NextRequest,
  ctx: SabpayApiContext,
  body: unknown,
  op: () => Promise<{ status: number; body: unknown }>,
  errorFallback = 'Request failed.',
): Promise<Response> {
  const key = req.headers.get('idempotency-key')?.trim();
  if (!key) {
    try {
      const r = await op();
      return Response.json(r.body, { status: r.status });
    } catch (err) {
      return fromRustError(err, errorFallback);
    }
  }

  const method = req.method;
  const path = new URL(req.url).pathname;
  const requestHash = createHash('sha256')
    .update(JSON.stringify(body ?? {}))
    .digest('hex');

  let coll;
  try {
    const { db } = await connectToDatabase();
    coll = db.collection(IDEMPOTENCY_COLLECTION);
  } catch {
    // If storage is unavailable, fall back to running without the guarantee
    // rather than failing the request outright.
    try {
      const r = await op();
      return Response.json(r.body, { status: r.status });
    } catch (err) {
      return fromRustError(err, errorFallback);
    }
  }

  const filter = { userId: ctx.userId, key, method, path };
  const existing = await coll.findOne(filter);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      return sabpayApiError(
        409,
        'idempotency_key_reused',
        'The same Idempotency-Key was used with a different request.',
      );
    }
    if (typeof existing.status === 'number' && existing.status > 0 && existing.responseBody) {
      return new Response(existing.responseBody as string, {
        status: existing.status,
        headers: { 'content-type': 'application/json' },
      });
    }
    return sabpayApiError(409, 'request_in_progress', 'A request with this Idempotency-Key is still being processed.');
  }

  try {
    await coll.insertOne({
      userId: ctx.userId,
      mode: ctx.mode,
      key,
      method,
      path,
      requestHash,
      status: 0,
      responseBody: '',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
    });
  } catch {
    // Lost the race to a concurrent first request (unique index).
    return sabpayApiError(409, 'request_in_progress', 'A request with this Idempotency-Key is still being processed.');
  }

  try {
    const r = await op();
    const responseBody = JSON.stringify(r.body);
    await coll.updateOne(filter, { $set: { status: r.status, responseBody } });
    return new Response(responseBody, {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    // Release the pending row so the client may retry.
    await coll.deleteOne(filter).catch(() => {});
    return fromRustError(err, errorFallback);
  }
}
