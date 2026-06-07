'use client';

/**
 * DiffRow
 *
 * Generic row component used throughout the flow diff view. Renders a
 * +/- / ~ indicator, a labelled chip, and an optional expandable details
 * block for "modified" entries that carry a list of granular changes.
 *
 * Kind mapping:
 *   - added    -> Added
 *   - removed  -> Removed
 *   - modified -> Modified
 */

import { useState, type ReactNode } from 'react';
import { Plus, Minus, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge, IconButton, cn } from '@/components/sabcrm/20ui';

/* -- Types --------------------------------------------------------------- */

export type DiffKind = 'added' | 'removed' | 'modified';

export interface DiffRowProps {
  kind: DiffKind;
  /** Primary label, e.g. the entity name. */
  label: string;
  /**
   * Short domain tag rendered next to the label (e.g. "Group", "Edge",
   * "Variable"). Helps readers scan mixed lists.
   */
  typeLabel?: string;
  /** Secondary info shown under the label (e.g. entity id, timestamps). */
  subtext?: ReactNode;
  /**
   * Granular changes for "modified" entries, rendered inside an
   * expandable block. Ignored when `kind !== 'modified'` or when
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

/* -- Style tokens per kind ----------------------------------------------- */

const KIND_LABEL: Record<DiffKind, string> = {
  added: 'Added',
  removed: 'Removed',
  modified: 'Modified',
};

function KindIcon({ kind }: { kind: DiffKind }) {
  const props = { className: 'h-3 w-3', strokeWidth: 2.5, 'aria-hidden': true } as const;
  if (kind === 'added') return <Plus {...props} />;
  if (kind === 'removed') return <Minus {...props} />;
  return <Pencil {...props} />;
}

/* -- Component ----------------------------------------------------------- */

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

  return (
    <div
      className={cn(
        'rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2.5 transition-colors',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Indicator icon */}
        <div
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
          aria-hidden="true"
        >
          <KindIcon kind={kind} />
        </div>

        {/* Primary content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <Badge tone="neutral" kind="soft" className="shrink-0 uppercase">
              {KIND_LABEL[kind]}
            </Badge>
            {typeLabel && (
              <Badge tone="neutral" kind="soft" className="shrink-0 uppercase">
                {typeLabel}
              </Badge>
            )}
            <span className="truncate text-[12.5px] font-medium text-[var(--st-text)]">
              {label}
            </span>
          </div>
          {subtext && (
            <div className="mt-0.5 text-[11px] text-[var(--st-text-tertiary)]">{subtext}</div>
          )}
        </div>

        {/* Expand/collapse, only relevant for modified rows with detail lines */}
        {hasDetails && (
          <IconButton
            label={isExpanded ? 'Collapse changes' : 'Expand changes'}
            icon={isExpanded ? ChevronDown : ChevronRight}
            size="sm"
            onClick={() => setIsExpanded((v) => !v)}
            aria-expanded={isExpanded}
            className="shrink-0"
          />
        )}
      </div>

      {/* Detail list */}
      {hasDetails && isExpanded && (
        <ul className="mt-2 ml-8 space-y-1">
          {details!.map((d, i) => (
            <li
              key={`${d}-${i}`}
              className="flex items-start gap-1.5 text-[11.5px] leading-snug text-[var(--st-text-secondary)]"
            >
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--st-text-tertiary)]" aria-hidden="true" />
              <span className="min-w-0 flex-1">{d}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
