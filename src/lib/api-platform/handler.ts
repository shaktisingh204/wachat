/**
 * SabNode Developer Platform — central Route Handler wrapper.
 *
 *   export const POST = withApiV1(
 *     async (req, { ctx }) => NextResponse.json({ ok: true }),
 *     { scope: 'messages:write', rateLimit: true },
 *   );
 *
 * The wrapper folds together the full guard chain that every `/api/v1/*`
 * endpoint repeats today:
 *   1. Generate / propagate an `x-request-id` header.
 *   2. Verify the bearer API key (or 401 with RFC 7807 problem-details).
 *   3. Apply the per-tier token bucket rate-limit (or 429 with rate-limit
 *      headers).
 *   4. Enforce the configured scope (or 403).
 *   5. Invoke the handler with `(req, { ctx, requestId, params })` and
 *      catch any throw.  `ApiError` instances are serialised to their
 *      problem-details body, anything else becomes 500.
 *   6. Attach `x-request-id` + rate-limit headers to every response.
 *
 * Structured logs are emitted at start, success and failure with the
 * request-id, tenant-id, scope and elapsed ms.
 */

import 'server-only';

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { verifyApiKey, requireScope, type ApiAuthContext } from './auth';
import { consumeToken, rateLimitHeaders } from './rate-limit';
import type { OAuthScope } from './types';
import { ApiError, isApiError } from './errors';

/* ── Types ──────────────────────────────────────────────────────────────── */

/**
 * Per-request context provided to user handlers.  All fields are guaranteed
 * to be present (auth has succeeded, rate-limit has passed, scope checks
 * have run).
 */
export interface ApiV1Context<P extends Record<string, string> = Record<string, string>> {
  /** Authenticated API context. */
  ctx: ApiAuthContext;
  /** Stable request id — already echoed in the response headers. */
  requestId: string;
  /** Rate-limit headers to attach to outbound responses. */
  rateLimitHeaders: Record<string, string>;
  /** Route segment params (Next.js dynamic segments).  Resolved from the
   * second arg to the Route Handler. */
  params: P;
}

/** Shape of the user handler invoked by the wrapper. */
export type ApiV1Handler<P extends Record<string, string> = Record<string, string>> = (
  req: NextRequest,
  ctx: ApiV1Context<P>,
) => Promise<Response | NextResponse>;

/** Configuration accepted by `withApiV1`. */
export interface WithApiV1Options {
  /** Required OAuth scope.  `'*'` accepts any scoped key. */
  scope: OAuthScope;
  /** When `false`, skip the rate-limiter (e.g. internal admin routes).  Default `true`. */
  rateLimit?: boolean;
}

