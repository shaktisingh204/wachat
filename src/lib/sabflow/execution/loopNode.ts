/**
 * SabFlow — Loop (Iterate) block execution helper.
 *
 * Handles state-bearing iteration over an array, with three outgoing pins:
 *   • 'loop'  → body receives `$item` / `$index` and runs once per iteration
 *   • 'done'  → emitted after the final iteration completes
 *   • 'error' → emitted when iteration aborts (e.g. `maxIterations` exceeded)
 *
 * This file is *pure* — it holds no cross-request state.  Iteration state is
 * stored per block on a `LoopStateMap` supplied by the caller (typically
 * `session.state` inside the engine).
 */

import type { Block, LoopOptions } from '@/lib/sabflow/types';
import { substituteVariables } from '@/lib/sabflow/engine';

/* ── Constants ──────────────────────────────────────────────────────────── */

/** Fallback safety cap if the block does not set one. */
export const DEFAULT_MAX_ITERATIONS = 1000;

/** Default variable names injected into the body scope. */
export const DEFAULT_ITEM_VAR_NAME = '$item';
export const DEFAULT_INDEX_VAR_NAME = '$index';

/** Default batch size for one-item-at-a-time iteration. */
export const DEFAULT_BATCH_SIZE = 1;

/** Default concurrency cap used when `mode === "parallel"`. */
export const DEFAULT_PARALLEL_CONCURRENCY = 5;

/* ── Pin identifiers ────────────────────────────────────────────────────── */

export type LoopPinId = 'loop' | 'done' | 'error';

/* ── Runtime state (per block, per session) ─────────────────────────────── */

/**
 * Iteration state persisted across visits to the same loop block.
 * Keyed by `block.id` in the caller's state bag.
 */
export type LoopIterationState = {
  /** Resolved array the loop is walking. */
  items: unknown[];
  /** Zero-based cursor into `items`. */
  cursor: number;
  /** Number of iterations completed so far. */
  iterationsRun: number;
  /** Collected per-iteration return values. */
  results: unknown[];
  /** ISO timestamp the loop first entered. */
  startedAt: string;
};

/** External state map — callers own this (e.g. `session.state`). */
export type LoopStateMap = Record<string, LoopIterationState | undefined>;

/* ── Public result shape ────────────────────────────────────────────────── */

/**
 * What `executeLoop` returns on each engine visit.  The engine inspects
 * `pinId` to decide which outgoing edge to follow next.
 */
export type LoopStep =
  | {
      pinId: 'loop';
      /** Current item (or batch) emitted to the body. */
      item: unknown;
      /** Zero-based iteration index. */
      index: number;
      /** True when additional iterations remain after this one. */
      hasMore: boolean;
      /** Variables that should be merged into the session scope. */
      scope: Record<string, string>;
    }
  | {
      pinId: 'done';
      /** All results collected during the run. */
      allResults: unknown[];
      /** Total iterations that ran. */
      iterations: number;
    }
  | {
      pinId: 'error';
      /** Human-readable reason (e.g. "maxIterations exceeded"). */
      reason: string;
      /** Results collected up until the error. */
      partialResults: unknown[];
      /** Total iterations run before the error. */
      iterations: number;
    };

/* ── Helpers ────────────────────────────────────────────────────────────── */

/**
 * Resolves the configured array source into a real array.
 *
 * Order of precedence:
 *   1. `{{variable}}` expression → substitute, then JSON.parse if shaped like
 *      an array (`[ … ]`).  If the parse fails, wrap single string as one-element.
 *   2. Bare variable name that exists in `variables` → same parse rules.
 *   3. Otherwise → empty array.
 */
export function resolveLoopArray(
  expression: string | undefined,
  variables: Record<string, string>,
): unknown[] {
  if (!expression) return [];
  const raw = substituteVariables(expression, variables).trim();

  // Bare variable name (no template tokens and no literal brackets)
  if (!raw) return [];

  // Attempt JSON parse first — supports both expression-substituted arrays
  // and directly-typed JSON arrays in the config field.
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through */
    }
  }

  // If a variable name was typed without {{}} tokens, look it up.
  if (Object.prototype.hasOwnProperty.call(variables, expression)) {
    const value = variables[expression];
    if (value && value.startsWith('[') && value.endsWith(']')) {
      try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* fall through */
      }
    }
  }

  // Comma-separated fallback — treat "a, b, c" as ["a","b","c"].
  if (raw.includes(',')) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  // Single non-empty token becomes a one-element array.
  return raw ? [raw] : [];
}

