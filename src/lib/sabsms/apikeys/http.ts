import 'server-only';

import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

import { checkRateLimit } from '@/lib/sabflow/apiRateLimit/store';

import { hasScope, type SabsmsApiScope } from './core';
import {
  authenticateApiKey,
  recordApiUsage,
  type AuthenticatedApiKey,
} from './store';

/**
 * SabSMS public API — route-handler glue (V2.13).
 *
 * Guard chain per request (API key ONLY — these routes never read the
 * session cookie):
 *
 *   1. `x-request-id` generated/propagated and echoed on every response
 *   2. `Authorization: Bearer sk_live_…` → [`authenticateApiKey`]
 *      (constant-time hash, revocation, IP allowlist)
 *   3. per-key rate limit via the SabFlow sliding-window store
 *      (`rateLimitPerMin` from the key doc; 429 + Retry-After)
 *   4. scope check (403 `scope_missing`)
 *   5. usage `$inc` into `sabsms_api_usage` (fire-and-forget)
 *
 * Errors: consistent `{ error: { code, message } }` JSON everywhere.
 */

export interface SabsmsApiContext<P extends Record<string, string> = Record<string, string>> {
  auth: AuthenticatedApiKey;
  requestId: string;
  params: P;
}

export type SabsmsApiHandler<P extends Record<string, string> = Record<string, string>> = (
  req: NextRequest,
  ctx: SabsmsApiContext<P>,
) => Promise<Response>;

interface RouteContext<P extends Record<string, string>> {
  params: Promise<P> | P;
}

export function apiError(
  code: string,
  message: string,
  status: number,
  extraHeaders: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: extraHeaders },
  );
}

function ensureRequestId(req: NextRequest): string {
  const incoming = req.headers.get('x-request-id');
  if (incoming && incoming.length <= 128) return incoming;
  return `req_${randomUUID()}`;
}

function setHeader(res: Response, key: string, value: string): Response {
  if (!res.headers.has(key)) res.headers.set(key, value);
  return res;
}

/** Wrap a Route Handler with the SabSMS public-API guard chain. */
export function withSabsmsApi<P extends Record<string, string> = Record<string, string>>(
  scope: SabsmsApiScope,
  handler: SabsmsApiHandler<P>,
): (req: NextRequest, routeCtx?: RouteContext<P>) => Promise<Response> {
  return async function wrapped(req: NextRequest, routeCtx?: RouteContext<P>): Promise<Response> {
    const requestId = ensureRequestId(req);
    const finish = (res: Response) => setHeader(res, 'x-request-id', requestId);

    try {
      const auth = await authenticateApiKey(req);
      if (!auth) {
        return finish(
          apiError(
            'auth_required',
            'Missing or invalid API key (Authorization: Bearer sk_live_… or sk_test_…)',
            401,
          ),
        );
      }

      // Per-key sliding-window rate limit. The hour cap is derived from
      // the minute cap so it never binds tighter than the configured rate.
      const rl = checkRateLimit(`sabsms:key:${auth.keyId}`, {
        maxPerMinute: auth.rateLimitPerMin,
        maxPerHour: auth.rateLimitPerMin * 60,
      });
      if (!rl.allowed) {
        return finish(
          apiError('rate_limited', 'Rate limit exceeded for this API key', 429, {
            'Retry-After': String(rl.retryAfterSeconds ?? 1),
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': '0',
          }),
        );
      }

      if (!hasScope(auth.scopes, scope)) {
        return finish(
          apiError('scope_missing', `This key is missing the required scope: ${scope}`, 403),
        );
      }

      // Usage sparkline counter — never blocks the request.
      void recordApiUsage(auth.keyId);

      const params = await resolveParams<P>(routeCtx);
      const res = await handler(req, { auth, requestId, params });
      setHeader(res, 'X-RateLimit-Limit', String(rl.limit));
      setHeader(res, 'X-RateLimit-Remaining', String(rl.remaining));
      // Honest labelling: every response says which mode the key is in.
      setHeader(res, 'X-Sabsms-Mode', auth.mode);
      return finish(res);
    } catch (err) {
      console.error('[sabsms/api] unhandled error', { requestId }, err);
      return finish(apiError('server_error', 'Internal server error', 500));
    }
  };
}

async function resolveParams<P extends Record<string, string>>(
  routeCtx: RouteContext<P> | undefined,
): Promise<P> {
  if (!routeCtx) return {} as P;
  const p = routeCtx.params;
  if (p && typeof (p as Promise<P>).then === 'function') return await (p as Promise<P>);
  return p as P;
}

/** Parse a JSON body, mapping malformed JSON to a 400 envelope. */
export async function readJsonBody(
  req: NextRequest,
): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false, res: apiError('validation_failed', 'Request body must be valid JSON', 400) };
  }
}
