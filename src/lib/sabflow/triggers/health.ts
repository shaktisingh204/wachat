/**
 * SabFlow — trigger health monitoring.
 *
 * Tracks the operational health of every individual trigger (schedule,
 * webhook, polling, etc.) so the admin dashboard can surface degraded /
 * down triggers and the alerting surface can react to transitions.
 *
 * Health rules:
 *   • on success      → consecutiveFailures = 0,        status = 'ok'
 *   • on failure      → consecutiveFailures += 1
 *                       3+ failures  → 'degraded'
 *                      10+ failures  → 'down'
 *   • staleness       → lastFireAt older than `expectedIntervalMs × 2`
 *                       forces status = 'down' (silent failure detection).
 *
 * Storage: Mongo collection `sabflow_trigger_health`.
 *
 * Alerting: this module exposes a forward-declared subscriber registry
 * (`onTriggerDown`) for whichever alert surface is wired up later.
 * Importers should NOT depend on a concrete alerting module from here.
 *
 * SERVER-ONLY.
 */

import type { Collection } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type TriggerHealthStatus = 'ok' | 'degraded' | 'down';

export interface TriggerHealth {
  triggerId: string;
  workflowId: string;
  workspaceId?: string;
  lastFireAt?: Date;
  lastFireOk?: boolean;
  consecutiveFailures: number;
  lastError?: string;
  status: TriggerHealthStatus;
  /** Expected cadence between fires (ms); if absent staleness checks are skipped. */
  expectedIntervalMs?: number;
  /** Staleness multiplier (default 2× the expected interval). */
  stalenessMultiplier?: number;
  updatedAt: Date;
}

/** Optional context passed alongside `recordFire` so we can persist owners + cadence. */
export interface RecordFireContext {
  workflowId: string;
  workspaceId?: string;
  expectedIntervalMs?: number;
  stalenessMultiplier?: number;
}

/** Payload emitted to listeners on an 'ok' | 'degraded' → 'down' transition. */
export interface TriggerDownEvent {
  triggerId: string;
  workflowId: string;
  workspaceId?: string;
  previousStatus: TriggerHealthStatus;
  consecutiveFailures: number;
  lastError?: string;
  occurredAt: Date;
  /** True when the down state came from staleness rather than explicit failure. */
  stale: boolean;
}

type TriggerDownListener = (event: TriggerDownEvent) => void | Promise<void>;

/* ── Constants ─────────────────────────────────────────────────────────────── */

const COLLECTION = 'sabflow_trigger_health';
const DEGRADED_THRESHOLD = 3;
const DOWN_THRESHOLD = 10;
const DEFAULT_STALENESS_MULTIPLIER = 2;

/* ── Storage helpers ───────────────────────────────────────────────────────── */

async function getCollection(): Promise<Collection<TriggerHealth>> {
  const { db } = await connectToDatabase();
  return db.collection<TriggerHealth>(COLLECTION);
}

/* ── Alert subscribers (forward-declared) ──────────────────────────────────── */

const downListeners = new Set<TriggerDownListener>();

/**
 * Subscribe to trigger-down transitions.  The alerting surface (email /
 * Slack / in-app banner) registers its handler here; this module knows
 * nothing about the concrete delivery mechanism.
 *
 * @returns an unsubscribe function.
 */
export function onTriggerDown(listener: TriggerDownListener): () => void {
  downListeners.add(listener);
  return () => downListeners.delete(listener);
}

async function emitDown(event: TriggerDownEvent): Promise<void> {
  for (const listener of downListeners) {
    try {
      await listener(event);
    } catch (err) {
      console.error('[SabFlow health] alert listener threw:', err);
    }
  }
}

/* ── Status computation ────────────────────────────────────────────────────── */

function computeStatus(consecutiveFailures: number): TriggerHealthStatus {
  if (consecutiveFailures >= DOWN_THRESHOLD) return 'down';
  if (consecutiveFailures >= DEGRADED_THRESHOLD) return 'degraded';
  return 'ok';
}

function isStale(doc: TriggerHealth, now: number): boolean {
  if (!doc.expectedIntervalMs || doc.expectedIntervalMs <= 0) return false;
  if (!doc.lastFireAt) return false;
  const multiplier = doc.stalenessMultiplier ?? DEFAULT_STALENESS_MULTIPLIER;
  const ageMs = now - doc.lastFireAt.getTime();
  return ageMs > doc.expectedIntervalMs * multiplier;
}

/* ── Public API ────────────────────────────────────────────────────────────── */

/**
 * Record the outcome of a trigger fire.  Updates consecutive-failure
 * counters, recomputes status, and emits a down-transition event when
 * applicable.
 */
