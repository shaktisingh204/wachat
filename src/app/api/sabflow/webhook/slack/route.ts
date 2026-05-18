/**
 * SabFlow — Slack Events API receiver.
 *
 * POST /api/sabflow/webhook/slack
 *
 * Public endpoint — auth is performed via Slack's HMAC request signing:
 *   sig_basestring = `v0:${timestamp}:${raw_body}`
 *   expected       = `v0=${hmac_sha256(SLACK_SIGNING_SECRET, sig_basestring)}`
 *
 * Slack expects a response within 3 seconds, so all enqueue work runs in
 * `after()` and the response returns ASAP.
 *
 * Handles:
 *   - `url_verification` — echo the `challenge` token (one-time setup).
 *   - `event_callback`   — look up matching SabFlow triggers and enqueue.
 *
 * Env:
 *   SLACK_SIGNING_SECRET — required, the app's signing secret.
 */

import { NextResponse, type NextRequest, after } from 'next/server';
import crypto from 'node:crypto';
import {
  claimFingerprint,
  enqueueTriggerJobs,
  fingerprintPayload,
} from '@/lib/sabflow/triggers/receiver';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SLACK_REPLAY_WINDOW_SECONDS = 5 * 60;

interface SlackEnvelope {
  type?: string;
  challenge?: string;
  team_id?: string;
  api_app_id?: string;
  event?: {
    type?: string;
    channel?: string;
    channel_type?: string;
    user?: string;
    text?: string;
    ts?: string;
    event_ts?: string;
    [k: string]: unknown;
  };
  event_id?: string;
  event_time?: number;
  [k: string]: unknown;
}

function verifySlackSignature(secret: string, timestamp: string, body: string, signature: string): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  // Reject replays older than 5 minutes (Slack's recommended window).
  if (Math.abs(Date.now() / 1000 - ts) > SLACK_REPLAY_WINDOW_SECONDS) return false;
  const basestring = `v0:${timestamp}:${body}`;
  const expected = `v0=${crypto.createHmac('sha256', secret).update(basestring).digest('hex')}`;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error('[sabflow][slack] SLACK_SIGNING_SECRET is not configured');
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  const signature = req.headers.get('x-slack-signature') ?? '';
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? '';
  const body = await req.text();

  if (!verifySlackSignature(signingSecret, timestamp, body, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let envelope: SlackEnvelope;
  try {
    envelope = JSON.parse(body) as SlackEnvelope;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // URL verification challenge — return the token verbatim.
  if (envelope.type === 'url_verification' && typeof envelope.challenge === 'string') {
    return NextResponse.json({ challenge: envelope.challenge }, { status: 200 });
  }

  if (envelope.type !== 'event_callback' || !envelope.event) {
    // Acknowledge anything else so Slack stops retrying.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const event = envelope.event;
  const externalId = envelope.team_id;
  const chatId = event.channel;
  const appEvent = event.type ? `slack.${event.type}` : 'slack.message';

  const payload = {
    body: envelope,
    event,
    teamId: externalId,
    channelId: chatId,
    receivedAt: new Date().toISOString(),
  };

  const fingerprint = fingerprintPayload('slack', {
    eventId: envelope.event_id,
    ts: event.event_ts ?? event.ts,
    team: externalId,
    channel: chatId,
  });

  // Acknowledge now; do dedup + enqueue work after the response is flushed.
  after(async () => {
    try {
      const fresh = await claimFingerprint(fingerprint);
      if (!fresh) return;
      await enqueueTriggerJobs({
        source: 'slack',
        hint: { externalId, chatId, appEvent },
        payload,
        fingerprint,
      });
    } catch (err) {
      console.error('[sabflow][slack] enqueue error', err);
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
