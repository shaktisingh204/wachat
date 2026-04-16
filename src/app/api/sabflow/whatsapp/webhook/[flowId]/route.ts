/**
 * SabFlow — WhatsApp Cloud API webhook
 *
 * GET  /api/sabflow/whatsapp/webhook/[flowId]
 *      Meta webhook verification handshake.  When `hub.verify_token`
 *      matches the stored token for this flow, we echo back `hub.challenge`.
 *
 * POST /api/sabflow/whatsapp/webhook/[flowId]
 *      Inbound message payload.  For each user message, we find-or-create a
 *      FlowSession keyed by the sender phone, run the engine, map the
 *      resulting host messages to WhatsApp payloads, and send them.
 *      Always responds 200 so Meta does not disable the webhook.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  createSession,
  getSabFlowById,
  getWhatsAppConfig,
  getWhatsAppSessionByPhone,
  saveSubmission,
  updateSession,
} from '@/lib/sabflow/db';
import { processInput, startSession } from '@/lib/sabflow/execution/engine';
import { decryptData } from '@/lib/sabflow/credentials/encryption';
import { blockToWhatsAppMessage } from '@/lib/sabflow/whatsapp/messageMapper';
import { sendMessage, WhatsAppApiError } from '@/lib/sabflow/whatsapp/client';
import type {
  WhatsAppIncomingMessage,
  WhatsAppWebhookPayload,
} from '@/lib/sabflow/whatsapp/types';
import type { FlowSession } from '@/lib/sabflow/execution/types';
import type { Block, SabFlowDoc } from '@/lib/sabflow/types';

export const dynamic = 'force-dynamic';

/* ══════════════════════════════════════════════════════════
   GET — verification handshake
   ══════════════════════════════════════════════════════════ */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ flowId: string }> },
) {
  const { flowId } = await params;
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || !token || !challenge) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const config = await getWhatsAppConfig(flowId);
  if (!config) {
    return new NextResponse('Not Found', { status: 404 });
  }

  if (token !== config.verifyToken) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Meta expects the raw challenge string (not JSON).
  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/* ══════════════════════════════════════════════════════════
   POST — inbound message handler
   ══════════════════════════════════════════════════════════ */

/** Pull the best textual reply out of an incoming message. */
function extractUserInput(msg: WhatsAppIncomingMessage): string | null {
  if (msg.type === 'text') return msg.text?.body?.trim() || null;
  if (msg.type === 'interactive') {
    const ir = msg.interactive;
    if (ir?.type === 'button_reply' && ir.button_reply) {
      return ir.button_reply.id || ir.button_reply.title || null;
    }
    if (ir?.type === 'list_reply' && ir.list_reply) {
      return ir.list_reply.id || ir.list_reply.title || null;
    }
    return null;
  }
  if (msg.type === 'button') {
    return msg.button?.payload ?? msg.button?.text ?? null;
  }
  return null;
}

/** Coerce session.variables (string | undefined) into a plain string map. */
function toStringMap(v: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val !== undefined) out[k] = val;
  }
  return out;
}

/**
 * Look up the Block referenced by a `message` ExecutionStep payload so we
 * can map it to a WhatsApp payload.
 */
function findBlock(flow: SabFlowDoc, blockId: string | undefined): Block | undefined {
  if (!blockId) return undefined;
  for (const g of flow.groups) {
    const b = g.blocks.find((bl) => bl.id === blockId);
    if (b) return b;
  }
  return undefined;
}

/**
 * Process a single inbound message end-to-end: locate/create session,
 * advance engine, send outbound replies.  Swallows per-message errors so
 * one bad message does not poison the batch.
 */