/** Next.js Route Handler context (params is async since 15+). */
interface RouteContext<P extends Record<string, string>> {
  params: Promise<P> | P;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function ensureRequestId(req: NextRequest): string {
  const incoming = req.headers.get('x-request-id');
  if (incoming && incoming.length <= 128) return incoming;
  return `req_${randomUUID()}`;
}

/** Merge headers onto an arbitrary `Response`/`NextResponse`. */
function withHeaders(res: Response, extra: Record<string, string>): Response {
  for (const [k, v] of Object.entries(extra)) {
    if (!res.headers.has(k)) res.headers.set(k, v);
  }
  return res;
}

interface LogFields {
  requestId: string;
  method: string;
  path: string;
  scope: OAuthScope;
  tenantId?: string;
  status?: number;
  elapsedMs?: number;
  error?: string;
  problemType?: string;
}

function log(level: 'info' | 'warn' | 'error', msg: string, fields: LogFields): void {
  const payload = JSON.stringify({ level, msg, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(payload);
  else if (level === 'warn') console.warn(payload);
  else console.log(payload);
}

async function resolveParams<P extends Record<string, string>>(
  routeCtx: RouteContext<P> | undefined,
): Promise<P> {
  if (!routeCtx) return {} as P;
  const p = routeCtx.params;
  if (p && typeof (p as Promise<P>).then === 'function') {
    return await (p as Promise<P>);
  }
  return p as P;
}

/* ── Public wrapper ─────────────────────────────────────────────────────── */

/**
 * Wrap a Next.js Route Handler with the standard auth/rate-limit/error
 * envelope.  Returns a function whose signature matches Next.js Route
 * Handlers (`(req, ctx?) => Promise<Response>`).
 */
export function withApiV1<P extends Record<string, string> = Record<string, string>>(
  handler: ApiV1Handler<P>,
  options: WithApiV1Options,
): (req: NextRequest, routeCtx?: RouteContext<P>) => Promise<Response> {
  const { scope, rateLimit = true } = options;

  return async function wrapped(req: NextRequest, routeCtx?: RouteContext<P>): Promise<Response> {
    const start = Date.now();
    const requestId = ensureRequestId(req);
    const path = (() => {
      try {
        return new URL(req.url).pathname;
      } catch {
        return req.url;
      }
    })();

    const baseFields: LogFields = {
      requestId,
      method: req.method,
      path,
      scope,
    };

    log('info', 'api.v1.request_start', baseFields);

    try {
      /* 1. Auth */
      const ctx = await verifyApiKey(req);
      if (!ctx) {
        const apiErr = ApiError.authRequired();
        const res = apiErr.toResponse(requestId);
        log('warn', 'api.v1.auth_failed', {
          ...baseFields,
          status: apiErr.status,
          problemType: apiErr.type,
          elapsedMs: Date.now() - start,
        });
        return res;
      }
      baseFields.tenantId = ctx.tenantId;

      /* 2. Rate-limit */
      let rlHeaders: Record<string, string> = {};
      if (rateLimit) {
        const rl = await consumeToken(ctx.keyId, ctx.tier);
        rlHeaders = rateLimitHeaders(rl);
        if (!rl.allowed) {
          const apiErr = ApiError.rateLimited('Tier rate limit exceeded', {
            ...rlHeaders,
            'retry-after': String(rl.resetSeconds),
          });
          const res = apiErr.toResponse(requestId);
          log('warn', 'api.v1.rate_limited', {
            ...baseFields,
            status: apiErr.status,
            problemType: apiErr.type,
            elapsedMs: Date.now() - start,
          });
          return res;
        }
      }

      /* 3. Scope */
      if (!requireScope(scope, ctx)) {
        const apiErr = ApiError.scopeMissing(scope);
        apiErr.headers && Object.assign(apiErr.headers, rlHeaders);
        const res = apiErr.toResponse(requestId);
        log('warn', 'api.v1.scope_denied', {
          ...baseFields,
          status: apiErr.status,
          problemType: apiErr.type,
          elapsedMs: Date.now() - start,
        });
        return res;
      }

      /* 4. Resolve params + invoke */
      const params = await resolveParams<P>(routeCtx);
      const userRes = await handler(req, {
        ctx,
        requestId,
        rateLimitHeaders: rlHeaders,
        params,
      });

      const final = withHeaders(userRes, {
        'x-request-id': requestId,
        ...rlHeaders,
      });
      log('info', 'api.v1.request_ok', {
        ...baseFields,
        status: final.status,
        elapsedMs: Date.now() - start,
      });
      return final;
    } catch (err) {
      if (isApiError(err)) {
        const res = err.toResponse(requestId);
        log('warn', 'api.v1.api_error', {
          ...baseFields,
          status: err.status,
          problemType: err.type,
          error: err.message,
          elapsedMs: Date.now() - start,
        });
        return res;
      }
      const message = err instanceof Error ? err.message : String(err);
      const apiErr = ApiError.serverError('Unhandled exception', err);
      log('error', 'api.v1.unhandled', {
        ...baseFields,
        status: 500,
        error: message,
        elapsedMs: Date.now() - start,
      });
      return apiErr.toResponse(requestId);
    }
  };
}

/**
 * Helper to throw an `ApiError` from any handler-side body validation.
 * Throwing is preferred over returning a `Response` because the wrapper
 * applies the request-id + content-type headers automatically.
 */
export function abort(error: ApiError): never {
  throw error;
}
