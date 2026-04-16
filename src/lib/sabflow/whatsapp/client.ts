/**
 * SabFlow — WhatsApp Business Cloud API client
 *
 * Thin wrapper over `fetch` for the Graph API.  No SDK dependency: we only
 * need the Send Message endpoint and the Webhook verify handshake, both of
 * which are simple HTTP calls.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

import 'server-only';

import type { WhatsAppMessage } from './types';

/** Graph API version used for all calls. */
const GRAPH_API_VERSION = 'v18.0';

/** Arguments to {@link sendMessage}. */
export interface SendMessageArgs {
  /** Recipient phone number in E.164 (no +). */
  to: string;
  /** Phone-number-ID associated with the sender. */
  phoneNumberId: string;
  /** Long-lived Bearer access token (plaintext — decrypt upstream). */
  accessToken: string;
  /** The discriminated-union message payload. */
  message: WhatsAppMessage;
}

/** Successful send response (shape we surface to callers). */
export interface SendMessageResult {
  messageId: string;
}

/** Shape of the relevant fields of the Graph API response. */
interface GraphSendMessageResponse {
  messaging_product?: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
  error?: {
    message: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Error thrown when the Graph API returns a non-2xx response or an
 * `error` body.  Includes the HTTP status + Graph error details.
 */
export class WhatsAppApiError extends Error {
  readonly status: number;
  readonly code?: number;
  readonly subcode?: number;
  readonly fbtraceId?: string;

  constructor(
    message: string,
    opts: { status: number; code?: number; subcode?: number; fbtraceId?: string },
  ) {
    super(message);
    this.name = 'WhatsAppApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.subcode = opts.subcode;
    this.fbtraceId = opts.fbtraceId;
  }
}

/**
 * POST a message to the WhatsApp Cloud API.  Returns the outbound message ID
 * on success; throws {@link WhatsAppApiError} on failure.
 */
export async function sendMessage(args: SendMessageArgs): Promise<SendMessageResult> {
  const { to, phoneNumberId, accessToken, message } = args;

  if (!to) throw new TypeError('sendMessage: `to` is required');
  if (!phoneNumberId) throw new TypeError('sendMessage: `phoneNumberId` is required');
  if (!accessToken) throw new TypeError('sendMessage: `accessToken` is required');

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
    phoneNumberId,
  )}/messages`;

  const body = {
    messaging_product: 'whatsapp' as const,
    recipient_type: 'individual' as const,
    to,
    ...message,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      // Graph API is external — do not cache.
      cache: 'no-store',
    });
  } catch (err) {
    throw new WhatsAppApiError(
      `Network error calling WhatsApp API: ${(err as Error).message}`,
      { status: 0 },
    );
  }

  let data: GraphSendMessageResponse;
  try {
    data = (await res.json()) as GraphSendMessageResponse;
  } catch {
    throw new WhatsAppApiError(
      `Invalid JSON response from WhatsApp API (HTTP ${res.status})`,
      { status: res.status },
    );
  }

  if (!res.ok || data.error) {
    const errMsg = data.error?.message ?? `HTTP ${res.status}`;
    throw new WhatsAppApiError(errMsg, {
      status: res.status,
      code: data.error?.code,
      subcode: data.error?.error_subcode,
      fbtraceId: data.error?.fbtrace_id,
    });
  }

  const messageId = data.messages?.[0]?.id;
  if (!messageId) {
    throw new WhatsAppApiError('WhatsApp API response missing message id', {
      status: res.status,
    });
  }

  return { messageId };
}
