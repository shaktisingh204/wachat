import 'server-only';

import type { NextResponse } from 'next/server';

import { apiError } from '@/lib/sabsms/apikeys/http';
import { SabsmsEngineError } from '@/lib/sabsms/engine-client';

/**
 * Map engine OTP denials to the public `{ error: { code, message } }`
 * envelope. Engine 4xx outcomes (fraud_blocked / cooldown / rate_limited
 * / max_resends / suppressed) are expected API results — their codes are
 * passed through verbatim so integrators can branch on them.
 */
export function engineOtpError(err: unknown): NextResponse {
  if (err instanceof SabsmsEngineError) {
    const status = err.status >= 400 && err.status < 500 ? err.status : 502;
    const body = err.body as Record<string, unknown> | null;
    const code =
      body && typeof body === 'object' && typeof body.error === 'string'
        ? body.error
        : status === 502
          ? 'engine_unavailable'
          : 'otp_rejected';
    return apiError(code, err.message, status);
  }
  throw err;
}
