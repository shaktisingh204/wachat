/**
 * SabSMS journeys — run executor (V2.9).
 *
 * `tickJourneys` claims due runs one at a time (atomic
 * `findOneAndUpdate` → status `processing`) and advances each run's
 * state machine. Instant steps (send / branch / exit / timeout
 * resolution) are chained within one claim (bounded), while `wait` /
 * `waitUntil` park the run with a `wakeAt`.
 *
 * Crash-safety: every send is guarded by an idempotency key
 * (`${runId}:${stepId}`) persisted BEFORE the enqueue — a replayed
 * claim (worker restart, stale-processing reclaim) skips the side
 * effect and just advances. The engine additionally dedupes on the
 * same key via `idempotencyKey`.
 *
 * All effects are injected (`ExecutorDeps`) so the state machine is
 * unit-testable with a fake clock + stubbed enqueue + memory store.
 *
 * Worker-safe: no `server-only`, no `@/` imports. The default enqueue
 * lazily imports the engine client (whose `server-only` import resolves
 * to the benign stub under the PM2 worker's NODE_PATH).
 */

import { renderTemplate } from '../render';
import type { EnqueueSendInput, EnqueueSendResult } from '../types';
import { DEFAULT_AB_SAMPLE_THRESHOLD, maybePromoteWinner, pickVariant } from './ab';
import { evaluateCondition } from './conditions';
import type { JourneyStore } from './store';
import {
  findStep,
  journeyMessageTags,
  nextStepIdAfter,
  stepExecutionKey,
  type JourneySendStep,
  type SabsmsJourney,
  type SabsmsJourneyRun,
} from './types';

/** Max instant steps chained inside one claim (cycle/runaway guard). */
const MAX_CHAINED_STEPS = 25;

/** Re-check interval when a run's journey is paused. */
const PAUSED_RECHECK_MS = 5 * 60 * 1000;

/** A/B promotion sweep throttle per journey. */
const AB_CHECK_INTERVAL_MS = 60 * 1000;

export type JourneyEnqueue = (input: EnqueueSendInput) => Promise<EnqueueSendResult>;

export interface ExecutorDeps {
  store: JourneyStore;
  now?: () => Date;
  enqueue?: JourneyEnqueue;
  log?: (message: string, extra?: Record<string, unknown>) => void;
}

export interface TickResult {
  claimed: number;
  completed: number;
  failed: number;
  promotedWinners: number;
}

async function defaultEnqueue(input: EnqueueSendInput): Promise<EnqueueSendResult> {
  // Lazy so test/worker bootstraps that inject their own enqueue never
  // touch the engine client module at all.
  const { sabsmsEngine } = await import('../engine-client');
  return sabsmsEngine.enqueueSend(input);
}

/**
 * Claim + execute up to `limit` due runs, then sweep A/B promotions.
 * Designed to be called on a short interval (5 s) from the
 * `sabsms-events` worker bootstrap.
 */
