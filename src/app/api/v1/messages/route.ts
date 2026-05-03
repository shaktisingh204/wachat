/**
 * POST /api/v1/messages — send an outbound message via the channels
 * registry (Impl 11).
 *
 * Body:
 *   {
 *     channel: 'whatsapp' | 'sms' | 'email' | …,
 *     to: { contact_id, address },
 *     content: { kind: 'text', text: 'hi' } | …,
 *     idempotency_key?: string
 *   }
 *
 * Auth: API key with `messages:write`.
 *
 * Returns: 201 { message_id, provider_message_id?, status }
 *
 * Replays via the `Idempotency-Key` header (or `idempotency_key` body
 * field) are de-duped through `withIdempotency`.
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import {
  ApiError,
  withApiV1,
  withIdempotency,
} from '@/lib/api-platform';
import { getChannel } from '@/lib/channels/registry';
import type {
  Channel,
  ChannelCredentials,
  ContactRef,
  MessageContent,
  SendOptions,
} from '@/lib/channels/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ── Request shape ──────────────────────────────────────────────────────── */

interface SendBody {
  channel?: unknown;
  to?: unknown;
  content?: unknown;
  idempotency_key?: unknown;
  metadata?: unknown;
  thread_id?: unknown;
}

interface ToShape {
  address: string;
  contact_id?: string;
}

const SUPPORTED_CHANNELS: Channel[] = [
  'whatsapp',
  'sms',
  'email',
  'voice',
  'telegram',
  'instagram',
  'rcs',
  'imessage',
  'wechat',
  'line',
  'kakao',
  'discord',
  'webpush',
  'in-app',
];

function parseBody(raw: unknown): {
  channel: Channel;
  to: ToShape;
  content: MessageContent;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
  threadId?: string;
} {
  if (!raw || typeof raw !== 'object') {
    throw ApiError.validationFailed([{ path: 'body', message: 'Body must be a JSON object' }]);
  }
  const b = raw as SendBody;
  const errors: Array<{ path: string; message: string }> = [];

  if (typeof b.channel !== 'string' || !SUPPORTED_CHANNELS.includes(b.channel as Channel)) {
    errors.push({
      path: 'channel',
      message: `Unsupported channel; expected one of ${SUPPORTED_CHANNELS.join(', ')}`,
    });
  }
  let to: ToShape | undefined;
  if (!b.to || typeof b.to !== 'object') {
    errors.push({ path: 'to', message: 'Required object { address, contact_id? }' });
  } else {
    const t = b.to as { address?: unknown; contact_id?: unknown };
    if (typeof t.address !== 'string' || t.address.trim().length === 0) {
      errors.push({ path: 'to.address', message: 'Required non-empty string' });
    } else {
      to = {
        address: t.address.trim(),
        contact_id: typeof t.contact_id === 'string' ? t.contact_id : undefined,
      };
    }
  }
  let content: MessageContent | undefined;
  if (!b.content || typeof b.content !== 'object') {
    errors.push({ path: 'content', message: 'Required object { kind, text?, media?, raw? }' });
  } else {
    const c = b.content as Partial<MessageContent>;
    if (typeof c.kind !== 'string') {
      errors.push({ path: 'content.kind', message: 'Required string' });
    } else {
      content = {
        kind: c.kind,
        ...(typeof c.text === 'string' ? { text: c.text } : {}),
        ...(Array.isArray(c.media) ? { media: c.media } : {}),
        ...(c.raw && typeof c.raw === 'object' ? { raw: c.raw as Record<string, unknown> } : {}),
      };
    }
  }

  if (errors.length) throw ApiError.validationFailed(errors);

  return {
    channel: b.channel as Channel,
    to: to!,
    content: content!,
    idempotencyKey: typeof b.idempotency_key === 'string' ? b.idempotency_key : undefined,
    metadata:
      b.metadata && typeof b.metadata === 'object'
        ? Object.fromEntries(
            Object.entries(b.metadata as Record<string, unknown>).filter(
              ([, v]) => typeof v === 'string',
            ) as Array<[string, string]>,
          )
        : undefined,
    threadId: typeof b.thread_id === 'string' ? b.thread_id : undefined,
  };
}

/* ── Handler ────────────────────────────────────────────────────────────── */

export const POST = withApiV1(
  async (req: NextRequest, { ctx, requestId }) => {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw ApiError.validationFailed([{ path: 'body', message: 'Invalid JSON' }]);
    }

    const parsed = parseBody(raw);
    const idempotencyKey =
      req.headers.get('idempotency-key') ?? parsed.idempotencyKey ?? null;

    const adapter = getChannel(parsed.channel);
    if (!adapter) {
      throw ApiError.notFound(`Channel adapter not registered: ${parsed.channel}`);
    }

    const out = await withIdempotency(ctx.tenantId, idempotencyKey, raw, async () => {
      // NOTE: per-tenant credentials are loaded by the channels routing layer
      // in production; for the public API surface we pass the empty bag and
      // rely on the adapter to load creds from its own tenant store.
      const creds: ChannelCredentials = {};
      const to: ContactRef = {
        contactId: parsed.to.contact_id ?? '',
        tenantId: ctx.tenantId,
        address: parsed.to.address,
        channel: parsed.channel,
      };
      const opts: SendOptions = {
        ...(parsed.threadId ? { threadId: parsed.threadId } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
        ...(parsed.metadata ? { metadata: parsed.metadata } : {}),
      };
      const result = await adapter.send(creds, to, parsed.content, opts);
      return {
        status: 201,
        body: {
          message_id: result.messageId,
          provider_message_id: result.providerMessageId,
          status: result.status,
          channel: parsed.channel,
        },
      };
    });

    return new NextResponse(out.body, {
      status: out.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-request-id': requestId,
        ...out.headers,
      },
    });
  },
  { scope: 'messages:write' },
);