export async function recordFire(
  triggerId: string,
  ok: boolean,
  errorOrCtx?: Error | RecordFireContext,
  maybeCtx?: RecordFireContext,
): Promise<void> {
  // Tolerate both shapes:
  //   recordFire(id, true, ctx)
  //   recordFire(id, false, error, ctx)
  let error: Error | undefined;
  let ctx: RecordFireContext | undefined;
  if (errorOrCtx instanceof Error) {
    error = errorOrCtx;
    ctx = maybeCtx;
  } else {
    ctx = errorOrCtx;
  }

  const col = await getCollection();
  const now = new Date();
  const existing = await col.findOne({ triggerId });

  const previousStatus: TriggerHealthStatus = existing?.status ?? 'ok';
  const previousFailures = existing?.consecutiveFailures ?? 0;
  const nextFailures = ok ? 0 : previousFailures + 1;
  const nextStatus = computeStatus(nextFailures);

  const workflowId = ctx?.workflowId ?? existing?.workflowId;
  if (!workflowId) {
    throw new Error(
      `recordFire: workflowId is required on first record for triggerId=${triggerId}`,
    );
  }

  const next: TriggerHealth = {
    triggerId,
    workflowId,
    workspaceId: ctx?.workspaceId ?? existing?.workspaceId,
    lastFireAt: now,
    lastFireOk: ok,
    consecutiveFailures: nextFailures,
    lastError: ok ? undefined : error?.message ?? existing?.lastError,
    status: nextStatus,
    expectedIntervalMs: ctx?.expectedIntervalMs ?? existing?.expectedIntervalMs,
    stalenessMultiplier: ctx?.stalenessMultiplier ?? existing?.stalenessMultiplier,
    updatedAt: now,
  };

  await col.updateOne(
    { triggerId },
    { $set: next },
    { upsert: true },
  );

  if (nextStatus === 'down' && previousStatus !== 'down') {
    void emitDown({
      triggerId,
      workflowId: next.workflowId,
      workspaceId: next.workspaceId,
      previousStatus,
      consecutiveFailures: nextFailures,
      lastError: next.lastError,
      occurredAt: now,
      stale: false,
    });
  }
}

/**
 * Fetch the latest health record for a trigger.  Applies the staleness
 * rule on read so a quiet trigger is reported as 'down' even if no
 * explicit failure has been recorded.
 */
export async function getHealth(triggerId: string): Promise<TriggerHealth | null> {
  const col = await getCollection();
  const doc = await col.findOne({ triggerId });
  if (!doc) return null;
  return applyStalenessOnRead(doc);
}

/**
 * List every trigger whose effective status is not 'ok' for the given
 * workspace.  Powers the admin dashboard's "unhealthy triggers" panel.
 */
export async function listUnhealthy(workspaceId: string): Promise<TriggerHealth[]> {
  const col = await getCollection();
  const docs = await col.find({ workspaceId }).toArray();
  const now = Date.now();
  const result: TriggerHealth[] = [];
  for (const doc of docs) {
    const effective = applyStalenessOnRead(doc, now);
    if (effective.status !== 'ok') result.push(effective);
  }
  return result;
}

/**
 * Walk every persisted health doc and promote stale-but-quiet triggers
 * to 'down'.  Intended to be called by a Vercel Cron job (or the
 * schedule poller) every minute so the alerting surface fires even when
 * no fire is ever attempted.
 */
export async function sweepStaleTriggers(): Promise<number> {
  const col = await getCollection();
  const now = Date.now();
  const candidates = await col
    .find({
      expectedIntervalMs: { $gt: 0 },
      status: { $ne: 'down' },
    })
    .toArray();

  let promoted = 0;
  for (const doc of candidates) {
    if (!isStale(doc, now)) continue;
    const occurredAt = new Date(now);
    await col.updateOne(
      { triggerId: doc.triggerId },
      { $set: { status: 'down', updatedAt: occurredAt } },
    );
    void emitDown({
      triggerId: doc.triggerId,
      workflowId: doc.workflowId,
      workspaceId: doc.workspaceId,
      previousStatus: doc.status,
      consecutiveFailures: doc.consecutiveFailures,
      lastError: doc.lastError,
      occurredAt,
      stale: true,
    });
    promoted += 1;
  }
  return promoted;
}

/* ── Internal: staleness application on read ──────────────────────────────── */

function applyStalenessOnRead(doc: TriggerHealth, now: number = Date.now()): TriggerHealth {
  if (doc.status === 'down') return doc;
  if (!isStale(doc, now)) return doc;
  return { ...doc, status: 'down' };
}
