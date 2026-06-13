/**
 * POST /api/sabmail/internal/bind-inbound
 *
 * Internal binding endpoint for the IMAP IDLE sync worker
 * (`src/workers/sabmail-sync.ts`). That worker runs under `tsx` as a standalone
 * process and CANNOT import the `server-only` binder directly, so when it
 * discovers new mail it POSTs the sender/subject here and this route runs the
 * shared {@link bindInboundMessage} (conversation + screener + rules, engine-
 * first, plus the `inbound_email` journey trigger).
 *
 * Auth mirrors the cron routes: `CRON_SECRET` via `Authorization: Bearer`,
 * `x-cron-secret`, or `?secret=`. When `CRON_SECRET` is unset (local/dev) the
 * route is open. NOT a public webhook — providers should use
 * `/api/webhooks/sabmail-inbound` instead.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { bindInboundMessage } from '@/lib/sabmail/inbound-binding';
import { getErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // not configured → open (local/dev)
  const auth = req.headers.get('authorization') ?? '';
  if (auth === `Bearer ${expected}`) return true;
  if ((req.headers.get('x-cron-secret') ?? '') === expected) return true;
  return (new URL(req.url).searchParams.get('secret') ?? '') === expected;
}

interface BindBody {
  workspaceId?: string;
  from?: string;
  fromName?: string;
  subject?: string;
  messageId?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: BindBody;
  try {
    body = (await req.json()) as BindBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const workspaceId = String(body.workspaceId ?? '').trim();
  const from = String(body.from ?? '').trim();
  if (!workspaceId || !from) {
    return NextResponse.json(
      { ok: false, error: 'workspaceId and from are required.' },
      { status: 400 },
    );
  }

  try {
    const result = await bindInboundMessage({
      workspaceId,
      from,
      fromName: body.fromName,
      subject: body.subject,
      messageId: body.messageId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: getErrorMessage(e) }, { status: 500 });
  }
}
