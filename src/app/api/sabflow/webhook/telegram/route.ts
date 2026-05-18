/**
 * SabFlow — Telegram Bot API receiver.
 *
 * POST /api/sabflow/webhook/telegram
 *
 * Authentication: Telegram echoes the bot-token-secret we set on
 * `setWebhook` back in `X-Telegram-Bot-Api-Secret-Token`. We verify it
 * matches the configured `SABFLOW_TELEGRAM_WEBHOOK_SECRET` env value via a
 * timing-safe compare.
 *
 * Telegram update payloads carry a numeric `update_id` — we use that as
 * the dedup hint alongside the SHA-256 fingerprint of the normalised body.
 *
 * Env:
 *   SABFLOW_TELEGRAM_WEBHOOK_SECRET — the secret_token registered with Telegram.
 */

import { NextResponse, type NextRequest, after } from 'next/server';
import {
  claimFingerprint,
  enqueueTriggerJobs,
  fingerprintPayload,
  timingSafeStringEqual,
} from '@/lib/sabflow/triggers/receiver';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

interface TelegramUpdate {
  update_id?: number;
  message?: { chat?: { id?: number | string }; from?: { id?: number | string }; text?: string; [k: string]: unknown };
  edited_message?: { chat?: { id?: number | string }; [k: string]: unknown };
  channel_post?: { chat?: { id?: number | string }; [k: string]: unknown };
  callback_query?: { id?: string; from?: { id?: number | string }; [k: string]: unknown };
  [k: string]: unknown;
}

function pickEventKind(update: TelegramUpdate): { appEvent: string; chatId?: string } {
  if (update.message) {
    return { appEvent: 'telegram.message', chatId: String(update.message.chat?.id ?? '') || undefined };
  }
  if (update.edited_message) {
    return { appEvent: 'telegram.edited_message', chatId: String(update.edited_message.chat?.id ?? '') || undefined };
  }
  if (update.channel_post) {
    return { appEvent: 'telegram.channel_post', chatId: String(update.channel_post.chat?.id ?? '') || undefined };
  }
  if (update.callback_query) {
    return { appEvent: 'telegram.callback_query' };
  }
  return { appEvent: 'telegram.update' };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expectedSecret = process.env.SABFLOW_TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error('[sabflow][telegram] SABFLOW_TELEGRAM_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  const presented = req.headers.get(SECRET_HEADER);
  if (!timingSafeStringEqual(presented, expectedSecret)) {
    return NextResponse.json({ error: 'invalid_secret' }, { status: 401 });
  }

  const rawBody = await req.text();
  if (!rawBody) return NextResponse.json({ ok: true }, { status: 200 });

  let update: TelegramUpdate;
  try {
    update = JSON.parse(rawBody) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  if (typeof update.update_id !== 'number') {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { appEvent, chatId } = pickEventKind(update);
  const payload = {
    body: update,
    chatId,
    receivedAt: new Date().toISOString(),
  };

  const fingerprint = fingerprintPayload('telegram', {
    updateId: update.update_id,
    chatId,
    appEvent,
  });

  after(async () => {
    try {
      const fresh = await claimFingerprint(fingerprint);
      if (!fresh) return;
      await enqueueTriggerJobs({
        source: 'telegram',
        // Telegram has no per-workspace externalId at the API level — the bot
        // identity is already implied by the per-deploy secret, so we leave
        // `externalId` undefined and let trigger rows match by chatId.
        hint: { chatId, appEvent },
        payload,
        fingerprint,
      });
    } catch (err) {
      console.error('[sabflow][telegram] enqueue error', err);
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
