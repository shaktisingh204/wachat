/**
 * SabSMS AI agent — event-consumer handler registration (V2.12).
 *
 * The 4th additive registration on the `sabsms:events` router (after
 * journeys, analytics, identity). TWO handlers ride `messageInbound`:
 *
 *   1. GUARDRAIL — opt-out intent classification. Runs FIRST.
 *   2. AGENT     — `runAgentTurn` (auto reply / suggestion).
 *
 * ORDERING GUARANTEE: both handlers are registered inside this single
 * function, guardrail first, and `SabsmsEventRouter.dispatch` runs
 * handlers for a kind sequentially in registration order — so the
 * guardrail ALWAYS completes before the agent sees the event. As a
 * second line of defence the guardrail also stamps
 * `aiFlags.guardedInboundId` on the conversation, which the runtime
 * independently checks (covers replays where the suppression landed in
 * a previous delivery).
 *
 * Registration is ADDITIVE: handlers no-op when the dispatch context
 * carries no `db` (pure-router unit tests), exactly like
 * `../journeys/handlers.ts`.
 *
 * Worker-safe: relative imports only, no `server-only`, no `@/` paths.
 */

import type { Db } from 'mongodb';

import type {
  HandlerContext,
  SabsmsEngineEvent,
  SabsmsEventRouter,
} from '../events/consumer';
import {
  classifyOptOutIntent,
  hashPhone,
  scrubPii,
  type OptOutIntent,
} from './guardrails';
import { defaultSabsmsLlmClient, type SabsmsLlmClient } from './llm';
import {
  runAgentTurn,
  type AgentEnqueue,
  type AgentRuntimeDeps,
} from './runtime';
import { agentStoreFor, ensureAgentIndexes, type AgentStore } from './store';

/** Body of the TCPA-style opt-out confirmation (transactional, exempt). */
export const OPT_OUT_CONFIRMATION_BODY =
  'You have been unsubscribed and will receive no further messages. Reply START to resubscribe.';

/** Categories that make a conversation "marketing-ish" for the guardrail. */
const MARKETING_CATEGORIES = new Set(['marketing']);

