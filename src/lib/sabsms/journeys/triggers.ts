/**
 * SabSMS journeys — enrolment + engine-event orchestration.
 *
 * `startJourneyRun` is the single door into a journey: suppression
 * check first (a suppressed phone NEVER enters a journey), then a
 * one-live-run-per-(journey, phone) dedupe.
 *
 * The `onX` functions translate engine events (see
 * `../events/consumer.ts`) into run transitions. They are pure
 * orchestration over `JourneyStore` so the unit tests drive them with
 * the in-memory store; `handlers.ts` adapts them onto the consumer's
 * router with the Mongo store.
 *
 * Worker-safe: no `server-only`, no `@/` imports.
 */

import { createHash } from 'node:crypto';

import type { ContactRef, JourneyStore } from './store';
import {
  LIVE_RUN_STATUSES,
  nextStepIdAfter,
  type JourneyEvent,
  type SabsmsJourney,
  type SabsmsJourneyRun,
} from './types';

/**
 * sha256 lowercase hex of the trimmed, lowercased phone — the exact
 * convention `sabsms_suppressions.phoneHash` and the engine's
 * `contactUnsubscribed.phoneHash` use (see
 * `src/app/sabsms/suppressions/lib.ts`).
 */
export function hashPhone(e164: string): string {
  return createHash('sha256').update(e164.trim().toLowerCase()).digest('hex');
}

// ─── Enrolment ────────────────────────────────────────────────────────────

export interface StartJourneyRunInput {
  phone: string;
  contactId?: string;
  vars?: Record<string, string>;
}

export type StartJourneyRunResult =
  | { started: true; runId: string }
  | {
      started: false;
      reason: 'not_found' | 'not_active' | 'no_steps' | 'suppressed' | 'duplicate' | 'invalid_phone';
    };

export interface StartJourneyRunOptions {
  now?: () => Date;
  /** Allow enrolment into a draft journey (builder "test enrol"). */
  allowDraft?: boolean;
}

export async function startJourneyRun(
  store: JourneyStore,
  journeyId: string,
  input: StartJourneyRunInput,
  opts: StartJourneyRunOptions = {},
): Promise<StartJourneyRunResult> {
  const now = opts.now ?? (() => new Date());

  const phone = input.phone.trim();
  if (!phone) return { started: false, reason: 'invalid_phone' };

  const journey = await store.getJourney(journeyId);
  if (!journey) return { started: false, reason: 'not_found' };
  if (journey.status !== 'active' && !(opts.allowDraft && journey.status === 'draft')) {
    return { started: false, reason: 'not_active' };
  }
  if (journey.steps.length === 0) return { started: false, reason: 'no_steps' };

  // Suppression gate FIRST — a suppressed contact never enters.
  const phoneHash = hashPhone(phone);
  if (await store.isSuppressed(journey.workspaceId, phoneHash)) {
    return { started: false, reason: 'suppressed' };
  }

  // Dedupe: one live run per (journeyId, phone).
  const existing = await store.findLiveRun(journeyId, phone);
  if (existing) return { started: false, reason: 'duplicate' };

  const at = now();
  const runId = await store.insertRun({
    journeyId,
    workspaceId: journey.workspaceId,
    contactPhone: phone,
    contactPhoneHash: phoneHash,
    contactId: input.contactId,
    currentStepId: journey.steps[0].id,
    status: 'active',
    vars: input.vars ?? {},
    history: [{ stepId: '__start', at, result: 'enrolled' }],
    idempotency: {},
    startedAt: at,
    updatedAt: at,
  });
  await store.incJourneyStats(journeyId, { started: 1 });
  return { started: true, runId };
}

// ─── Event orchestration ──────────────────────────────────────────────────

export interface JourneyEventDeps {
  now?: () => Date;
  log?: (message: string, extra?: Record<string, unknown>) => void;
}

/**
 * Wake every waiting run for the contact whose `waitingFor.event`
 * matches: clear the wait, jump to the wait's `onEventStepId`, and
 * re-activate so the next executor tick continues the run.
 */