/** Returns the effective options with defaults applied. */
export function resolveLoopOptions(options: LoopOptions | undefined): Required<
  Omit<LoopOptions, 'arrayPath'>
> & { arrayPath: string | undefined } {
  return {
    arrayPath: options?.arrayPath,
    batchSize: Math.max(1, options?.batchSize ?? DEFAULT_BATCH_SIZE),
    itemVariableName: options?.itemVariableName ?? DEFAULT_ITEM_VAR_NAME,
    indexVariableName: options?.indexVariableName ?? DEFAULT_INDEX_VAR_NAME,
    maxIterations: Math.max(1, options?.maxIterations ?? DEFAULT_MAX_ITERATIONS),
    mode: options?.mode ?? 'sequential',
    concurrency: Math.max(1, options?.concurrency ?? DEFAULT_PARALLEL_CONCURRENCY),
    continueOnFail: options?.continueOnFail ?? false,
  };
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Decide which pin to take on the *next* engine visit to this loop block.
 *
 * The engine calls this:
 *   a) on first entry into the loop (state is undefined)
 *   b) every time the loop body routes back here via a 'back' edge
 *
 * Mutates `stateBag[block.id]` in place so the next call advances the cursor.
 * Returns the computed `LoopStep` describing which pin to take.
 *
 * The most-recent iteration result (if any) should be supplied as
 * `lastIterationResult`; it is appended to `results[]`.
 */
export function executeLoop(params: {
  block: Block;
  variables: Record<string, string>;
  stateBag: LoopStateMap;
  /** Result produced by the body for the *previous* iteration, if any. */
  lastIterationResult?: unknown;
}): LoopStep {
  const { block, variables, stateBag, lastIterationResult } = params;
  const opts = resolveLoopOptions(block.options as LoopOptions | undefined);

  let state = stateBag[block.id];

  // ── First visit: initialise state ───────────────────────────────────
  if (!state) {
    const items = resolveLoopArray(opts.arrayPath, variables);
    state = {
      items,
      cursor: 0,
      iterationsRun: 0,
      results: [],
      startedAt: new Date().toISOString(),
    };
    stateBag[block.id] = state;
  } else if (lastIterationResult !== undefined) {
    // Accumulate the previous body's output.
    state.results.push(lastIterationResult);
  }

  // ── Safety cap ──────────────────────────────────────────────────────
  if (state.iterationsRun >= opts.maxIterations) {
    const step: LoopStep = {
      pinId: 'error',
      reason: `maxIterations (${opts.maxIterations}) exceeded`,
      partialResults: state.results,
      iterations: state.iterationsRun,
    };
    // Clear state so a re-run starts fresh.
    stateBag[block.id] = undefined;
    return step;
  }

  // ── Completion ──────────────────────────────────────────────────────
  if (state.cursor >= state.items.length) {
    const step: LoopStep = {
      pinId: 'done',
      allResults: state.results,
      iterations: state.iterationsRun,
    };
    stateBag[block.id] = undefined;
    return step;
  }

  // ── Emit next iteration ────────────────────────────────────────────
  const batchStart = state.cursor;
  const batchEnd = Math.min(state.items.length, batchStart + opts.batchSize);
  const batch = state.items.slice(batchStart, batchEnd);
  const item: unknown = opts.batchSize === 1 ? batch[0] : batch;
  const index = state.iterationsRun;

  // Advance the cursor for the *next* visit.
  state.cursor = batchEnd;
  state.iterationsRun += 1;

  const hasMore = state.cursor < state.items.length;

  const scope: Record<string, string> = {
    [opts.itemVariableName]: serialiseScopeValue(item),
    [opts.indexVariableName]: String(index),
  };

  return {
    pinId: 'loop',
    item,
    index,
    hasMore,
    scope,
  };
}

/**
 * Reset iteration state for a block — useful when the engine needs to cancel
 * or restart a loop (e.g. on session reset).
 */
export function resetLoopState(stateBag: LoopStateMap, blockId: string): void {
  stateBag[blockId] = undefined;
}

/* ── Private helpers ────────────────────────────────────────────────────── */

function serialiseScopeValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
