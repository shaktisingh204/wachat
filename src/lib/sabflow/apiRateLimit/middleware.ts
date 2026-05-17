/**
 * Rate-limit middleware for SabFlow's v1 API routes.
 *
 * Usage in a route handler:
 *
 *   const auth = await authenticateApiRequest(req);
 *   if (auth instanceof NextResponse) return auth;
 *
 *   const limited = withRateLimit(req, auth.userId);
 *   if (limited) return limited;
 *
 *   ...
 *
 * The middleware short-circuits with a 429 NextResponse when the caller has
 * exceeded their per-minute or per-hour quota.  On success it returns
 * `null` and the handler continues normally.
 *
 * Limits and headers:
 *   - Default: 60 req/min, 1000 req/hour per key (see store.ts).
 *   - Response headers:
 *       X-RateLimit-Limit      — minute-window cap
 *       X-RateLimit-Remaining  — minute-window slots left (0 when blocked)
 *       Retry-After            — seconds until the next slot frees up
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  checkRateLimit,
  type RateLimitOptions,
} from './store';

/**
 * Throttle `req` by `key` (typically the resolved API-key userId).
 *
 * @returns `null` when the request is within quota; a fully-formed 429
 *   NextResponse otherwise.  Callers should return that response directly.
 */
export function withRateLimit(
  req: NextRequest,
  key: string,
  opts?: RateLimitOptions,
): NextResponse | null {
  void req; // reserved for future per-route customisation
  const result = checkRateLimit(key, opts);

  if (result.allowed) return null;

  const retryAfter = String(result.retryAfterSeconds ?? 1);
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      retryAfterSeconds: result.retryAfterSeconds ?? 1,
      limit: result.limit,
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'Retry-After': retryAfter,
      },
    },
  );
}
