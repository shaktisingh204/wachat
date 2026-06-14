import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { apiError, readJsonBody, withSabsmsApi } from '@/lib/sabsms/apikeys/http';
import { verifyStart } from '@/lib/sabsms/verify/orchestrator';
import { pumpingGuard } from '@/lib/sabsms/governance/pumping-risk';

/**
 * Public API — `POST /api/v1/sms/verify/start` (V3.1, multi-channel).
 *
 * Unlike the SMS-only `verify/send` (a thin wrapper over the engine OTP),
 * this drives the Next-side Verify orchestrator: it generates a code and
 * delivers it over the first working channel in `channels`
 * (SMS → WhatsApp → voice → email by default), inheriting the one
 * compliance gate and the cross-tenant pumping guard. Returns an opaque
 * `verificationId` to pass back to `verify/confirm`.
 */

const CHANNEL = z.enum(['sms', 'mms', 'rcs', 'whatsapp', 'voice', 'email']);

const BODY = z
  .object({
    to: z.string().min(4).max(32).optional(),
    email: z.string().email().max(254).optional(),
    channels: z.array(CHANNEL).min(1).max(6).optional(),
    brand: z.string().max(64).optional(),
    from: z.string().max(254).optional(),
    whatsappTemplateId: z.string().max(128).optional(),
    codeLength: z.number().int().min(4).max(10).optional(),
    ttlSecs: z.number().int().min(30).max(3600).optional(),
    maxAttempts: z.number().int().min(1).max(10).optional(),
    contactId: z.string().max(64).optional(),
  })
  .strict()
  .refine((b) => Boolean(b.to || b.email), {
    message: 'one of "to" (E.164) or "email" is required',
  });

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

  const d = body.data;
  const result = await verifyStart(
    {
      workspaceId: auth.workspaceId,
      recipient: { e164: d.to?.trim(), email: d.email?.trim(), contactId: d.contactId },
      channelOrder: d.channels,
      brand: d.brand,
      from: d.from,
      whatsappTemplateId: d.whatsappTemplateId,
      codeLength: d.codeLength,
      ttlSecs: d.ttlSecs,
      maxAttempts: d.maxAttempts,
    },
    { pumpingGuard },
  );

  if (result.blockedReason) {
    return NextResponse.json(
      {
        error: { code: 'blocked', message: `Verification blocked: ${result.blockedReason}` },
        verificationId: result.verificationId,
      },
      { status: 403 },
    );
  }
  if (!result.delivered) {
    return NextResponse.json(
      {
        error: { code: 'delivery_failed', message: 'No configured channel could deliver the code.' },
        verificationId: result.verificationId,
        channelsTried: result.channelsTried,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    verificationId: result.verificationId,
    channelUsed: result.channelUsed,
    channelsTried: result.channelsTried,
  });
});
