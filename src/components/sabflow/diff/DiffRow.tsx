'use client';

/**
 * DiffRow
 *
 * Generic row component used throughout the flow diff view.  Renders a
 * +/- / ~ indicator, a coloured label, and an optional expandable details
 * block for "modified" entries that carry a list of granular changes.
 *
 * Kind colour mapping:
 *   - added    → green
 *   - removed  → red
 *   - modified → amber
 */

import { useState, type ReactNode } from 'react';
import { LuPlus, LuMinus, LuPencil, LuChevronDown, LuChevronRight } from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Types ──────────────────────────────────────────────────────────────── */

export type DiffKind = 'added' | 'removed' | 'modified';

export interface DiffRowProps {
  kind: DiffKind;
  /** Primary label — e.g. the entity name. */
  label: string;
  /**
   * Short domain tag rendered next to the label (e.g. "Group", "Edge",
   * "Variable").  Helps readers scan mixed lists.
   */
  typeLabel?: string;
  /** Secondary info shown under the label (e.g. entity id, timestamps). */
  subtext?: ReactNode;
  /**
   * Granular changes for "modified" entries — rendered inside an
   * expandable block.  Ignored when `kind !== 'modified'` or when
   * the array is empty.
   */
  details?: readonly string[];
  /**
   * Whether the details block is expanded by default. Irrelevant when
   * `details` is empty.
   */
  defaultExpanded?: boolean;
  className?: string;
}

/* ── Style tokens per kind ──────────────────────────────────────────────── */

const KIND_STYLES: Record<DiffKind, {
  rowBorder: string;
  rowBg: string;
  iconBg: string;
  iconColor: string;
  chipBg: string;
  chipText: string;
  chipLabel: string;
}> = {
  added: {
    rowBorder: 'border-green-200 dark:border-green-900/60',
    rowBg: 'bg-green-50/60 dark:bg-green-950/20',
    iconBg: 'bg-green-100 dark:bg-green-900/40',
    iconColor: 'text-green-600 dark:text-green-400',
    chipBg: 'bg-green-100 dark:bg-green-900/40',
    chipText: 'text-green-700 dark:text-green-300',
    chipLabel: 'Added',
  },
  removed: {
    rowBorder: 'border-red-200 dark:border-red-900/60',
    rowBg: 'bg-red-50/60 dark:bg-red-950/20',
    iconBg: 'bg-red-100 dark:bg-red-900/40',
    iconColor: 'text-red-600 dark:text-red-400',
    chipBg: 'bg-red-100 dark:bg-red-900/40',
    chipText: 'text-red-700 dark:text-red-300',
    chipLabel: 'Removed',
  },
  modified: {
    rowBorder: 'border-amber-200 dark:border-amber-900/60',
    rowBg: 'bg-amber-50/60 dark:bg-amber-950/20',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    chipBg: 'bg-amber-100 dark:bg-amber-900/40',
    chipText: 'text-amber-700 dark:text-amber-300',
    chipLabel: 'Modified',
  },
};

function KindIcon({ kind }: { kind: DiffKind }) {
  const props = { className: 'h-3 w-3', strokeWidth: 2.5 } as const;
  if (kind === 'added') return <LuPlus {...props} />;
  if (kind === 'removed') return <LuMinus {...props} />;
  return <LuPencil {...props} />;
}

/* ── Component ──────────────────────────────────────────────────────────── */

export function DiffRow({
  kind,
  label,
  typeLabel,
  subtext,
  details,
  defaultExpanded = true,
  className,
}: DiffRowProps) {
  const hasDetails = kind === 'modified' && !!details && details.length > 0;
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  const styles = KIND_STYLES[kind];

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5 transition-colors',
        styles.rowBorder,
        styles.rowBg,
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Indicator icon */}
        <div
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg mt-0.5',
            styles.iconBg,
            styles.iconColor,
          )}
          aria-hidden="true"
        >
          <KindIcon kind={kind} />
        </div>

        {/* Primary content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span
              className={cn(
                'shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide',
                styles.chipBg,
                styles.chipText,
              )}
            >
              {styles.chipLabel}
            </span>
            {typeLabel && (
              <span className="shrink-0 rounded-md bg-[var(--gray-3)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-[var(--gray-10)]">
                {typeLabel}
              </span>
            )}
            <span className="truncate text-[12.5px] font-medium text-[var(--gray-12)]">
              {label}
            </span>
          </div>
          {subtext && (
            <div className="mt-0.5 text-[11px] text-[var(--gray-9)]">{subtext}</div>
          )}
        </div>

        {/* Expand/collapse — only relevant for modified rows with detail lines */}
        {hasDetails && (
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpanded ? 'Collapse changes' : 'Expand changes'}
            aria-expanded={isExpanded}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
          >
            {isExpanded
              ? <LuChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
              : <LuChevronRight className="h-3.5 w-3.5" strokeWidth={2} />}
          </button>
        )}
      </div>

      {/* Detail list */}
      {hasDetails && isExpanded && (
        <ul className="mt-2 ml-8 space-y-1">
          {details!.map((d, i) => (
            <li
              key={`${d}-${i}`}
              className="flex items-start gap-1.5 text-[11.5px] text-[var(--gray-11)] leading-snug"
            >
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
              <span className="min-w-0 flex-1">{d}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
