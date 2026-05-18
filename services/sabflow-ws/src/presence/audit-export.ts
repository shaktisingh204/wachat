/**
 * SabFlow WS — lightweight presence-event recorder & exporter.
 *
 * Phase 7 sub-task #10/10 (Track A).
 *
 * Purpose
 * -------
 * Captures join/leave events from the live presence layer so an admin can
 * answer "who was on this doc at 2:14 PM yesterday" without paying the
 * full per-frame audit cost.
 *
 * Design contract
 * ---------------
 *   1. Two write entry points: `recordPresenceJoin` / `recordPresenceLeave`.
 *      Both are sync, allocation-cheap, and never throw — failures are
 *      logged once and swallowed.
 *
 *   2. Writes are batched on a 1-second window and POSTed to the Next.js
 *      forward-declared endpoint `/api/sabflow/presence/audit-batch`
 *      (Phase 8 will materialize the handler — until then HTTP failures
 *      are tolerated and logged at debug level).
 *
 *   3. A bounded in-process ring buffer (cap 10k events) keeps the most
 *      recent batch-flushed events so `exportRecent({...})` can answer
 *      admin queries from this process directly. This is NOT a durable
 *      store — it survives only until the WS pod restarts.
 *
 *   4. PII contract (ADR §6.3): we keep `userId` only. Names, emails,
 *      display strings, cursor positions, frame payloads — none of those
 *      ever cross this boundary. The shape is enforced at the type level
 *      so callers can't accidentally widen it.
 *
 *   5. The WS service NEVER touches the durable Mongo `sabflow_audit_log`
 *      collection. The Next.js endpoint owns that write — this module is
 *      a forwarder, not a writer.
 *
 *   6. Off by default. Set `SABFLOW_WS_PRESENCE_AUDIT=true` to enable.
 *      When disabled, every public function is a near-zero-cost no-op
 *      (env check + early return).
 *
 *   7. Zero external dependencies. Uses only Node built-ins
 *      (`globalThis.fetch` from Node 20+, `setInterval`, `Date.now`).
 */

import { log } from '../logger.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Identity of a single presence touchpoint. PII-scrubbed by construction. */
export interface PresenceJoinInput {
  workspaceId: string;
  docId: string;
  /** Stable user id — NEVER a name, email, or display string. */
  userId: string;
  /** WS connectionId — useful for de-duping multi-tab users. */
  connectionId: string;
  /** Event timestamp (ms epoch). Defaults to `Date.now()` when omitted. */
  ts?: number;
}

export interface PresenceLeaveInput extends PresenceJoinInput {
  /** How long the session was active, in milliseconds. */
  durationMs: number;
}

/** Discriminated record stored in the ring buffer and posted in batches. */
export type PresenceEvent =
  | {
      kind: 'join';
      workspaceId: string;
      docId: string;
      userId: string;
      connectionId: string;
      ts: number;
    }
  | {
      kind: 'leave';
      workspaceId: string;
      docId: string;
      userId: string;
      connectionId: string;
      ts: number;
      durationMs: number;
    };

export interface ExportQuery {
  workspaceId: string;
  docId: string;
  /** Inclusive lower bound (ms epoch). Defaults to 0. */
  since?: number;
  /** Inclusive upper bound (ms epoch). Defaults to +Infinity. */
  until?: number;
}

// ---------------------------------------------------------------------------
// Configuration (read once at module load)
// ---------------------------------------------------------------------------

const ENABLED = process.env.SABFLOW_WS_PRESENCE_AUDIT === 'true';

/** 1-second batch window per spec §3. */
const BATCH_WINDOW_MS = 1_000;

/** Ring buffer capacity per spec §4. */
const RING_CAPACITY = 10_000;

/** Network timeout for the forwarder POST — generous, never blocking. */
const POST_TIMEOUT_MS = 5_000;

