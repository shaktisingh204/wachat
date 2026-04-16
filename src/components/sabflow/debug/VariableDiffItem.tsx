'use client';

/**
 * VariableDiffItem — a single row in the "Variables" tab.
 *
 * Shows variable name + type chip + current JSON value.  When the
 * variable changed within the last 2 s, an amber dot pulses and
 * fades out; hovering the row reveals the previous value.
 */

import { memo, useEffect, useState } from 'react';
import type { DebugVariableState } from '@/lib/sabflow/debug/types';

const HIGHLIGHT_MS = 2000;

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function fmt(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

interface Props {
  name: string;
  state: DebugVariableState;
  /** Shared ticking "now" timestamp (ms) — parent passes this so all
   *  rows rerender together, avoiding per-row timers. */
  now: number;
}

function VariableDiffItemImpl({ name, state, now }: Props) {
  const isFresh =
    state.lastChangedAt !== undefined && now - state.lastChangedAt < HIGHLIGHT_MS;

  const [showPrev, setShowPrev] = useState(false);

  const type = typeOf(state.current);

  return (
    <div
      onMouseEnter={() => setShowPrev(true)}
      onMouseLeave={() => setShowPrev(false)}
      className="group rounded-lg border border-[var(--gray-4)] bg-[var(--gray-1)] px-2.5 py-2 transition-colors hover:border-[var(--gray-6)]"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2 shrink-0">
          {isFresh ? (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </>
          ) : (
            <span className="inline-flex h-2 w-2 rounded-full bg-[var(--gray-5)]" />
          )}
        </span>

        <code className="truncate font-mono text-[12px] font-medium text-violet-600 dark:text-violet-400">
          {name}
        </code>

        <span className="ml-auto rounded bg-[var(--gray-3)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--gray-9)] shrink-0">
          {type}
        </span>
      </div>

      <pre className="mt-1 overflow-hidden whitespace-pre-wrap break-all font-mono text-[11px] leading-snug text-[var(--gray-11)]">
        {fmt(state.current)}
      </pre>

      {showPrev && state.previous !== undefined && state.previous !== state.current ? (
        <div className="mt-1.5 border-t border-dashed border-[var(--gray-4)] pt-1.5">
          <div className="mb-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-[var(--gray-8)]">
            Previous
          </div>
          <pre className="overflow-hidden whitespace-pre-wrap break-all font-mono text-[11px] leading-snug text-[var(--gray-9)] line-through">
            {fmt(state.previous)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

export const VariableDiffItem = memo(VariableDiffItemImpl);

/**
 * Hook exposing a ticking "now" at `intervalMs` cadence — used by
 * VariableDiffItem to fade out the amber "fresh" dot after 2 s.
 * The interval only runs when `enabled` is true so the console
 * doesn't burn CPU when closed.
 */
export function useTickingNow(enabled: boolean, intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);
  return now;
}
