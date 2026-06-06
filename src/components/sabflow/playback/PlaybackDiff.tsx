'use client';

/**
 * PlaybackDiff — C.9.8
 *
 * Two-column side-by-side diff of `inputSample` / `outputSample` JSON between
 * two TraceEvents.
 *
 * Implements a simple line-by-line LCS diff with no external diff library:
 *   - Lines present only in A  → red   (removed)
 *   - Lines present only in B  → green (added)
 *   - Lines in both            → unchanged
 *   - Lines that changed value → amber (modified, rendered as remove + add)
 *
 * Props
 * ─────
 *   eventA   — the "before" trace event
 *   eventB   — the "after"  trace event
 *   field    — which sample to diff: 'input' | 'output' (default 'output')
 *   maxLines — cap on rendered diff lines (default 200) — stops runaway renders
 *              on very large payloads
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { TraceEvent } from '@/lib/sabflow/engine/traceEmitter';

/* ── Props ────────────────────────────────────────────────────────────────── */

export interface PlaybackDiffProps {
  eventA: TraceEvent;
  eventB: TraceEvent;
  /** Which sample field to diff. Defaults to `'output'`. */
  field?: 'input' | 'output';
  /**
   * Max diff lines to render (each "changed" line counts as 2 — remove + add).
   * Defaults to 200.
   */
  maxLines?: number;
}

/* ── Diff types ───────────────────────────────────────────────────────────── */

type DiffLineKind = 'unchanged' | 'removed' | 'added';

interface DiffLine {
  kind: DiffLineKind;
  /** Line text (may be empty string for blank lines). */
  text: string;
  /** Line number in the A (left) side, 1-based. `null` for added-only lines. */
  lineA: number | null;
  /** Line number in the B (right) side, 1-based. `null` for removed-only lines. */
  lineB: number | null;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function prettyJson(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') {
    // Try to re-parse if it looks like JSON
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Compute the longest-common-subsequence length table for two string arrays.
 * Classic O(n*m) DP — acceptable for diff purposes where n/m ≤ a few hundred.
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const n = a.length;
  const m = b.length;
  // Allocate a (n+1) × (m+1) table initialised to 0
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

/**
 * Backtrack through the LCS table to produce an ordered list of DiffLine
 * objects representing the diff of arrays `a` → `b`.
 */
function diffLines(a: string[], b: string[]): DiffLine[] {
  const dp = lcsTable(a, b);
  const result: DiffLine[] = [];
  let i = a.length;
  let j = b.length;
  let lineA = a.length;
  let lineB = b.length;

  // Collect operations in reverse, then reverse at the end
  const ops: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ kind: 'unchanged', text: a[i - 1], lineA: lineA--, lineB: lineB-- });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ kind: 'added', text: b[j - 1], lineA: null, lineB: lineB-- });
      j--;
    } else {
      ops.push({ kind: 'removed', text: a[i - 1], lineA: lineA--, lineB: null });
      i--;
    }
  }

  ops.reverse();
  for (const op of ops) result.push(op);
  return result;
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

const LINE_PALETTE: Record<DiffLineKind, string> = {
  unchanged: 'bg-transparent text-[var(--gray-11)]',
  removed:
    'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]',
  added:
    'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]',
};

const LINE_GUTTER: Record<DiffLineKind, string> = {
  unchanged: 'text-[var(--gray-7)]',
  removed:
    'text-[var(--st-text-secondary)] dark:text-[var(--st-text)]',
  added:
    'text-[var(--st-text)] dark:text-[var(--st-text)]',
};

const LINE_SIGIL: Record<DiffLineKind, string> = {
  unchanged: ' ',
  removed: '−',
  added: '+',
};

interface DiffTableProps {
  lines: DiffLine[];
  side: 'left' | 'right';
}