/**
 * Where the batched events land. The Next.js handler will be added in
 * Phase 8; until then the POST is best-effort and 404s are tolerated.
 *
 * `SABFLOW_AUDIT_ENDPOINT` overrides the base URL (useful in tests or
 * when the Next.js app runs on a non-default host).
 */
const AUDIT_BASE_URL =
  process.env.SABFLOW_AUDIT_ENDPOINT ??
  process.env.NEXT_INTERNAL_URL ??
  'http://localhost:3000';

const AUDIT_PATH = '/api/sabflow/presence/audit-batch';

/**
 * Optional shared-secret header so the Next.js endpoint can authenticate
 * inbound batches without exposing a public route. Mirrors the
 * `SABWA_ENGINE_TOKEN` pattern in `services/sabwa-node/`.
 */
const AUDIT_TOKEN = process.env.SABFLOW_WS_AUDIT_TOKEN ?? '';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Pending events waiting for the next 1-second flush. */
const pending: PresenceEvent[] = [];

/**
 * Bounded ring buffer for in-process admin queries.
 *
 * Implemented as a fixed-size array + write cursor — O(1) push, O(n)
 * scan on export (acceptable for n ≤ 10k and rare admin reads).
 */
const ring: (PresenceEvent | undefined)[] = new Array(RING_CAPACITY).fill(undefined);
let ringWriteIdx = 0;
let ringFilled = false;

let flushTimer: NodeJS.Timeout | null = null;
let lastNetErrLoggedAt = 0;

// ---------------------------------------------------------------------------
// PII scrub — runtime safety net (the type system is the primary defense)
// ---------------------------------------------------------------------------

/**
 * Strip every field that is not on the whitelist. Even if a caller
 * accidentally passes `name`, `email`, or anything PII-shaped, it will
 * never reach the ring buffer, the batch, or the network.
 */
function scrubJoin(input: PresenceJoinInput, ts: number): PresenceEvent {
  return {
    kind: 'join',
    workspaceId: String(input.workspaceId),
    docId: String(input.docId),
    userId: String(input.userId),
    connectionId: String(input.connectionId),
    ts,
  };
}

function scrubLeave(input: PresenceLeaveInput, ts: number): PresenceEvent {
  return {
    kind: 'leave',
    workspaceId: String(input.workspaceId),
    docId: String(input.docId),
    userId: String(input.userId),
    connectionId: String(input.connectionId),
    ts,
    durationMs: Math.max(0, Number.isFinite(input.durationMs) ? input.durationMs : 0),
  };
}

// ---------------------------------------------------------------------------
// Ring buffer
// ---------------------------------------------------------------------------

function ringPush(ev: PresenceEvent): void {
  ring[ringWriteIdx] = ev;
  ringWriteIdx = (ringWriteIdx + 1) % RING_CAPACITY;
  if (ringWriteIdx === 0) ringFilled = true;
}

function ringSnapshot(): PresenceEvent[] {
  if (!ringFilled) {
    // Buffer hasn't wrapped yet — only [0, ringWriteIdx) is populated.
    const out: PresenceEvent[] = [];
    for (let i = 0; i < ringWriteIdx; i++) {
      const ev = ring[i];
      if (ev) out.push(ev);
    }
    return out;
  }
  // Buffer has wrapped — read from writeIdx forward (oldest first).
  const out: PresenceEvent[] = [];
  for (let i = 0; i < RING_CAPACITY; i++) {
    const ev = ring[(ringWriteIdx + i) % RING_CAPACITY];
    if (ev) out.push(ev);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Batch flush — fire-and-forget, errors are swallowed (logged once/min)
// ---------------------------------------------------------------------------

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushNow();
  }, BATCH_WINDOW_MS);
  // Don't keep the event loop alive just for the flush timer.
  if (typeof flushTimer.unref === 'function') flushTimer.unref();
}