export async function wakeWaitingRuns(
  store: JourneyStore,
  workspaceId: string,
  ref: ContactRef,
  event: JourneyEvent,
  deps: JourneyEventDeps = {},
): Promise<number> {
  const now = deps.now ?? (() => new Date());
  const runs = await store.findWaitingRuns(workspaceId, ref, event);
  let woken = 0;
  for (const run of runs) {
    const journey = await store.getJourney(run.journeyId);
    const target =
      run.waitingFor?.onEventStepId ??
      (journey ? nextStepIdAfter(journey.steps, run.currentStepId) : undefined);
    const at = now();
    if (!target) {
      await store.updateRun(
        String(run._id),
        { status: 'completed', completedAt: at },
        { unset: ['wakeAt', 'waitingFor'], pushHistory: { stepId: run.currentStepId, at, result: `event:${event}` } },
      );
      await store.incJourneyStats(run.journeyId, { completed: 1 });
    } else {
      await store.updateRun(
        String(run._id),
        { status: 'active', currentStepId: target },
        { unset: ['wakeAt', 'waitingFor'], pushHistory: { stepId: run.currentStepId, at, result: `event:${event}` } },
      );
    }
    woken += 1;
  }
  return woken;
}

/**
 * Stamp run-level engagement (repliedAt / clickedAt — A/B stats read
 * these) and evaluate the journey goal window.
 */
export async function recordEngagement(
  store: JourneyStore,
  workspaceId: string,
  ref: ContactRef,
  event: JourneyEvent,
  deps: JourneyEventDeps = {},
): Promise<void> {
  const now = deps.now ?? (() => new Date());
  const field = event === 'replied' ? 'repliedAt' : 'clickedAt';
  const statInc = event === 'replied' ? { replies: 1 } : { clicks: 1 };

  const runs = await store.findRunsForContact(workspaceId, ref);
  const journeyCache = new Map<string, SabsmsJourney | null>();

  for (const run of runs) {
    const updates: Partial<SabsmsJourneyRun> = {};
    let touched = false;

    if (!run[field]) {
      updates[field] = now();
      touched = true;
      await store.incJourneyStats(run.journeyId, statInc);
    }

    if (!run.goalMetAt) {
      let journey = journeyCache.get(run.journeyId);
      if (journey === undefined) {
        journey = await store.getJourney(run.journeyId);
        journeyCache.set(run.journeyId, journey);
      }
      const goal = journey?.goal;
      if (goal && goal.event === event) {
        const withinWindow = now().getTime() - run.startedAt.getTime() <= goal.windowMs;
        if (withinWindow) {
          updates.goalMetAt = now();
          touched = true;
          await store.incJourneyStats(run.journeyId, { goals: 1 });
        }
      }
    }

    if (touched) await store.updateRun(String(run._id), updates);
  }
}

/** Exit a set of live runs with a history note. */
async function exitRuns(
  store: JourneyStore,
  runs: SabsmsJourneyRun[],
  note: string,
  deps: JourneyEventDeps,
): Promise<number> {
  const now = deps.now ?? (() => new Date());
  let exited = 0;
  for (const run of runs) {
    if (!LIVE_RUN_STATUSES.includes(run.status)) continue;
    const at = now();
    await store.updateRun(
      String(run._id),
      { status: 'exited', completedAt: at },
      { unset: ['wakeAt', 'waitingFor', 'processingAt'], pushHistory: { stepId: run.currentStepId, at, result: note } },
    );
    await store.incJourneyStats(run.journeyId, { exited: 1 });
    exited += 1;
  }
  return exited;
}

/**
 * `messageInbound` — three reactions, in order:
 *  1. wake `waitUntil(replied)` runs for the sender,
 *  2. stamp engagement + goals, exit runs of journeys with
 *     `exitRules.onReply`,
 *  3. `inbound_keyword` triggers: first token match starts a run.
 */
