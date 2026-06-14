import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { apiError, readJsonBody, withSabsmsApi } from '@/lib/sabsms/apikeys/http';
import { verifyCheck } from '@/lib/sabsms/verify/orchestrator';

/**
 * Public API — `POST /api/v1/sms/verify/confirm` (V3.1, multi-channel).
 *
 * Validates a code against a `verificationId` from `verify/start`.
 * Constant-time compare, attempt-capped, TTL-aware, and idempotent once
 * verified. Maps the orchestrator status to an HTTP code so callers can
 * branch without parsing prose.
 */

const BODY = z
  .object({
    verificationId: z.string().min(8).max(64),
    code: z.string().min(3).max(12),
  })
  .strict();

const STATUS_HTTP: Record<string, number> = {
  verified: 200,
  already_verified: 200,
  invalid: 401,
  expired: 410,
  max_attempts: 429,
  not_found: 404,
};

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

  const result = await verifyCheck({
    workspaceId: auth.workspaceId,
    verificationId: body.data.verificationId,
    code: body.data.code.trim(),
  });

  return NextResponse.json(
    {
      status: result.status,
      verified: result.status === 'verified' || result.status === 'already_verified',
      ...(result.attemptsRemaining != null
        ? { attemptsRemaining: result.attemptsRemaining }
        : {}),
    },
    { status: STATUS_HTTP[result.status] ?? 400 },
  );
});
