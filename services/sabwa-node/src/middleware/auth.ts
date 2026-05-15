/**
 * Service-token middleware.
 *
 * Every `/v1/*` route requires the shared `X-Sabwa-Service-Token` header to
 * match `process.env.SABWA_ENGINE_TOKEN`. This is the same contract the Rust
 * engine enforced in `auth.rs::require_service_token`, so the Next.js
 * `engineFetch` client keeps working unchanged.
 *
 * Uses a constant-time comparison to avoid timing oracles on the token.
 */

import type { NextFunction, Request, Response } from 'express';
import type { AppState } from '../state.js';

const HEADER = 'x-sabwa-service-token';

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Build a service-token middleware bound to `state.config.serviceToken`. */
export function requireServiceToken(state: AppState) {
  const expected = state.config.serviceToken;
  return function serviceTokenMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const provided = req.header(HEADER);
    if (!provided || !constantTimeEqual(provided, expected)) {
      res.status(401).json({
        error: 'missing or invalid service token',
        code: 'unauthorized',
      });
      return;
    }
    next();
  };
}
