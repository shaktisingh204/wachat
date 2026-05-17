/**
 * `POST /api/v1/sms/send-template` — send a DLT-approved template SMS.
 *
 * `variables` may be a string-keyed object (named) or an array (positional).
 * Values are coerced to strings; ordering follows insertion order in the
 * object case.
 */

import 'server-only';

import { NextResponse } from 'next/server';

import type { ApiV1Handler } from '@/lib/api-platform';
import { ApiError } from '@/lib/api-platform';
import { sendTemplateSms as sendTemplateSmsService } from '@/lib/sms/services/messaging.service';

interface SmsTemplateRequestBody {
  recipient?: unknown;
  dltTemplateId?: unknown;
  headerId?: unknown;
  variables?: unknown;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function coerceVariables(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === 'object') return Object.values(value).map((v) => String(v));
  return [];
}

export const sendTemplateSms: ApiV1Handler = async (req, { ctx }) => {
  let raw: SmsTemplateRequestBody;
  try {
    raw = (await req.json()) as SmsTemplateRequestBody;
  } catch {
    throw ApiError.validationFailed([{ path: 'body', message: 'Invalid JSON body' }]);
  }

  const recipient = asString(raw.recipient);
  const dltTemplateId = asString(raw.dltTemplateId);
  if (!recipient || !dltTemplateId) {
    throw ApiError.validationFailed([
      { path: 'recipient', message: !recipient ? 'recipient is required' : '' },
      { path: 'dltTemplateId', message: !dltTemplateId ? 'dltTemplateId is required' : '' },
    ].filter((e) => e.message));
  }

  const headerId = asString(raw.headerId);
  const variableValues = coerceVariables(raw.variables);

  try {
    const result = await sendTemplateSmsService({
      userId: ctx.tenantId,
      recipient,
      dltTemplateId,
      headerId,
      variableValues,
    });
    return NextResponse.json({
      success: true,
      message: result.message,
      messageId: result.messageId,
    });
  } catch (err) {
    throw ApiError.serverError(
      err instanceof Error ? err.message : 'SMS template send failed',
      err,
    );
  }
};