export async function tickJourneys(deps: ExecutorDeps, limit = 100): Promise<TickResult> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => undefined);
  const result: TickResult = { claimed: 0, completed: 0, failed: 0, promotedWinners: 0 };

  for (let i = 0; i < limit; i++) {
    const run = await deps.store.claimDueRun(now());
    if (!run) break;
    result.claimed += 1;
    try {
      const outcome = await executeClaimedRun(run, deps);
      if (outcome === 'completed' || outcome === 'exited') result.completed += 1;
      if (outcome === 'failed') result.failed += 1;
    } catch (err) {
      // Leave the run in `processing` — the stale-claim reclaim picks it
      // up after the window; the idempotency key prevents double sends.
      result.failed += 1;
      log('journey run execution error', {
        runId: String(run._id),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  result.promotedWinners = await sweepAbPromotions(deps);
  return result;
}

export type RunOutcome = 'completed' | 'exited' | 'failed' | 'waiting' | 'active' | 'skipped';

/**
 * Advance one claimed run until it parks (wait/waitUntil), terminates,
 * or exhausts the chain budget.
 */
export async function executeClaimedRun(
  claimed: SabsmsJourneyRun,
  deps: ExecutorDeps,
): Promise<RunOutcome> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => undefined);
  const store = deps.store;
  const runId = String(claimed._id);

  const journey = await store.getJourney(claimed.journeyId);
  if (!journey) {
    await store.updateRun(
      runId,
      { status: 'failed', completedAt: now() },
      { unset: ['wakeAt', 'waitingFor', 'processingAt'], pushHistory: hist(claimed.currentStepId, now(), 'error:journey_missing') },
    );
    return 'failed';
  }

  if (journey.status === 'paused' || journey.status === 'draft') {
    // Freeze: park the run and re-check later without executing anything.
    await store.updateRun(runId, {
      status: 'waiting',
      wakeAt: new Date(now().getTime() + PAUSED_RECHECK_MS),
    });
    return 'skipped';
  }

  if (journey.status === 'archived') {
    await store.updateRun(
      runId,
      { status: 'exited', completedAt: now() },
      { unset: ['wakeAt', 'waitingFor', 'processingAt'], pushHistory: hist(claimed.currentStepId, now(), 'exit:journey_archived') },
    );
    await store.incJourneyStats(claimed.journeyId, { exited: 1 });
    return 'exited';
  }

  // Working copy — mutated as steps chain; persisted at each transition.
  let run: SabsmsJourneyRun = { ...claimed };

  // A claimed run that still carries `waitingFor` means its waitUntil
  // TIMED OUT (event wakes clear waitingFor before re-activating).
  if (run.waitingFor) {
    const target =
      run.waitingFor.onTimeoutStepId ?? nextStepIdAfter(journey.steps, run.currentStepId);
    const entry = hist(run.currentStepId, now(), `timeout:${run.waitingFor.event}`);
    if (!target) {
      await store.updateRun(
        runId,
        { status: 'completed', completedAt: now() },
        { unset: ['wakeAt', 'waitingFor', 'processingAt'], pushHistory: entry },
      );
      await store.incJourneyStats(run.journeyId, { completed: 1 });
      return 'completed';
    }
    run = { ...run, currentStepId: target, waitingFor: undefined, wakeAt: undefined };
    await store.updateRun(
      runId,
      { currentStepId: target },
      { unset: ['wakeAt', 'waitingFor'], pushHistory: entry },
    );
  }

  for (let chained = 0; chained < MAX_CHAINED_STEPS; chained++) {
    const step = findStep(journey.steps, run.currentStepId);
    if (!step) {
      await store.updateRun(
        runId,
        { status: 'failed', completedAt: now() },
        { unset: ['wakeAt', 'waitingFor', 'processingAt'], pushHistory: hist(run.currentStepId, now(), 'error:step_missing') },
      );
      await store.incJourneyStats(run.journeyId, { failed: 1 });
      return 'failed';
    }

    const key = stepExecutionKey(runId, step.id);
    const alreadyExecuted = run.idempotency?.lastExecutedStepKey === key;

    switch (step.kind) {
      case 'send': {
        if (!alreadyExecuted) {
          const sent = await executeSendStep(journey, run, step, key, deps);
          if (!sent.ok) {
            await store.updateRun(
              runId,
              { status: 'failed', completedAt: now() },
              { unset: ['wakeAt', 'waitingFor', 'processingAt'], pushHistory: hist(step.id, now(), sent.note) },
            );
            await store.incJourneyStats(run.journeyId, { failed: 1 });
            return 'failed';
          }
          run = { ...run, idempotency: { lastExecutedStepKey: key } };
        } else {
          log('send step replayed — side effect skipped', { runId, stepId: step.id });
        }
        const next = nextStepIdAfter(journey.steps, step.id);
        if (!next) return finishCompleted(runId, run.journeyId, step.id, deps);
        run = { ...run, currentStepId: next };
        await store.updateRun(runId, { currentStepId: next });
        break;
      }

      case 'wait': {
        if (!alreadyExecuted) {
          await store.setRunStepKey(runId, key);
          run = { ...run, idempotency: { lastExecutedStepKey: key } };
        }
        const next = nextStepIdAfter(journey.steps, step.id);
        if (!next) return finishCompleted(runId, run.journeyId, step.id, deps);
        const wakeAt = new Date(now().getTime() + step.durationMs);
        await store.updateRun(
          runId,
          { status: 'waiting', wakeAt, currentStepId: next },
          { unset: ['processingAt'], pushHistory: hist(step.id, now(), 'wait') },
        );
        return 'waiting';
      }

      case 'waitUntil': {
        if (!alreadyExecuted) {
          await store.setRunStepKey(runId, key);
        }
        const timeoutAt = new Date(now().getTime() + step.timeoutMs);
        const onEventStepId = step.onEventStepId ?? nextStepIdAfter(journey.steps, step.id);
        const onTimeoutStepId = step.onTimeoutStepId ?? nextStepIdAfter(journey.steps, step.id);
        await store.updateRun(
          runId,
          {
            status: 'waiting',
            wakeAt: timeoutAt,
            waitingFor: { event: step.event, timeoutAt, onEventStepId, onTimeoutStepId },
          },
          { unset: ['processingAt'], pushHistory: hist(step.id, now(), `waiting:${step.event}`) },
        );
        return 'waiting';
      }

      case 'branch': {
        const verdict = evaluateCondition(step.condition, run.vars ?? {});
        const target = verdict ? step.trueStepId : step.falseStepId;
        await store.updateRun(
          runId,
          { currentStepId: target },
          { pushHistory: hist(step.id, now(), `branch:${verdict}`) },
        );
        run = { ...run, currentStepId: target };
        break;
      }

      case 'exit': {
        await store.updateRun(
          runId,
          { status: 'exited', completedAt: now() },
          { unset: ['wakeAt', 'waitingFor', 'processingAt'], pushHistory: hist(step.id, now(), 'exit') },
        );
        await store.incJourneyStats(run.journeyId, { exited: 1 });
        return 'exited';
      }
    }
  }

  // Chain budget exhausted (pathological loop of branches) — hand the run
  // back as active; the next tick continues from the persisted pointer.
  await store.updateRun(runId, { status: 'active' }, { unset: ['processingAt'] });
  return 'active';
}

function hist(stepId: string, at: Date, result: string, extra?: { variantTemplateId?: string; messageId?: string }) {
  return { stepId, at, result, ...(extra ?? {}) };
}

async function finishCompleted(
  runId: string,
  journeyId: string,
  lastStepId: string,
  deps: ExecutorDeps,
): Promise<RunOutcome> {
  const now = deps.now ?? (() => new Date());
  await deps.store.updateRun(
    runId,
    { status: 'completed', completedAt: now() },
    { unset: ['wakeAt', 'waitingFor', 'processingAt'], pushHistory: hist(lastStepId, now(), 'completed') },
  );
  await deps.store.incJourneyStats(journeyId, { completed: 1 });
  return 'completed';
}

async function executeSendStep(
  journey: SabsmsJourney,
  run: SabsmsJourneyRun,
  step: JourneySendStep,
  key: string,
  deps: ExecutorDeps,
): Promise<{ ok: true } | { ok: false; note: string }> {
  const now = deps.now ?? (() => new Date());
  const store = deps.store;
  const enqueue = deps.enqueue ?? defaultEnqueue;
  const runId = String(run._id);
  const journeyId = String(journey._id);

  // Resolve the arm: promoted winner > deterministic A/B pick > control.
  const promoted = journey.ab?.winners?.[step.id]?.templateId;
  const variant = promoted ? undefined : pickVariant(runId, step.id, step.abVariants);
  const templateId = promoted ?? variant?.templateId ?? step.templateId;

  const rawBody = await store.getTemplateBody(run.workspaceId, templateId);
  if (!rawBody || !rawBody.trim()) {
    return { ok: false, note: `error:template_missing:${templateId}` };
  }

  const rendered = renderTemplate(rawBody, run.vars ?? {});
  if (rendered.missing.length > 0) {
    // Never push a body with literal placeholders to a carrier.
    return { ok: false, note: `error:missing_vars:${rendered.missing.join(',')}` };
  }

  // Tracked links so waitUntil('clicked') can resolve back to this run.
  let body = rendered.text;
  let slugs: string[] = [];
  try {
    const minted = await store.mintShortLinks(run.workspaceId, body, {
      contactId: run.contactId,
    });
    body = minted.body;
    slugs = minted.slugs;
  } catch {
    // Link tracking is best-effort — send the raw body instead.
  }

  // Persist the idempotency key BEFORE the side effect: a crash between
  // here and the enqueue may lose one send but can never double-send.
  await store.setRunStepKey(runId, key);

  const variantTemplateId = step.abVariants && step.abVariants.length > 0 ? templateId : undefined;
  let res;
  try {
    res = await enqueue({
      workspaceId: run.workspaceId,
      to: run.contactPhone,
      body,
      category: 'marketing',
      templateId,
      contactId: run.contactId,
      eventKey: 'sabsms.journey.send',
      idempotencyKey: `journey:${key}`,
      tags: journeyMessageTags(journeyId, step.id, variantTemplateId),
    });
  } catch (err) {
    return {
      ok: false,
      note: `error:enqueue:${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (slugs.length > 0 && res.id) {
    try {
      await store.attachMessageIdToSlugs(run.workspaceId, slugs, res.id);
    } catch {
      // Attribution back-fill must never fail the run.
    }
  }

  await store.updateRun(runId, {}, {
    pushHistory: hist(step.id, now(), 'sent', {
      variantTemplateId,
      messageId: res.id || undefined,
    }),
  });
  await store.incJourneyStats(run.journeyId, { sends: 1 });
  return { ok: true };
}

// ─── A/B promotion sweep ──────────────────────────────────────────────────

async function sweepAbPromotions(deps: ExecutorDeps): Promise<number> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => undefined);
  let promoted = 0;

  let due: SabsmsJourney[] = [];
  try {
    due = await deps.store.listJourneysDueAbCheck(now(), AB_CHECK_INTERVAL_MS);
  } catch (err) {
    log('ab sweep listing failed', { error: err instanceof Error ? err.message : String(err) });
    return 0;
  }

  for (const journey of due) {
    await deps.store.markAbCheck(String(journey._id), now());
    for (const step of journey.steps) {
      if (step.kind !== 'send' || !step.abVariants || step.abVariants.length < 2) continue;
      if (journey.ab?.winners?.[step.id]) continue;
      try {
        const res = await maybePromoteWinner(deps.store, journey, step.id, { now });
        if (res.promoted) {
          promoted += 1;
          log('ab winner promoted', {
            journeyId: String(journey._id),
            stepId: step.id,
            templateId: res.winner.templateId,
            metric: res.winner.metric,
          });
        }
      } catch (err) {
        log('ab promotion failed', {
          journeyId: String(journey._id),
          stepId: step.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  return promoted;
}

export { DEFAULT_AB_SAMPLE_THRESHOLD };
