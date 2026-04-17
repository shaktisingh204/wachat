/**
 * SabFlow — in-process schedule trigger registry.
 *
 * Responsibilities:
 *   • Load every published flow that contains at least one active
 *     `schedule` event.
 *   • Poll once per minute (on the minute-boundary) and fire any schedule
 *     whose cron matches the current wall-clock.
 *   • Expose a single entry-point `initScheduleRegistry()` that is
 *     idempotent — calling it repeatedly is safe.
 *
 * This module is deliberately dependency-free: it avoids `node-cron` so it
 * works in environments where the optional dep is not installed.  If
 * `node-cron` ever becomes available the `pollOnce()` loop can be replaced
 * with real cron subscriptions without touching the public API.
 *
 * IMPORTANT: runs on the server only.  Do not import from client code.
 */

import type { SabFlowDoc, SabFlowEvent, ScheduleEventOptions } from '@/lib/sabflow/types';
import { getSabFlowCollection, createSession } from '@/lib/sabflow/db';
import { startSession } from '@/lib/sabflow/execution/engine';
import { parseCron, getNextFireTimes, type CronSpec } from './cronParser';

/* ── Types ─────────────────────────────────────────────────────────────────── */

type ScheduleRegistration = {
  flowId: string;
  eventId: string;
  spec: CronSpec;
  timezone: string;
  /** Timestamp (ms) of the next scheduled fire. */
  nextFireAt: number;
  /** Timestamp (ms) of the last fire (for dedup across ticks). */
  lastFiredAt: number | null;
};

/* ── Module state ──────────────────────────────────────────────────────────── */

/** Map key: `${flowId}:${eventId}` → registration */
const registrations = new Map<string, ScheduleRegistration>();

let pollHandle: ReturnType<typeof setInterval> | null = null;
let initPromise: Promise<void> | null = null;
let lastReloadAt = 0;

const POLL_INTERVAL_MS = 60 * 1000; // 60s polling
const RELOAD_INTERVAL_MS = 5 * 60 * 1000; // refresh registry every 5 minutes

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function keyOf(flowId: string, eventId: string): string {
  return `${flowId}:${eventId}`;
}

function isScheduleEvent(event: SabFlowEvent): boolean {
  return event.type === 'schedule';
}

function readOptions(event: SabFlowEvent): ScheduleEventOptions | null {
  if (event.type !== 'schedule') return null;
  const opts = event.options as ScheduleEventOptions | undefined;
  if (!opts || typeof opts.cronExpression !== 'string') return null;
  return opts;
}

/* ── Registration ──────────────────────────────────────────────────────────── */

function registerEvent(flow: SabFlowDoc, event: SabFlowEvent): void {
  const flowId = flow._id?.toString();
  if (!flowId) return;
  if (!isScheduleEvent(event)) return;

  const opts = readOptions(event);
  if (!opts) return;
  if (opts.enabled === false) return;

  const parsed = parseCron(opts.cronExpression);
  if ('error' in parsed) {
    console.warn(
      `[SabFlow schedule] Invalid cron "${opts.cronExpression}" on flow=${flowId} event=${event.id}: ${parsed.error}`,
    );
    return;
  }

  const timezone = opts.timezone || 'UTC';
  const next = getNextFireTimes(parsed, new Date(), 1, timezone)[0];
  if (!next) return;

  registrations.set(keyOf(flowId, event.id), {
    flowId,
    eventId: event.id,
    spec: parsed,
    timezone,
    nextFireAt: next.getTime(),
    lastFiredAt: null,
  });
}

/** Re-reads all published flows from the DB and rebuilds the registry. */
async function reloadRegistry(): Promise<void> {
  try {
    const col = await getSabFlowCollection();
    const flows = await col
      .find({ status: 'PUBLISHED', 'events.type': 'schedule' })
      .toArray();

    registrations.clear();
    for (const flow of flows) {
      for (const event of flow.events) {
        registerEvent(flow, event);
      }
    }
    lastReloadAt = Date.now();
  } catch (err) {
    console.error('[SabFlow schedule] Registry reload failed:', err);
  }
}

