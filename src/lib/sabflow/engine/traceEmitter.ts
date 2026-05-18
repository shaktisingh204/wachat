/**
 * SabFlow per-item trace emitter — Phase C.9.1
 *
 * Provides a structured `TraceEvent` shape and a fire-and-forget `emitTrace`
 * helper that appends events to the `sabflow_execution_traces` Mongo
 * collection via the C.9.2 persistence layer.
 *
 * Emission is controlled by the `SABFLOW_TRACE_ENABLED` environment variable
 * so it is strictly opt-in:
 *
 *   SABFLOW_TRACE_ENABLED=true   → persists every trace event
 *   (absent / any other value)  → emitTrace is a no-op
 *
 * `emitTrace` is intentionally synchronous-returning (fire-and-forget): it
 * spawns the async write but never awaits it, so the execution hot path is
 * never blocked by Mongo I/O.
 *
 * The `workspaceId` carried in the event is used to satisfy the multi-tenant
 * invariant required by `appendTraceEvent`. When absent the event is still
 * written but the trace doc will have a zero ObjectId workspace scope —
 * callers should always supply `workspaceId` if available.
 */

import 'server-only';
import { appendTraceEvent } from '@/lib/sabflow/persistence/executionTraces';

/* ──────────────────────────────────────────────────────────────────────────
 * Public types
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Structured per-item trace event emitted by the execution engine.
 *
 * `phase`:
 *   - `'pre'`   — emitted immediately before a block/item runs.
 *   - `'post'`  — emitted after successful completion.
 *   - `'error'` — emitted when the block throws or returns an error signal.
 *
 * `inputSample` / `outputSample` are truncated to the first 512 characters
 * of their JSON serialisation to stay within document size budgets and avoid
 * leaking large payloads into the trace store.
 *
 * `workspaceId` is required by the persistence layer for the multi-tenant
 * fence. Pass the flow owner's userId (or a workspace-specific id) here.
 */
export interface TraceEvent {
  executionId: string;
  /** SabFlow block id (block.id). */
  nodeId: string;
  /** 0-based position of this item in the current block's item list. */
  itemIndex: number;
  phase: 'pre' | 'post' | 'error';
  /** Wall-clock timestamp — Date.now() at emission time. */
  ts: number;
  /** Elapsed milliseconds from pre → post/error (absent on pre events). */
  durationMs?: number;
  /** First 512 chars of the serialised input value (absent on pre when unknown). */
  inputSample?: unknown;
  /** First 512 chars of the serialised output value (absent on pre/error). */
  outputSample?: unknown;
  /** Error message if phase === 'error'. */
  error?: string;
  /**
   * Multi-tenant fence — workspace / user id used to scope the persisted
   * trace doc. Defaults to a sentinel string when not provided.
   */
  workspaceId?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Internal helpers
 * ──────────────────────────────────────────────────────────────────────── */

const MAX_SAMPLE_LENGTH = 512;

/** Serialise a value and cap it at MAX_SAMPLE_LENGTH characters. */
function truncateSample(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    return s.length <= MAX_SAMPLE_LENGTH ? s : s.slice(0, MAX_SAMPLE_LENGTH) + '…';
  } catch {
    return '[unserializable]';
  }
}

/** Zero-ObjectId sentinel used when no workspaceId is supplied. */
const FALLBACK_WORKSPACE_ID = '000000000000000000000000';

/* ──────────────────────────────────────────────────────────────────────────
 * Public API
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Fire-and-forget trace event writer.
 *
 * When `SABFLOW_TRACE_ENABLED !== 'true'` this function returns immediately
 * without touching Mongo. The caller must never await the return value — the
 * function returns `void` so that call-sites are forced into fire-and-forget
 * usage and cannot accidentally block the execution path.
 */
export function emitTrace(event: TraceEvent): void {
  if (process.env.SABFLOW_TRACE_ENABLED !== 'true') return;

  const workspaceId = event.workspaceId ?? FALLBACK_WORKSPACE_ID;

  // Build the persistence-layer event from the richer TraceEvent shape.
  const persistedEvent = {
    kind: event.phase === 'pre' ? 'node_start' : event.phase === 'post' ? 'node_end' : 'error',
    nodeId: event.nodeId,
    itemIndex: event.itemIndex,
    side: event.phase === 'pre' ? ('in' as const) : ('out' as const),
    sizeBytes: undefined as number | undefined,
    inline: true,
    // Attach truncated samples as free-form metadata on the persisted event.
    ...(event.inputSample !== undefined && {
      inputSample: truncateSample(event.inputSample),
    }),
    ...(event.outputSample !== undefined && {
      outputSample: truncateSample(event.outputSample),
    }),
    ...(event.error !== undefined && { errorMessage: event.error }),
    ...(event.durationMs !== undefined && { durationMs: event.durationMs }),
    at: new Date(event.ts),
  };

  // Fire-and-forget: intentionally not awaited.
  appendTraceEvent(event.executionId, persistedEvent, {
    workspaceId,
  }).catch((err) => {
    // Never let a trace write failure surface to the caller — best effort.
    if (process.env.NODE_ENV === 'development') {
      console.warn('[traceEmitter] appendTraceEvent failed:', err);
    }
  });
}