async function flushNow(): Promise<void> {
  if (pending.length === 0) return;
  const batch = pending.splice(0, pending.length);

  // Move into the ring buffer BEFORE the network call so in-process
  // admin queries don't depend on the endpoint being up.
  for (const ev of batch) ringPush(ev);

  const url = `${AUDIT_BASE_URL.replace(/\/$/, '')}${AUDIT_PATH}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (AUDIT_TOKEN) headers['x-sabflow-audit-token'] = AUDIT_TOKEN;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: batch }),
      signal: controller.signal,
    });

    if (!res.ok && res.status !== 404) {
      // 404 is tolerated until the Phase 8 handler lands.
      maybeLogNetErr(`presence audit POST returned ${res.status}`);
    }
  } catch (err) {
    maybeLogNetErr(`presence audit POST failed: ${(err as Error)?.message ?? err}`);
  } finally {
    clearTimeout(timeout);
  }
}

/** Rate-limit network-error logs to at most one per minute. */
function maybeLogNetErr(msg: string): void {
  const now = Date.now();
  if (now - lastNetErrLoggedAt < 60_000) return;
  lastNetErrLoggedAt = now;
  log.debug({ msg }, '[presence-audit]');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a presence-join event.
 *
 * Sync, allocation-cheap, never throws. When
 * `SABFLOW_WS_PRESENCE_AUDIT` is not `"true"`, this is a no-op.
 */
export function recordPresenceJoin(input: PresenceJoinInput): void {
  if (!ENABLED) return;
  if (!input || !input.workspaceId || !input.docId || !input.userId || !input.connectionId) {
    return;
  }
  const ts = typeof input.ts === 'number' && Number.isFinite(input.ts) ? input.ts : Date.now();
  pending.push(scrubJoin(input, ts));
  scheduleFlush();
}

/**
 * Record a presence-leave event with the session's lifetime in ms.
 *
 * Sync, allocation-cheap, never throws. No-op when disabled.
 */
export function recordPresenceLeave(input: PresenceLeaveInput): void {
  if (!ENABLED) return;
  if (!input || !input.workspaceId || !input.docId || !input.userId || !input.connectionId) {
    return;
  }
  const ts = typeof input.ts === 'number' && Number.isFinite(input.ts) ? input.ts : Date.now();
  pending.push(scrubLeave(input, ts));
  scheduleFlush();
}

/**
 * In-process admin query: return all ring-buffered events for a given
 * workspace + doc within `[since, until]`, oldest first.
 *
 * Returns an empty array when the recorder is disabled or no events
 * match. The returned array is a fresh copy — safe to mutate.
 */
export function exportRecent(q: ExportQuery): PresenceEvent[] {
  if (!ENABLED) return [];
  if (!q || !q.workspaceId || !q.docId) return [];

  const since = typeof q.since === 'number' ? q.since : 0;
  const until = typeof q.until === 'number' ? q.until : Number.POSITIVE_INFINITY;

  const snap = ringSnapshot();
  const out: PresenceEvent[] = [];
  for (const ev of snap) {
    if (ev.workspaceId !== q.workspaceId) continue;
    if (ev.docId !== q.docId) continue;
    if (ev.ts < since || ev.ts > until) continue;
    out.push(ev);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Test / shutdown hooks
// ---------------------------------------------------------------------------

/**
 * Force-flush the pending batch immediately. Intended for graceful
 * shutdown handlers (SIGTERM/SIGINT) so the tail of events makes it
 * out before the process exits. Safe to call when disabled (no-op).
 */
export async function flushPresenceAuditNow(): Promise<void> {
  if (!ENABLED) return;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushNow();
}

/**
 * Test-only: clear all in-memory state. Not exported from the package
 * barrel — consumers should never need it.
 */
export function __resetPresenceAuditForTests(): void {
  pending.length = 0;
  for (let i = 0; i < RING_CAPACITY; i++) ring[i] = undefined;
  ringWriteIdx = 0;
  ringFilled = false;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  lastNetErrLoggedAt = 0;
}

/** Introspection helper for ops dashboards. */
export function isPresenceAuditEnabled(): boolean {
  return ENABLED;
}