function DiffTable({ lines, side }: DiffTableProps) {
  return (
    <div className="flex-1 min-w-0 overflow-auto font-mono text-[11.5px] leading-relaxed">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, idx) => {
            // On the left side we only show unchanged + removed lines.
            // On the right side we only show unchanged + added lines.
            const showOnLeft = line.kind === 'unchanged' || line.kind === 'removed';
            const showOnRight = line.kind === 'unchanged' || line.kind === 'added';
            const show = side === 'left' ? showOnLeft : showOnRight;
            if (!show) {
              // Render an invisible placeholder to keep row heights in sync
              return (
                <tr key={idx} aria-hidden className="h-[1.5rem]">
                  <td className="w-8 select-none" />
                  <td />
                </tr>
              );
            }
            const lineNum = side === 'left' ? line.lineA : line.lineB;
            return (
              <tr
                key={idx}
                className={cn('h-[1.5rem]', LINE_PALETTE[line.kind])}
              >
                {/* Gutter: line number + sigil */}
                <td
                  className={cn(
                    'w-10 select-none pr-2 text-right align-top',
                    'border-r border-[var(--gray-4)]',
                    LINE_GUTTER[line.kind],
                  )}
                >
                  <span className="mr-1">{LINE_SIGIL[line.kind]}</span>
                  <span className="tabular-nums text-[10.5px]">
                    {lineNum ?? ''}
                  </span>
                </td>
                {/* Content */}
                <td className="pl-2 pr-2 align-top whitespace-pre-wrap break-all">
                  {line.text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── PlaybackDiff ─────────────────────────────────────────────────────────── */

export function PlaybackDiff({
  eventA,
  eventB,
  field = 'output',
  maxLines = 200,
}: PlaybackDiffProps) {
  const valueA = field === 'input' ? eventA.inputSample : eventA.outputSample;
  const valueB = field === 'input' ? eventB.inputSample : eventB.outputSample;

  const { lines, stats } = useMemo(() => {
    const textA = prettyJson(valueA);
    const textB = prettyJson(valueB);
    const linesA = textA === '' ? [] : textA.split('\n');
    const linesB = textB === '' ? [] : textB.split('\n');
    const raw = diffLines(linesA, linesB);
    const capped = raw.slice(0, maxLines);
    const added = raw.filter((l) => l.kind === 'added').length;
    const removed = raw.filter((l) => l.kind === 'removed').length;
    const unchanged = raw.filter((l) => l.kind === 'unchanged').length;
    return { lines: capped, stats: { added, removed, unchanged, total: raw.length } };
  }, [valueA, valueB, maxLines]);

  const fieldLabel = field === 'input' ? 'Input' : 'Output';
  const nodeA = eventA.nodeId;
  const nodeB = eventB.nodeId;

  const hasChanges = stats.added > 0 || stats.removed > 0;

  return (
    <div className="flex flex-col gap-2 text-[var(--gray-12)]">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] px-3.5 py-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold">
            {fieldLabel} diff
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--gray-9)] font-mono truncate">
            <span className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">A:</span>{' '}
            {nodeA}
            <span className="mx-1.5 text-[var(--gray-6)]">→</span>
            <span className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">B:</span>{' '}
            {nodeB}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {stats.removed > 0 && (
            <span className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-[var(--st-text)] dark:border-[var(--st-border)]/60 dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]">
              −{stats.removed}
            </span>
          )}
          {stats.added > 0 && (
            <span className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-[var(--st-text)] dark:border-[var(--st-border)]/60 dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]">
              +{stats.added}
            </span>
          )}
          {!hasChanges && (
            <span className="rounded-md border border-[var(--gray-5)] bg-[var(--gray-3)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--gray-10)]">
              identical
            </span>
          )}
        </div>
      </div>

      {/* ── Column headers ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px">
        <div className="flex items-center gap-2 rounded-tl-lg rounded-tr-none border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-1.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[var(--st-bg-muted)] text-[9px] font-bold text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
            A
          </span>
          <span className="text-[11.5px] font-medium text-[var(--gray-11)] truncate">
            {fieldLabel} · event A
          </span>
          <span className="ml-auto text-[10.5px] tabular-nums text-[var(--gray-8)]">
            ts {eventA.ts}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-tl-none rounded-tr-lg border border-l-0 border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-1.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[var(--st-bg-muted)] text-[9px] font-bold text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
            B
          </span>
          <span className="text-[11.5px] font-medium text-[var(--gray-11)] truncate">
            {fieldLabel} · event B
          </span>
          <span className="ml-auto text-[10.5px] tabular-nums text-[var(--gray-8)]">
            ts {eventB.ts}
          </span>
        </div>
      </div>

      {/* ── Diff body ───────────────────────────────────────────────── */}
      {lines.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-[var(--gray-5)] bg-[var(--gray-1)] py-8">
          <p className="text-[12px] text-[var(--gray-9)]">
            No {fieldLabel.toLowerCase()} data on either event.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px rounded-b-xl overflow-hidden border border-t-0 border-[var(--gray-5)] bg-[var(--gray-5)]">
          <div className="overflow-hidden bg-[var(--gray-1)]">
            <DiffTable lines={lines} side="left" />
          </div>
          <div className="overflow-hidden bg-[var(--gray-1)]">
            <DiffTable lines={lines} side="right" />
          </div>
        </div>
      )}

      {/* ── Truncation notice ───────────────────────────────────────── */}
      {stats.total > maxLines && (
        <p className="text-[11px] text-[var(--gray-8)] text-center">
          Showing first {maxLines} of {stats.total} diff lines.
        </p>
      )}
    </div>
  );
}
