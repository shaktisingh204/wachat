/**
 * `POST /api/v1/messages/send-text` — send a WhatsApp text message.
 *
 * Accepts either an existing `contactId` or the triple
 * (`waId`, `phoneNumberId`, `projectId`). When no `contactId` is supplied,
 * the Rust `wachat-contacts-resolve` endpoint resolves / creates the
 * contact under the calling tenant's project before the send is queued.
 *
 * All Rust calls go through `rustFetchAsUser` so project ownership is
 * enforced server-side — this handler trusts only the authenticated
 * tenant id from `ApiV1Context`.
 */

import 'server-only';

import { NextResponse } from 'next/server';

import type { ApiV1Handler } from '@/lib/api-platform';
import { ApiError } from '@/lib/api-platform';
import { rustFetchAsUser } from '@/lib/api-platform/rust-as-user';
import { RustApiError } from '@/lib/rust-client';
import type {
  ResolveContactResult,
  SendAck,
  SendMessageBody,
  SendMessageResult,
} from '@/lib/rust-client/whatsapp-send';

interface SendTextRequestBody {
  messageText?: unknown;
  contactId?: unknown;
  waId?: unknown;
  phoneNumberId?: unknown;
  projectId?: unknown;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export const sendText: ApiV1Handler = async (req, { ctx }) => {
  let raw: SendTextRequestBody;
  try {
    raw = (await req.json()) as SendTextRequestBody;
  } catch {
    throw ApiError.validationFailed([{ path: 'body', message: 'Invalid JSON body' }]);
  }

  const messageText = asString(raw.messageText);
  if (!messageText) {
    throw ApiError.validationFailed([{ path: 'messageText', message: 'messageText is required' }]);
  }

  let finalContactId = asString(raw.contactId);
  let finalProjectId = asString(raw.projectId);
  let finalPhoneNumberId = asString(raw.phoneNumberId);
  let finalWaId = asString(raw.waId);
  const userId = ctx.tenantId;

  if (!finalContactId) {
    if (!finalWaId || !finalPhoneNumberId || !finalProjectId) {
      throw ApiError.validationFailed([
        {
          path: 'body',
          message:
            'waId, phoneNumberId and projectId are required when contactId is not provided',
        },
      ]);
    }
    try {
      const resolved = await rustFetchAsUser<ResolveContactResult>(
        userId,
        '/v1/wachat/contacts/resolve',
        {
          method: 'POST',
          body: JSON.stringify({
            projectId: finalProjectId,
            phoneNumberId: finalPhoneNumberId,
            waId: finalWaId,
          }),
        },
      );
      finalContactId = resolved.id;
      finalProjectId = resolved.projectId;
      finalPhoneNumberId = resolved.phoneNumberId;
      finalWaId = resolved.waId;
    } catch (err) {
      if (err instanceof RustApiError) {
        throw new ApiError({
          type: 'server_error',
          status: err.status || 500,
          title: 'Contact resolution failed',
          detail: err.message,
        });
      }
      throw ApiError.serverError('Contact resolution failed', err);
    }
  }

  if (!finalContactId || !finalProjectId || !finalPhoneNumberId || !finalWaId) {
    throw ApiError.validationFailed([
      { path: 'body', message: 'Could not resolve contact for message send' },
    ]);
  }

  const sendBody: SendMessageBody = {
    kind: 'text',
    projectId: finalProjectId,
    contactId: finalContactId,
    phoneNumberId: finalPhoneNumberId,
    waId: finalWaId,
    messageText,
  };

  try {
    const result = await rustFetchAsUser<SendMessageResult & SendAck>(
      userId,
      '/v1/wachat/messages/send',
      { method: 'POST', body: JSON.stringify(sendBody) },
    );
    if (result.error) {
      throw ApiError.serverError(result.error);
    }
    return NextResponse.json({ success: true, message: result.message ?? 'Message sent successfully.' });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof RustApiError) {
      throw new ApiError({
        type: 'server_error',
        status: err.status || 500,
        title: 'WhatsApp send failed',
        detail: err.message,
      });
    }
    throw ApiError.serverError('WhatsApp send failed', err);
  }
};
