/**
 * SabFlow concurrency gate.
 *
 * Server-side, in-memory throttle for parallel flow executions.  When a flow
 * defines `settings.maxConcurrentRuns` the runner must call `acquireRunSlot`
 * before kicking off a run and `releaseRunSlot` after it finishes (success
 * or error).  Excess runs either queue (default) or get rejected outright,
 * depending on `settings.onConcurrencyExceeded`.
 *
 * Design notes:
 *   - Single-process, in-memory.  Multi-instance deployments should swap
 *     this for a Redis-backed implementation; the public API is identical.
 *   - Waiters are FIFO so longer-waiting runs don't starve.
 *   - Stale slots are reclaimed via a hard timeout (1 hour) so a crashed
 *     worker can't permanently wedge a flow.
 *   - When `maxConcurrentRuns` is `0` / `undefined` / negative the gate is
 *     a no-op — the runner pays only a single Map lookup per acquire.
 */

import type { FlowSettings } from '@/lib/sabflow/types';

type Settings = Pick<
  FlowSettings,
  'maxConcurrentRuns' | 'maxQueuedRuns' | 'onConcurrencyExceeded'
>;

/** Outcome handed back to the caller of `acquireRunSlot`. */
export type AcquireResult =
  | { ok: true; release: () => void; queuedFor: number }
  | { ok: false; reason: 'rejected'; waitingCount: number; limit: number };

type Slot = {
  acquiredAt: number;
  release: () => void;
};

type Waiter = {
  resolve: (slot: { release: () => void; queuedFor: number }) => void;
  reject: (err: Error) => void;
  enqueuedAt: number;
};

type FlowState = {
  active: Set<Slot>;
  waiters: Waiter[];
};

const STALE_SLOT_MS = 60 * 60 * 1000; // 1 hour hard timeout
const flows = new Map<string, FlowState>();

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Try to acquire a run slot for `flowId`.  Resolves immediately when the
 * flow is under its cap, otherwise either queues (default) or rejects.
 *
 * Always release the slot via the returned `release()` callback when the
 * run completes — typically in a `finally` block.  Forgetting to release
 * is mostly safe (slots auto-expire after one hour) but blocks the queue
 * until then, so always call it.
 */
export async function acquireRunSlot(
  flowId: string,
  settings: Settings | undefined,
): Promise<AcquireResult> {
  const limit = Math.max(0, Number(settings?.maxConcurrentRuns ?? 0) | 0);
  if (limit === 0) {
    // No-op gate — return a release that does nothing.
    return { ok: true, release: () => {}, queuedFor: 0 };
  }

  const state = getState(flowId);
  reclaimStaleSlots(state);

  if (state.active.size < limit) {
    const slot = createSlot(flowId);
    state.active.add(slot);
    return { ok: true, release: slot.release, queuedFor: 0 };
  }

  // Over the cap — either queue or reject.
  const mode = settings?.onConcurrencyExceeded ?? 'queue';
  if (mode === 'reject') {
    return {
      ok: false,
      reason: 'rejected',
      waitingCount: state.waiters.length,
      limit,
    };
  }

  const queueCap = Number(settings?.maxQueuedRuns ?? 0) | 0;
  if (queueCap > 0 && state.waiters.length >= queueCap) {
    return {
      ok: false,
      reason: 'rejected',
      waitingCount: state.waiters.length,
      limit,
    };
  }

  // Queue and wait for a slot to free up.
  const enqueuedAt = Date.now();
  return new Promise<AcquireResult>((resolve, reject) => {
    state.waiters.push({
      enqueuedAt,
      resolve: ({ release, queuedFor }) =>
        resolve({ ok: true, release, queuedFor }),
      reject,
    });
  });
}

/**
 * Returns a synchronous snapshot of `{ active, waiting, limit }` for the
 * given flow.  Useful for observability dashboards or admin pages.
 */
export function describeRunSlot(
  flowId: string,
  settings: Settings | undefined,
): {
  active: number;
  waiting: number;
  limit: number;
} {
  const limit = Math.max(0, Number(settings?.maxConcurrentRuns ?? 0) | 0);
  const state = flows.get(flowId);
  return {
    active: state?.active.size ?? 0,
    waiting: state?.waiters.length ?? 0,
    limit,
  };
}

/**
 * Drop every slot + waiter for a flow.  Intended for tests / hot-reload.
 * Pending waiters are rejected so callers don't hang.
 */
export function resetRunSlots(flowId?: string): void {
  if (flowId === undefined) {
    for (const [, state] of flows) drainState(state, 'Concurrency gate reset');
    flows.clear();
    return;
  }
  const state = flows.get(flowId);
  if (!state) return;
  drainState(state, 'Concurrency gate reset');
  flows.delete(flowId);
}

/* ── Internals ──────────────────────────────────────────────────────────── */

function getState(flowId: string): FlowState {
  let state = flows.get(flowId);
  if (!state) {
    state = { active: new Set(), waiters: [] };
    flows.set(flowId, state);
  }
  return state;
}

function createSlot(flowId: string): Slot {
  const state = getState(flowId);
  let released = false;
  const slot: Slot = {
    acquiredAt: Date.now(),
    release: () => {
      if (released) return;
      released = true;
      state.active.delete(slot);
      // Promote the next waiter (if any) — FIFO.
      const next = state.waiters.shift();
      if (next) {
        const promoted = createSlot(flowId);
        state.active.add(promoted);
        next.resolve({
          release: promoted.release,
          queuedFor: Date.now() - next.enqueuedAt,
        });
      }
    },
  };
  return slot;
}

/**
 * Reclaim slots that have been held longer than `STALE_SLOT_MS`.  Protects
 * against a crashed worker permanently wedging a flow's queue.  Cheap —
 * runs once per acquire, on the same flow.
 */
function reclaimStaleSlots(state: FlowState): void {
  const now = Date.now();
  for (const slot of state.active) {
    if (now - slot.acquiredAt > STALE_SLOT_MS) {
      slot.release();
    }
  }
}

function drainState(state: FlowState, reason: string): void {
  for (const w of state.waiters) {
    try {
      w.reject(new Error(reason));
    } catch {
      /* ignore — best-effort cleanup */
    }
  }
  state.waiters.length = 0;
  state.active.clear();
}
