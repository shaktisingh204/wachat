/**
 * Service-token middleware.
 *
 * Validates the shared `X-Sabwa-Service-Token` request header against
 * `process.env.SABWA_ENGINE_TOKEN`. Returns HTTP 401 when the header is
 * missing or does not match. Mirrors the Rust engine's
 * `auth.rs::require_service_token` so the Next.js `engineFetch` client
 * keeps working unchanged.
 *
 * Uses a length-aware constant-time comparison to avoid timing oracles on
 * the token.
 */

import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const HEADER = 'x-sabwa-service-token';

/** Length-aware constant-time string compare. */
function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface ServiceTokenOptions {
  /** Defaults to `process.env.SABWA_ENGINE_TOKEN`. */
  token?: string;
}

/**
 * Build an Express middleware that enforces the service token.
 *
 * If no `token` is supplied, the env var is read at middleware-construction
 * time and the middleware throws on construction (not on each request) when
 * the env var is missing — surfacing misconfiguration at boot.
 */
export function requireServiceToken(opts: ServiceTokenOptions = {}) {
  const expected = opts.token ?? process.env.SABWA_ENGINE_TOKEN;
  if (!expected || expected.trim().length === 0) {
    throw new Error(
      'SABWA_ENGINE_TOKEN is required to mount the service-token middleware',
    );
  }
  const expectedTrimmed = expected;

  return function serviceTokenMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const provided = req.header(HEADER);
    if (!provided || !constantTimeEqual(provided, expectedTrimmed)) {
      res.status(401).json({
        error: 'missing or invalid service token',
        code: 'unauthorized',
      });
      return;
    }
    next();
  };
}
