/**
 * SabFlow — Internal receiver for SabWa (personal-WhatsApp) trigger events.
 *
 * POST /api/sabflow/internal/sabwa-trigger
 *
 * The `services/sabwa-node` Baileys service (the SabWa engine per CLAUDE.md)
 * forwards inbound message / chat events to this endpoint over the internal
 * network. Auth is a shared secret: the engine sends
 * `Authorization: Bearer <SABWA_INTERNAL_SECRET>` and we compare with a
 * timing-safe equality check.
 *
 * Payload shape (forward-decl, mirrors the engine's outbound bridge):
 *   {
 *     event:     "message" | "chat" | string,
 *     sessionId: string,                 // SabWa session = projectId scope
 *     userId?:   string,                 // owning project / user
 *     chatId?:   string,                 // WhatsApp jid
 *     messageId?: string,
 *     payload:   Record<string, unknown> // raw Baileys-shaped event
 *   }
 *
 * Env:
 *   SABWA_INTERNAL_SECRET — required, shared with services/sabwa-node.
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

interface SabwaTriggerBody {
  event?: string;
  sessionId?: string;
  userId?: string;
  chatId?: string;
  messageId?: string;
  payload?: Record<string, unknown>;
}

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  // Allow header alt for parity with sabwa-node's service-token convention.
  const alt = req.headers.get('x-sabwa-internal-secret');
  return alt ? alt.trim() : null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expectedSecret = process.env.SABWA_INTERNAL_SECRET;
  if (!expectedSecret) {
    console.error('[sabflow][sabwa-trigger] SABWA_INTERNAL_SECRET is not configured');
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  const presented = extractBearer(req);
  if (!timingSafeStringEqual(presented, expectedSecret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: SabwaTriggerBody;
  try {
    body = (await req.json()) as SabwaTriggerBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.event || !body.sessionId) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const appEvent = `sabwa.${body.event}`;
  const externalId = body.sessionId;
  const chatId = body.chatId;

  const payload = {
    body,
    event: body.event,
    sessionId: body.sessionId,
    userId: body.userId,
    chatId,
    messageId: body.messageId,
    receivedAt: new Date().toISOString(),
  };

  const fingerprint = fingerprintPayload('sabwa', {
    sessionId: externalId,
    chatId,
    messageId: body.messageId,
    appEvent,
  });

  after(async () => {
    try {
      const fresh = await claimFingerprint(fingerprint);
      if (!fresh) return;
      await enqueueTriggerJobs({
        source: 'sabwa',
        hint: { externalId, chatId, appEvent },
        payload,
        fingerprint,
      });
    } catch (err) {
      console.error('[sabflow][sabwa-trigger] enqueue error', err);
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
