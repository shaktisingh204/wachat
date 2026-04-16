'use client';

import { useCallback, useState } from 'react';
import {
  LuShieldCheck,
  LuTriangleAlert as LuAlertTriangle,
  LuCircleAlert as LuAlertCircle,
  LuCircleCheck as LuCheckCircle,
  LuLoader,
  LuChevronDown,
  LuChevronRight,
  LuX,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { validateFlow, countValidationResults } from '@/lib/sabflow/validation';
import type { ValidationError, ValidationSeverity } from '@/lib/sabflow/validation';
import type { SabFlowDoc, Group } from '@/lib/sabflow/types';

/* ── Props ───────────────────────────────────────────────────────────────── */

export type ValidationPanelProps = {
  flow: SabFlowDoc;
  /** Navigate the canvas to the given group / block. */
  onFocusBlock: (groupId: string, blockId?: string) => void;
  /**
   * Called whenever a validation run completes. Useful for the parent to
   * update a badge count in the header without lifting the full results state.
   */
  onResultsChange?: (results: ValidationError[]) => void;
  onClose?: () => void;
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function resolveBlockName(
  groupId: string | undefined,
  blockId: string | undefined,
  groups: Group[],
): string | null {
  if (!groupId) return null;
  const group = groups.find((g) => g.id === groupId);
  if (!group) return null;
  if (!blockId) return group.title;
  const block = group.blocks.find((b) => b.id === blockId);
  if (!block) return group.title;
  return `${group.title} › ${block.type}`;
}

/* ── SeveritySection ─────────────────────────────────────────────────────── */

type SeveritySectionProps = {
  severity: ValidationSeverity;
  items: ValidationError[];
  groups: Group[];
  defaultOpen: boolean;
  onFocusBlock: (groupId: string, blockId?: string) => void;
};

function SeveritySection({
  severity,
  items,
  groups,
  defaultOpen,
  onFocusBlock,
}: SeveritySectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const isError = severity === 'error';
  const Icon = isError ? LuAlertCircle : LuAlertTriangle;

  const headerColorCls = isError
    ? 'text-red-600 dark:text-red-400'
    : 'text-amber-600 dark:text-amber-400';

  const iconBgCls = isError
    ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
    : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400';

  const rowHoverCls = isError
    ? 'hover:bg-red-50/60 dark:hover:bg-red-950/20'
    : 'hover:bg-amber-50/60 dark:hover:bg-amber-950/20';

  const label = isError ? 'Errors' : 'Warnings';

  return (
    <div className="rounded-xl border border-[var(--gray-5)] overflow-hidden">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 bg-[var(--gray-2)] hover:bg-[var(--gray-3)] transition-colors"
      >
        <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', iconBgCls)}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
        <span className={cn('flex-1 text-left text-[12.5px] font-semibold', headerColorCls)}>
          {label}
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums',
            iconBgCls,
          )}
        >
          {items.length}
        </span>
        {open ? (
          <LuChevronDown className="h-3.5 w-3.5 text-[var(--gray-9)] shrink-0" strokeWidth={2.5} />
        ) : (
          <LuChevronRight className="h-3.5 w-3.5 text-[var(--gray-9)] shrink-0" strokeWidth={2.5} />
        )}
      </button>

      {/* Items list */}
      {open && (
        <ul className="divide-y divide-[var(--gray-4)] bg-[var(--gray-1)]">
          {items.map((err) => {
            const locationLabel = resolveBlockName(err.groupId, err.blockId, groups);
            const isClickable = Boolean(err.groupId);

            return (
              <li key={err.id}>
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => {
                    if (err.groupId) onFocusBlock(err.groupId, err.blockId);
                  }}
                  className={cn(
                    'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
                    isClickable ? rowHoverCls + ' cursor-pointer' : 'cursor-default',
                  )}
                >
                  <Icon
                    className={cn('mt-px h-3.5 w-3.5 shrink-0', headerColorCls)}
                    strokeWidth={2}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-[var(--gray-12)] leading-snug">
                      {err.message}
                    </p>
                    {locationLabel && (
                      <p className="mt-0.5 text-[11px] text-[var(--gray-9)] font-mono truncate">
                        {locationLabel}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── EmptyState ──────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400">
        <LuCheckCircle className="h-6 w-6" strokeWidth={1.8} />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[var(--gray-12)]">All good!</p>
        <p className="mt-0.5 text-[11.5px] text-[var(--gray-9)]">
          No issues found in this flow.
        </p>
      </div>
    </div>
  );
}

/* ── ValidationPanel ─────────────────────────────────────────────────────── */

export function ValidationPanel({ flow, onFocusBlock, onResultsChange, onClose }: ValidationPanelProps) {
  const [results, setResults] = useState<ValidationError[] | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = useCallback(() => {
    setRunning(true);
    // Run synchronously but defer UI update to next tick so the spinner shows
    requestAnimationFrame(() => {
      const errors = validateFlow(flow);
      setResults(errors);
      setRunning(false);
      onResultsChange?.(errors);
    });
  }, [flow, onResultsChange]);

  const { errorCount, warningCount } = results
    ? countValidationResults(results)
    : { errorCount: 0, warningCount: 0 };

  const errors = results?.filter((e) => e.severity === 'error') ?? [];
  const warnings = results?.filter((e) => e.severity === 'warning') ?? [];

  return (
    <div className="w-[320px] shrink-0 flex flex-col border-l border-[var(--gray-5)] bg-[var(--gray-1)] z-20 overflow-hidden">
      {/* ── Panel header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 border-b border-[var(--gray-4)] px-4 py-3 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--gray-3)] text-[var(--gray-11)] shrink-0">
          <LuShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)]">
          Validation
        </span>

        {/* Summary badges (shown after a run) */}
        {results !== null && (
          <div className="flex items-center gap-1 shrink-0">
            {errorCount > 0 && (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-red-600 dark:bg-red-950/40 dark:text-red-400">
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                {warningCount}
              </span>
            )}
            {errorCount === 0 && warningCount === 0 && (
              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10.5px] font-bold text-green-600 dark:bg-green-950/40 dark:text-green-400">
                OK
              </span>
            )}
          </div>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
          >
            <LuX className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* ── Run button row ────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-[var(--gray-4)] shrink-0">
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors',
            running
              ? 'bg-[var(--gray-4)] text-[var(--gray-9)] cursor-wait'
              : 'bg-[var(--gray-12)] text-[var(--gray-1)] hover:opacity-90 active:opacity-80',
          )}
        >
          {running ? (
            <LuLoader className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <LuShieldCheck className="h-4 w-4" strokeWidth={2} />
          )}
          {running ? 'Checking…' : results === null ? 'Run validation' : 'Re-run validation'}
        </button>
      </div>

      {/* ── Results body ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {results === null ? (
          /* Pre-run placeholder */
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--gray-3)] text-[var(--gray-9)]">
              <LuShieldCheck className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[12.5px] font-medium text-[var(--gray-11)]">
                Not yet checked
              </p>
              <p className="mt-0.5 text-[11.5px] text-[var(--gray-9)]">
                Click "Run validation" to inspect the flow for issues.
              </p>
            </div>
          </div>
        ) : results.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {errors.length > 0 && (
              <SeveritySection
                severity="error"
                items={errors}
                groups={flow.groups}
                defaultOpen
                onFocusBlock={onFocusBlock}
              />
            )}
            {warnings.length > 0 && (
              <SeveritySection
                severity="warning"
                items={warnings}
                groups={flow.groups}
                defaultOpen={errors.length === 0}
                onFocusBlock={onFocusBlock}
              />
            )}
          </>
        )}
      </div>

      {/* ── Footer hint ──────────────────────────────────────────────────── */}
      {results !== null && results.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[var(--gray-4)] shrink-0">
          <p className="text-[11px] text-[var(--gray-9)]">
            Click an item to navigate to the affected block.
          </p>
        </div>
      )}
    </div>
  );
}
