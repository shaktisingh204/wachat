/**
 * Public AI-deflect proxy for the embeddable SabChat widget.
 *
 * The KB resolve-bot (`/v1/sabchat/ai/resolve-bot/answer`) requires a
 * tenant-scoped JWT, which an anonymous visitor cannot mint. This route
 * resolves the inbox's tenant from Mongo (the inbox id is already public),
 * mints a tenant-scoped token via `runWithRustTenantAs` (no session cookie
 * needed), and calls the resolve bot on the visitor's behalf. CORS-open
 * because the widget runs on third-party origins.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { rustClient } from '@/lib/rust-client';
import { runWithRustTenantAs } from '@/lib/rust-client/fetcher';

function cors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    inboxId?: string;
    conversationId?: string;
    question?: string;
  } | null;

  const inboxId = body?.inboxId?.trim();
  const conversationId = body?.conversationId?.trim();
  const question = body?.question?.trim();

  if (!inboxId || !conversationId || !question) {
    return cors(NextResponse.json({ error: 'inboxId, conversationId and question are required' }, { status: 400 }));
  }
  if (!ObjectId.isValid(inboxId)) {
    return cors(NextResponse.json({ error: 'invalid inbox' }, { status: 400 }));
  }

  // Resolve the tenant that owns this inbox (the id is public; the tenant is not).
  let tenantId: string;
  try {
    const { db } = await connectToDatabase();
    const inbox = await db
      .collection('sabchat_inboxes')
      .findOne({ _id: new ObjectId(inboxId) }, { projection: { tenantId: 1, enabled: 1 } });
    if (!inbox || inbox.enabled === false) {
      return cors(NextResponse.json({ error: 'inbox not found' }, { status: 404 }));
    }
    tenantId = String(inbox.tenantId);
  } catch {
    return cors(NextResponse.json({ error: 'lookup failed' }, { status: 500 }));
  }

  try {
    const res = await runWithRustTenantAs(tenantId, tenantId, () =>
      rustClient.sabchatAiResolveBot.answer({ inboxId, conversationId, question }),
    );
    return cors(
      NextResponse.json({
        answer: res.answer,
        confidence: res.confidence,
        escalate: res.escalate,
      }),
    );
  } catch {
    // Bot unavailable / low-quality — let the widget fall through to a human.
    return cors(NextResponse.json({ answer: null, confidence: 0, escalate: true }));
  }
}
