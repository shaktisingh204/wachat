import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { apiError, readJsonBody, withSabsmsApi } from '@/lib/sabsms/apikeys/http';
import { sabsmsEngine } from '@/lib/sabsms/engine-client';

import { engineOtpError } from '../engine-errors';

/**
 * Public API — `POST /api/v1/sms/verify/check`.
 *
 * Thin wrapper over the engine's `POST /v1/otp/verify` (constant-time
 * compare engine-side; success consumes the code and records the
 * conversion the OTP router ranks on).
 */

const BODY = z
  .object({
    to: z.string().min(4).max(32),
    code: z.string().min(3).max(12),
  })
  .strict();

export const POST = withSabsmsApi('otp', async (req: NextRequest, { auth }) => {
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.res;

  const body = BODY.safeParse(parsed.body);
  if (!body.success) {
    const first = body.error.issues[0];
    return apiError(
      'validation_failed',
      `${first?.path?.join('.') || 'body'}: ${first?.message ?? 'invalid'}`,
      422,
    );
  }

  try {
    const result = await sabsmsEngine.otpVerify({
      workspaceId: auth.workspaceId,
      to: body.data.to.trim(),
      code: body.data.code.trim(),
    });
    return NextResponse.json({
      verified: result.verified,
      ...(result.reason ? { reason: result.reason } : {}),
    });
  } catch (err) {
    return engineOtpError(err);
  }
});
