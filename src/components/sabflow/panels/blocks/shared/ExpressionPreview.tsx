'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   ExpressionPreview
   ────────────────────────────────────────────────────────────────────────────
   Debounced live preview of a resolved expression, displayed underneath an
   editor as faint gray text.  Shows `= resolvedValue` on success, or a red
   error row with a LuCircleAlert icon on failure.  Long results are truncated
   to a single line with an inline "show full" link that reveals the complete
   value as a scrollable block.
   ──────────────────────────────────────────────────────────────────────────── */

import { memo, useEffect, useMemo, useState } from 'react';
import { LuCircleAlert } from 'react-icons/lu';
import type { Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import {
  resolveExpression,
  type ExpressionContext,
  type ResolveResult,
} from './expressionResolver';

/* ── Props ────────────────────────────────────────────────────────────────── */

export interface ExpressionPreviewProps {
  /** Raw value written by the user (with or without `=` prefix). */
  value: string;
  /** Available variables for interpolation. */
  variables: Variable[];
  /** Upstream nodes + their sample output schemas. */
  nodes?: ExpressionContext['nodes'];
  /** Debounce delay in milliseconds — defaults to 200 ms. */
  debounceMs?: number;
  /** Max characters shown inline before offering "show full". */
  truncateAt?: number;
  className?: string;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function stripEquals(value: string): string {
  return value.startsWith('=') ? value.slice(1) : value;
}

function formatPreview(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/* ── Component ────────────────────────────────────────────────────────────── */

function ExpressionPreviewInner({
  value,
  variables,
  nodes,
  debounceMs = 200,
  truncateAt = 140,
  className,
}: ExpressionPreviewProps) {
  const [debounced, setDebounced] = useState(value);
  const [expanded, setExpanded] = useState(false);

  // Collapse when the user edits.
  useEffect(() => {
    setExpanded(false);
  }, [value]);

  // Debounce user input.
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), debounceMs);
    return () => window.clearTimeout(handle);
  }, [value, debounceMs]);

  const result = useMemo<ResolveResult>(() => {
    const expression = stripEquals(debounced);
    if (!expression.trim()) return { ok: true, value: '' };
    return resolveExpression(expression, { variables, nodes });
  }, [debounced, variables, nodes]);

  if (!debounced.trim()) return null;

  if (!result.ok) {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-start gap-1.5 text-[11px] text-red-400 leading-snug',
          className,
        )}
      >
        <LuCircleAlert
          className="h-3.5 w-3.5 shrink-0 mt-[1px]"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <span className="font-mono break-words">{result.error}</span>
      </div>
    );
  }

  const formatted = formatPreview(result.value);
  const isLong = formatted.length > truncateAt;
  const display = !expanded && isLong ? `${formatted.slice(0, truncateAt)}…` : formatted;

  return (
    <div
      className={cn(
        'text-[11px] text-[var(--gray-8)] leading-snug flex flex-wrap items-baseline gap-1',
        className,
      )}
    >
      <span className="text-[var(--gray-7)] select-none">=</span>
      <span
        className={cn(
          'font-mono text-[var(--gray-9)] break-words',
          !expanded && 'truncate max-w-full',
        )}
      >
        {display}
      </span>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-[10.5px] text-[#f76808] hover:underline"
        >
          {expanded ? 'collapse' : 'show full'}
        </button>
      )}
    </div>
  );
}

export const ExpressionPreview = memo(ExpressionPreviewInner);
