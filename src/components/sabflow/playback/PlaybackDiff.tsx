'use client';

/**
 * PlaybackDiff - C.9.8
 *
 * Two-column side-by-side diff of `inputSample` / `outputSample` JSON between
 * two TraceEvents.
 *
 * Implements a simple line-by-line LCS diff with no external diff library:
 *   - Lines present only in A -> removed
 *   - Lines present only in B -> added
 *   - Lines in both           -> unchanged
 *
 * Props
 *   eventA   - the "before" trace event
 *   eventB   - the "after"  trace event
 *   field    - which sample to diff: 'input' | 'output' (default 'output')
 *   maxLines - cap on rendered diff lines (default 200), stops runaway renders
 *              on very large payloads
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, Badge, Table, TBody, Tr, Td, EmptyState } from '@/components/sabcrm/20ui';
import { FileX } from 'lucide-react';
import type { TraceEvent } from '@/lib/sabflow/engine/traceEmitter';

/* -- Props ------------------------------------------------------------------ */

export interface PlaybackDiffProps {
  eventA: TraceEvent;
  eventB: TraceEvent;
  /** Which sample field to diff. Defaults to `'output'`. */
  field?: 'input' | 'output';
  /**
   * Max diff lines to render (each "changed" line counts as 2, remove + add).
   * Defaults to 200.
   */
  maxLines?: number;
}

/* -- Diff types ------------------------------------------------------------- */

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

/* -- Helpers ---------------------------------------------------------------- */

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
 * Classic O(n*m) DP, acceptable for diff purposes where n/m stay in the hundreds.
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const n = a.length;
  const m = b.length;
  // Allocate a (n+1) x (m+1) table initialised to 0
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
 * objects representing the diff of arrays `a` to `b`.
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

/* -- Sub-components --------------------------------------------------------- */

const LINE_PALETTE: Record<DiffLineKind, string> = {
  unchanged: 'bg-transparent text-[var(--st-text-secondary)]',
  removed: 'bg-[var(--st-danger-soft)] text-[var(--st-text)]',
  added: 'bg-[var(--st-accent-soft)] text-[var(--st-text)]',
};

const LINE_GUTTER: Record<DiffLineKind, string> = {
  unchanged: 'text-[var(--st-text-tertiary)]',
  removed: 'text-[var(--st-danger)]',
  added: 'text-[var(--st-accent)]',
};

const LINE_SIGIL: Record<DiffLineKind, string> = {
  unchanged: ' ',
  removed: '-',
  added: '+',
};

interface DiffTableProps {
  lines: DiffLine[];
  side: 'left' | 'right';
}

function DiffTable({ lines, side }: DiffTableProps) {
  return (
    <div className="flex-1 min-w-0 overflow-auto font-mono text-[11.5px] leading-relaxed">
      <Table hover={false} className="w-full border-collapse">
        <TBody>
          {lines.map((line, idx) => {
            // On the left side we only show unchanged + removed lines.
            // On the right side we only show unchanged + added lines.
            const showOnLeft = line.kind === 'unchanged' || line.kind === 'removed';
            const showOnRight = line.kind === 'unchanged' || line.kind === 'added';
            const show = side === 'left' ? showOnLeft : showOnRight;
            if (!show) {
              // Render an invisible placeholder to keep row heights in sync
              return (
                <Tr key={idx} aria-hidden className="h-[1.5rem]">
                  <Td className="w-8 select-none" />
                  <Td />
                </Tr>
              );
            }
            const lineNum = side === 'left' ? line.lineA : line.lineB;
            return (
              <Tr
                key={idx}
                className={cn('h-[1.5rem]', LINE_PALETTE[line.kind])}
              >
                {/* Gutter: line number + sigil */}
                <Td
                  className={cn(
                    'w-10 select-none pr-2 text-right align-top',
                    'border-r border-[var(--st-border)]',
                    LINE_GUTTER[line.kind],
                  )}
                >
                  <span className="mr-1">{LINE_SIGIL[line.kind]}</span>
                  <span className="tabular-nums text-[10.5px]">
                    {lineNum ?? ''}
                  </span>
                </Td>
                {/* Content */}
                <Td className="pl-2 pr-2 align-top whitespace-pre-wrap break-all">
                  {line.text}
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}

/* -- PlaybackDiff ----------------------------------------------------------- */

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
    <div className="flex flex-col gap-2 text-[var(--st-text)]">
      {/* -- Header --------------------------------------------------------- */}
      <Card variant="outlined" padding="none" className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold">
            {fieldLabel} diff
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--st-text-tertiary)] font-mono truncate">
            <span className="text-[var(--st-text-secondary)]">A:</span>{' '}
            {nodeA}
            <span className="mx-1.5 text-[var(--st-text-tertiary)]">{'->'}</span>
            <span className="text-[var(--st-text-secondary)]">B:</span>{' '}
            {nodeB}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {stats.removed > 0 && (
            <Badge tone="danger" className="tabular-nums">
              -{stats.removed}
            </Badge>
          )}
          {stats.added > 0 && (
            <Badge tone="success" className="tabular-nums">
              +{stats.added}
            </Badge>
          )}
          {!hasChanges && (
            <Badge tone="neutral">identical</Badge>
          )}
        </div>
      </Card>

      {/* -- Column headers ------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-px">
        <div className="flex items-center gap-2 rounded-tl-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-1.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[var(--st-danger-soft)] text-[9px] font-bold text-[var(--st-danger)]">
            A
          </span>
          <span className="text-[11.5px] font-medium text-[var(--st-text-secondary)] truncate">
            {fieldLabel} , event A
          </span>
          <span className="ml-auto text-[10.5px] tabular-nums text-[var(--st-text-tertiary)]">
            ts {eventA.ts}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-tr-[var(--st-radius)] border border-l-0 border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-1.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[var(--st-accent-soft)] text-[9px] font-bold text-[var(--st-accent)]">
            B
          </span>
          <span className="text-[11.5px] font-medium text-[var(--st-text-secondary)] truncate">
            {fieldLabel} , event B
          </span>
          <span className="ml-auto text-[10.5px] tabular-nums text-[var(--st-text-tertiary)]">
            ts {eventB.ts}
          </span>
        </div>
      </div>

      {/* -- Diff body ------------------------------------------------------ */}
      {lines.length === 0 ? (
        <Card variant="outlined" padding="none" className="border-dashed py-8">
          <EmptyState
            size="sm"
            icon={FileX}
            title={`No ${fieldLabel.toLowerCase()} data`}
            description="Neither event recorded a sample for this field."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-px rounded-b-[var(--st-radius)] overflow-hidden border border-t-0 border-[var(--st-border)] bg-[var(--st-border)]">
          <div className="overflow-hidden bg-[var(--st-bg)]">
            <DiffTable lines={lines} side="left" />
          </div>
          <div className="overflow-hidden bg-[var(--st-bg)]">
            <DiffTable lines={lines} side="right" />
          </div>
        </div>
      )}

      {/* -- Truncation notice --------------------------------------------- */}
      {stats.total > maxLines && (
        <p className="text-[11px] text-[var(--st-text-tertiary)] text-center">
          Showing first {maxLines} of {stats.total} diff lines.
        </p>
      )}
    </div>
  );
}