/* ── Firing ────────────────────────────────────────────────────────────────── */

async function fireRegistration(reg: ScheduleRegistration): Promise<void> {
  try {
    const col = await getSabFlowCollection();
    // Re-fetch by string _id via ObjectId — use the helper that already handles this.
    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(reg.flowId)) return;
    const flow = await col.findOne({ _id: new ObjectId(reg.flowId) });
    if (!flow) return;
    if (flow.status !== 'PUBLISHED') return;

    const event = flow.events.find((e) => e.id === reg.eventId);
    if (!event || event.type !== 'schedule') return;
    const opts = readOptions(event);
    if (!opts || opts.enabled === false) return;

    const session = startSession(flow, { eventId: reg.eventId });
    await createSession(session);

    reg.lastFiredAt = Date.now();
    console.info(
      `[SabFlow schedule] Fired flow=${reg.flowId} event=${reg.eventId} session=${session.id}`,
    );
  } catch (err) {
    console.error(
      `[SabFlow schedule] Failed to fire flow=${reg.flowId} event=${reg.eventId}:`,
      err,
    );
  }
}

/* ── Polling loop ──────────────────────────────────────────────────────────── */

async function pollOnce(): Promise<void> {
  const now = Date.now();

  // Periodically refresh the registry so newly published flows are picked up
  // without having to restart the server.
  if (now - lastReloadAt > RELOAD_INTERVAL_MS) {
    await reloadRegistry();
  }

  for (const reg of registrations.values()) {
    if (reg.nextFireAt > now) continue;

    // Guard against re-firing the same minute within a single tick.
    if (reg.lastFiredAt && now - reg.lastFiredAt < 50_000) continue;

    await fireRegistration(reg);

    // Advance to the next fire time.
    const next = getNextFireTimes(reg.spec, new Date(), 1, reg.timezone)[0];
    reg.nextFireAt = next ? next.getTime() : Number.POSITIVE_INFINITY;
  }
}

/* ── Public API ────────────────────────────────────────────────────────────── */

/**
 * Boot the schedule registry.  Idempotent: calling this repeatedly will not
 * start multiple polling loops.  Safe to call from `instrumentation.ts` or
 * lazily from the first API route that needs it.
 */
export function initScheduleRegistry(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await reloadRegistry();
    if (!pollHandle) {
      pollHandle = setInterval(() => {
        void pollOnce();
      }, POLL_INTERVAL_MS);
      // Do not keep the process alive solely for this timer.
      if (typeof pollHandle.unref === 'function') {
        pollHandle.unref();
      }
    }
  })();

  return initPromise;
}

/**
 * Stop the polling loop — primarily for tests / hot reload.
 */
export function stopScheduleRegistry(): void {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  registrations.clear();
  initPromise = null;
  lastReloadAt = 0;
}

/**
 * Force a registry reload.  Called after a flow is published / updated so
 * the in-memory registry reflects the latest cron expression immediately.
 */
export async function refreshScheduleRegistry(): Promise<void> {
  await reloadRegistry();
}

/**
 * Returns a read-only snapshot of the current registrations (for diagnostics
 * / the internal scheduler API route).
 */
export function getScheduleRegistrations(): ReadonlyArray<{
  flowId: string;
  eventId: string;
  cronExpression: string;
  timezone: string;
  nextFireAt: string;
  lastFiredAt: string | null;
}> {
  return [...registrations.values()].map((reg) => ({
    flowId: reg.flowId,
    eventId: reg.eventId,
    cronExpression: reg.spec.raw,
    timezone: reg.timezone,
    nextFireAt: new Date(reg.nextFireAt).toISOString(),
    lastFiredAt: reg.lastFiredAt ? new Date(reg.lastFiredAt).toISOString() : null,
  }));
}