export interface AgentHandlerDeps {
  /** Injectables for tests / the eval harness. */
  llm?: SabsmsLlmClient;
  enqueue?: AgentEnqueue;
  storeFor?: (db: Db) => AgentStore;
  now?: () => Date;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

async function defaultGuardrailEnqueue(
  input: Parameters<AgentEnqueue>[0],
): ReturnType<AgentEnqueue> {
  const { sabsmsEngine } = await import('../engine-client');
  return sabsmsEngine.enqueueSend(input);
}

// ─── Guardrail orchestration (exported for the eval harness) ───────────────

export interface GuardrailParams {
  workspaceId: string;
  conversationId: string;
  inboundMessageId: string;
  inboundBody: string;
  contactPhone: string;
}

export interface GuardrailOutcome {
  intent: OptOutIntent | 'skipped';
  suppressed: boolean;
}

/**
 * Classify an inbound on a marketing-ish conversation and act:
 *
 *   opt_out  → suppression (source 'stop', reason 'ai_intent') +
 *              consent-log opt-out (captureMethod 'ai_classified') +
 *              TCPA confirmation through `enqueueSend` (transactional,
 *              quiet-hours exempt) + `aiFlags.guardedInboundId` so the
 *              agent never processes this message.
 *   unclear  → `aiFlags.possibleOptOut: true` (inbox badge).
 *   skipped  → conversation isn't marketing-ish; nothing to do.
 */
export async function runOptOutGuardrail(
  deps: {
    store: AgentStore;
    llm?: SabsmsLlmClient;
    enqueue?: AgentEnqueue;
    log?: (message: string, extra?: Record<string, unknown>) => void;
  },
  params: GuardrailParams,
): Promise<GuardrailOutcome> {
  const { store } = deps;
  const llm = deps.llm ?? defaultSabsmsLlmClient;
  const enqueue = deps.enqueue ?? defaultGuardrailEnqueue;
  const log = deps.log ?? (() => undefined);

  const conversation = await store.getConversation(
    params.workspaceId,
    params.conversationId,
  );
  if (!conversation) return { intent: 'skipped', suppressed: false };

  // Replay tolerance: this inbound was already consumed as an opt-out.
  if (conversation.aiFlags?.guardedInboundId === params.inboundMessageId) {
    return { intent: 'opt_out', suppressed: true };
  }

  // Marketing-ish? — the last OUTBOUND message's category decides.
  // Service/support threads keep the words "stop"/"don't" for free.
  const lastOut = await store.lastOutbound(
    params.workspaceId,
    params.conversationId,
  );
  if (!lastOut || !MARKETING_CATEGORIES.has(lastOut.category ?? '')) {
    return { intent: 'skipped', suppressed: false };
  }

  const intent = await classifyOptOutIntent(params.inboundBody, llm);

  if (intent === 'opt_out') {
    // NOTE: the suppression schema enum (`SabsmsSuppressionSource`) owns
    // `source`, so source='stop' + reason='ai_intent' (the V2.12 brief
    // swaps the two; the schema wins — see the phase report).
    await store.upsertSuppression({
      workspaceId: params.workspaceId,
      phone: params.contactPhone,
      source: 'stop',
      reason: 'ai_intent',
    });
    await store.insertConsentEvent({
      workspaceId: params.workspaceId,
      phoneHash: hashPhone(params.contactPhone),
      kind: 'opt_out_stop',
      captureMethod: 'ai_classified',
      source: 'sabsms.ai_guardrail',
      metadata: {
        conversationId: params.conversationId,
        inboundMessageId: params.inboundMessageId,
        bodyExcerpt: scrubPii(params.inboundBody).text.slice(0, 200),
      },
    });
    // Mark BEFORE the confirmation send so a crash mid-way can never
    // let the agent reply to an already-suppressed customer.
    await store.patchConversation(params.workspaceId, params.conversationId, {
      'aiFlags.guardedInboundId': params.inboundMessageId,
      'aiFlags.possibleOptOut': false,
    });
    try {
      await enqueue({
        workspaceId: params.workspaceId,
        to: params.contactPhone,
        body: OPT_OUT_CONFIRMATION_BODY,
        category: 'transactional',
        contactId: conversation.contactId,
        tags: ['ai-guardrail', 'optout-confirmation'],
        eventKey: 'sabsms.agent.optout_confirmation',
        idempotencyKey: `optout-confirm:${params.inboundMessageId}`,
      });
    } catch (err) {
      // Suppression already landed — the confirmation failing must not
      // unwind it. Log and move on; the engine may also block it if the
      // suppression check beat us (expected race, fine either way).
      log('guardrail: opt-out confirmation enqueue failed', {
        conversationId: params.conversationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    log('guardrail: natural-language opt-out suppressed', {
      conversationId: params.conversationId,
      inboundMessageId: params.inboundMessageId,
    });
    return { intent, suppressed: true };
  }

  if (intent === 'unclear') {
    // Upgrade path for the V2.2 regex badge: same `aiFlags.possibleOptOut`
    // field, now LLM-backed. The inbox renders it as a badge.
    await store.patchConversation(params.workspaceId, params.conversationId, {
      'aiFlags.possibleOptOut': true,
    });
    return { intent, suppressed: false };
  }

  return { intent, suppressed: false };
}

// ─── Router registration ───────────────────────────────────────────────────

type CtxWithDb = HandlerContext & { db?: Db };

/**
 * Register guardrail + agent handlers. MUST keep the guardrail
 * registration first — see the module docs for the ordering guarantee.
 */
export function registerAgentEventHandlers(
  router: SabsmsEventRouter,
  deps: AgentHandlerDeps = {},
): SabsmsEventRouter {
  const storeFor = deps.storeFor ?? agentStoreFor;

  const paramsOf = (event: SabsmsEngineEvent): GuardrailParams => ({
    workspaceId: str(event.payload.workspaceId),
    conversationId: str(event.payload.conversationId),
    inboundMessageId: str(event.payload.messageId),
    inboundBody: str(event.payload.body),
    contactPhone: str(event.payload.from),
  });

  // 1) GUARDRAIL — registered first, dispatches first.
  router.on('messageInbound', async (event, ctx) => {
    const db = (ctx as CtxWithDb).db;
    if (!db) return;
    const p = paramsOf(event);
    if (!p.workspaceId || !p.conversationId || !p.inboundMessageId) return;
    await ensureAgentIndexes(db);
    const res = await runOptOutGuardrail(
      { store: storeFor(db), llm: deps.llm, enqueue: deps.enqueue, log: ctx.log },
      p,
    );
    if (res.intent !== 'skipped' && res.intent !== 'not_opt_out') {
      ctx.log('guardrail: messageInbound classified', {
        conversationId: p.conversationId,
        intent: res.intent,
      });
    }
  });

  // 2) AGENT — registered second, sees the event only after the
  //    guardrail handler resolved.
  router.on('messageInbound', async (event, ctx) => {
    const db = (ctx as CtxWithDb).db;
    if (!db) return;
    const p = paramsOf(event);
    if (!p.workspaceId || !p.conversationId || !p.inboundMessageId) return;
    const runtimeDeps: AgentRuntimeDeps = {
      store: storeFor(db),
      llm: deps.llm,
      enqueue: deps.enqueue,
      now: deps.now,
      log: ctx.log,
    };
    const res = await runAgentTurn(runtimeDeps, {
      workspaceId: p.workspaceId,
      conversationId: p.conversationId,
      inboundMessageId: p.inboundMessageId,
      inboundBody: p.inboundBody,
      contactPhone: p.contactPhone,
    });
    if (res.outcome !== 'skipped') {
      ctx.log('agent: turn finished', {
        conversationId: p.conversationId,
        outcome: res.outcome,
        ...(res.reason ? { reason: res.reason } : {}),
      });
    }
  });

  return router;
}