async function handleIncomingMessage(
  flow: SabFlowDoc,
  flowId: string,
  incoming: WhatsAppIncomingMessage,
  phoneNumberId: string,
  accessToken: string,
): Promise<void> {
  const from = incoming.from;
  const userInput = extractUserInput(incoming);

  if (!from) return;

  // ── Find-or-create session ───────────────────────────────────────────
  let session: FlowSession | null = await getWhatsAppSessionByPhone(flowId, from);
  let isNew = false;

  if (!session) {
    session = startSession(flow);
    // Tag the session so subsequent incoming messages can find it.
    session.variables = { ...session.variables, waPhone: from };
    await createSession(session);
    isNew = true;
  }

  // If the session is brand-new we don't yet have a pending input — we have
  // to advance the engine first, then send its output; if the first block
  // is an input the engine will pause immediately and return a prompt.
  // When the session already exists, we feed the user's text/choice in.
  const inputToFeed = isNew ? '' : (userInput ?? '');

  const { session: updated, nextSteps } = processInput(session, flow, inputToFeed);

  // ── Persist the updated session ──────────────────────────────────────
  await updateSession(session.id, {
    variables: updated.variables,
    currentGroupId: updated.currentGroupId,
    currentBlockIndex: updated.currentBlockIndex,
    status: updated.status,
    updatedAt: updated.updatedAt,
    messages: updated.messages,
  });

  // ── Save submission on completion ────────────────────────────────────
  if (updated.status === 'completed') {
    try {
      await saveSubmission({
        flowId,
        sessionId: session.id,
        variables: updated.variables as Record<string, unknown>,
        completedAt: updated.updatedAt,
      });
    } catch (err) {
      console.error('[SABFLOW WHATSAPP] saveSubmission failed:', err);
    }
  }

  // ── Build outbound WhatsApp messages ─────────────────────────────────
  const variables = toStringMap(updated.variables);

  // Emit one WhatsApp message per `message` / `input` step, in order.
  type StepPayload = { blockId?: string };
  const outbound = [] as ReturnType<typeof blockToWhatsAppMessage>[number][];

  for (const step of nextSteps) {
    if (step.type !== 'message' && step.type !== 'input') continue;
    const payload = step.payload as StepPayload;
    const block = findBlock(flow, payload.blockId);
    if (!block) continue;
    outbound.push(...blockToWhatsAppMessage(block, variables));
  }

  // ── Send sequentially (WhatsApp preserves order) ─────────────────────
  for (const message of outbound) {
    try {
      await sendMessage({
        to: from,
        phoneNumberId,
        accessToken,
        message,
      });
    } catch (err) {
      if (err instanceof WhatsAppApiError) {
        console.error(
          `[SABFLOW WHATSAPP] send failed (status=${err.status} code=${err.code ?? 'n/a'}):`,
          err.message,
        );
      } else {
        console.error('[SABFLOW WHATSAPP] send failed:', err);
      }
    }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ flowId: string }> },
) {
  const { flowId } = await params;

  // ── Parse payload ────────────────────────────────────────────────────
  let payload: WhatsAppWebhookPayload;
  try {
    payload = (await req.json()) as WhatsAppWebhookPayload;
  } catch {
    // Meta occasionally sends empty bodies — acknowledge so it doesn't retry.
    return NextResponse.json({ ok: true });
  }

  // ── Load config + flow ───────────────────────────────────────────────
  const config = await getWhatsAppConfig(flowId);
  if (!config) {
    // Unknown flow → 200 so Meta doesn't disable the webhook for a stale URL.
    return NextResponse.json({ ok: true });
  }

  const flow = await getSabFlowById(flowId);
  if (!flow) {
    return NextResponse.json({ ok: true });
  }

  // Decrypt the access token once per request.
  let accessToken: string;
  try {
    accessToken = decryptData(config.accessToken);
  } catch (err) {
    console.error('[SABFLOW WHATSAPP] Failed to decrypt access token:', err);
    return NextResponse.json({ ok: true });
  }

  // ── Walk every entry.changes.value.messages[] ────────────────────────
  const entries = payload.entry ?? [];
  for (const entry of entries) {
    const changes = entry.changes ?? [];
    for (const change of changes) {
      const messages = change.value?.messages ?? [];
      for (const msg of messages) {
        try {
          await handleIncomingMessage(flow, flowId, msg, config.phoneNumberId, accessToken);
        } catch (err) {
          console.error('[SABFLOW WHATSAPP] handleIncomingMessage failed:', err);
        }
      }
    }
  }

  // Always ack so Meta doesn't disable the subscription.
  return NextResponse.json({ ok: true });
}