export async function onMessageInbound(
  store: JourneyStore,
  payload: { workspaceId: string; from: string; body: string },
  deps: JourneyEventDeps = {},
): Promise<{ woken: number; started: number; exited: number }> {
  const { workspaceId, from, body } = payload;
  if (!workspaceId || !from) return { woken: 0, started: 0, exited: 0 };
  const ref: ContactRef = { phone: from };

  const woken = await wakeWaitingRuns(store, workspaceId, ref, 'replied', deps);
  await recordEngagement(store, workspaceId, ref, 'replied', deps);

  // Exit rules — journeys that bail on any reply.
  let exited = 0;
  const onReplyJourneys = (
    await store.listJourneys({ workspaceId, status: 'active' })
  ).filter((j) => j.exitRules?.onReply === true);
  if (onReplyJourneys.length > 0) {
    const ids = new Set(onReplyJourneys.map((j) => String(j._id)));
    const liveRuns = (
      await store.findRunsForContact(workspaceId, ref, LIVE_RUN_STATUSES)
    ).filter((r) => ids.has(r.journeyId));
    exited = await exitRuns(store, liveRuns, 'exit:on_reply', deps);
  }

  // Keyword triggers — match on the first whitespace-delimited token.
  let started = 0;
  const firstToken = (body ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (firstToken) {
    const keywordJourneys = await store.listJourneys({
      workspaceId,
      status: 'active',
      triggerKind: 'inbound_keyword',
    });
    for (const journey of keywordJourneys) {
      const keyword =
        journey.trigger.kind === 'inbound_keyword' ? journey.trigger.keyword : '';
      if (!keyword || keyword.trim().toLowerCase() !== firstToken) continue;
      const res = await startJourneyRun(
        store,
        String(journey._id),
        { phone: from, vars: { keyword: firstToken, inboundBody: body ?? '' } },
        { now: deps.now },
      );
      if (res.started) started += 1;
    }
  }

  return { woken, started, exited };
}

/**
 * `contactUnsubscribed` — the always-on exit rule: every live run for
 * the phone hash exits immediately. The engine only emits the HASH, so
 * matching rides the `contactPhoneHash` stamped at enrolment.
 */
export async function onContactUnsubscribed(
  store: JourneyStore,
  payload: { workspaceId: string; phoneHash: string },
  deps: JourneyEventDeps = {},
): Promise<{ exited: number }> {
  const { workspaceId, phoneHash } = payload;
  if (!workspaceId || !phoneHash) return { exited: 0 };
  const runs = await store.findLiveRunsByPhoneHash(workspaceId, phoneHash);
  const exited = await exitRuns(store, runs, 'exit:unsubscribed', deps);
  return { exited };
}

/** Cap on auto-enrolments from one campaignCompleted event. */
export const CAMPAIGN_ENROLL_CAP = 5000;

/**
 * `campaignCompleted` — start every `campaign_completed`-triggered
 * journey for the campaign's distinct recipients (suppression + dedupe
 * still apply per recipient inside `startJourneyRun`).
 */
export async function onCampaignCompleted(
  store: JourneyStore,
  payload: { workspaceId: string; campaignId: string },
  deps: JourneyEventDeps = {},
): Promise<{ started: number }> {
  const { workspaceId, campaignId } = payload;
  if (!workspaceId || !campaignId) return { started: 0 };

  const journeys = (
    await store.listJourneys({ workspaceId, status: 'active', triggerKind: 'campaign_completed' })
  ).filter((j) => {
    const t = j.trigger;
    return t.kind === 'campaign_completed' && (!t.campaignId || t.campaignId === campaignId);
  });
  if (journeys.length === 0) return { started: 0 };

  const recipients = await store.listCampaignRecipients(
    workspaceId,
    campaignId,
    CAMPAIGN_ENROLL_CAP,
  );
  let started = 0;
  for (const journey of journeys) {
    for (const recipient of recipients) {
      const res = await startJourneyRun(
        store,
        String(journey._id),
        {
          phone: recipient.phone,
          contactId: recipient.contactId,
          vars: { campaignId },
        },
        { now: deps.now },
      );
      if (res.started) started += 1;
    }
  }
  return { started };
}

/**
 * `linkClicked` (Next-side pseudo-event from the link shortener) —
 * wake `waitUntil(clicked)` runs. Attribution resolution order:
 * contactId on the link, then messageId → message.to phone.
 */
export async function onLinkClicked(
  store: JourneyStore,
  payload: { workspaceId: string; slug?: string; messageId?: string; contactId?: string },
  deps: JourneyEventDeps = {},
): Promise<{ woken: number }> {
  const { workspaceId } = payload;
  if (!workspaceId) return { woken: 0 };

  const ref: ContactRef = {};
  if (payload.contactId) ref.contactId = payload.contactId;
  if (payload.messageId) {
    const phone = await store.findMessagePhone(workspaceId, payload.messageId);
    if (phone) ref.phone = phone;
  }
  if (!ref.contactId && !ref.phone) return { woken: 0 };

  const woken = await wakeWaitingRuns(store, workspaceId, ref, 'clicked', deps);
  await recordEngagement(store, workspaceId, ref, 'clicked', deps);
  return { woken };
}
