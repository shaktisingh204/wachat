/**
 * Background-worker bootstrap.
 *
 * `startWorkers(state)` starts every long-running tick loop the engine owns
 * and returns a single `stopAll()` function that fans out to each worker's
 * `stop()`. Called from `src/index.ts` right after Express begins listening.
 *
 * Currently wires:
 *   - scheduler — drains due `sabwa_scheduled` rows every 30 s.
 *
 * The bulk-sender and export workers are still started inline in `index.ts`
 * to keep their existing wiring; new workers should be added here instead.
 */

import type { AppState } from '../state.js';
import { startScheduler } from './scheduler.js';
import { startOutboundDispatcher } from './outbound.js';

export interface WorkerHandles {
  /** Stop every worker started by `startWorkers`. Safe to call once. */
  stopAll(): Promise<void>;
}

export function startWorkers(state: AppState): WorkerHandles {
  const stops: Array<() => Promise<void>> = [];

  // ── scheduler ──────────────────────────────────────────────────────────
  stops.push(startScheduler(state));

  // ── outbound dispatcher ────────────────────────────────────────────────
  // Drains `sabwa:<sessionId>:outbound` for each live session and sends
  // via Baileys. Producers: routes/broadcasts.ts, workers/bulk-sender.ts,
  // routes/contacts.ts (block/unblock).
  stops.push(startOutboundDispatcher(state));

  // (future: antiban resampler, etc.)

  return {
    async stopAll(): Promise<void> {
      const results = await Promise.allSettled(stops.map((s) => s()));
      for (const r of results) {
        if (r.status === 'rejected') {
          state.log.warn({ err: r.reason }, 'worker stop failed');
        }
      }
    },
  };
}
