import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { apiError, readJsonBody, withSabsmsApi } from '@/lib/sabsms/apikeys/http';
import { sabsmsEngine } from '@/lib/sabsms/engine-client';

import { engineOtpError } from '../engine-errors';

/**
 * Public API — `POST /api/v1/sms/verify/send`.
 *
 * Thin wrapper over the engine's `POST /v1/otp/send` (fraud guard,
 * per-destination rate limits and resend cooldowns are engine-side).
 */

const BODY = z.object({ to: z.string().min(4).max(32) }).strict();

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
    const result = await sabsmsEngine.otpSend({
      workspaceId: auth.workspaceId,
      to: body.data.to.trim(),
    });
    return NextResponse.json({
      otpId: result.otpId,
      expiresAt: result.expiresAt,
      resendAfter: result.resendAfter,
    });
  } catch (err) {
    return engineOtpError(err);
  }
});
