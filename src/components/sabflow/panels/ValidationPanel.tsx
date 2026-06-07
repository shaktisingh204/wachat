'use client';

import { useCallback, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  cn,
  Badge,
  Button,
  IconButton,
  EmptyState,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/sabcrm/20ui';
import { validateFlow, countValidationResults } from '@/lib/sabflow/validation';
import type { ValidationError, ValidationSeverity } from '@/lib/sabflow/validation';
import type { SabFlowDoc, Group } from '@/lib/sabflow/types';

/* -- Props ----------------------------------------------------------------- */

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

/* -- Helpers --------------------------------------------------------------- */

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
  return `${group.title} > ${block.type}`;
}

/* -- SeveritySection ------------------------------------------------------- */

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
  const Icon = isError ? AlertCircle : AlertTriangle;
  const tone = isError ? 'danger' : 'warning';
  const label = isError ? 'Errors' : 'Warnings';

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)]"
    >
      {/* Section header */}
      <CollapsibleTrigger className="flex w-full items-center gap-2.5 bg-[var(--st-bg-secondary)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--st-bg-muted)]">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
          <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="flex-1 text-[12.5px] font-semibold text-[var(--st-text)]">
          {label}
        </span>
        <Badge tone={tone} kind="soft" className="tabular-nums">
          {items.length}
        </Badge>
      </CollapsibleTrigger>

      {/* Items list */}
      <CollapsibleContent>
        <ul className="divide-y divide-[var(--st-border)] bg-[var(--st-bg)]">
          {items.map((err) => {
            const locationLabel = resolveBlockName(err.groupId, err.blockId, groups);
            const isClickable = Boolean(err.groupId);

            return (
              <li key={err.id}>
                <Button
                  variant="ghost"
                  disabled={!isClickable}
                  onClick={() => {
                    if (err.groupId) onFocusBlock(err.groupId, err.blockId);
                  }}
                  className={cn(
                    'flex h-auto w-full items-start gap-2.5 rounded-none px-3 py-2.5 text-left',
                    isClickable ? 'cursor-pointer' : 'cursor-default',
                  )}
                >
                  <Icon
                    className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] leading-snug text-[var(--st-text)]">
                      {err.message}
                    </span>
                    {locationLabel && (
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-[var(--st-text-tertiary)]">
                        {locationLabel}
                      </span>
                    )}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* -- ValidationPanel ------------------------------------------------------- */

export function ValidationPanel({ flow, onFocusBlock, onResultsChange, onClose }: ValidationPanelProps) {
  const [results, setResults] = useState<ValidationError[] | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = useCallback(() => {
    setRunning(true);
    // Run synchronously but defer UI update to next tick so the spinner shows.
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
    <div className="z-20 flex w-[320px] shrink-0 flex-col overflow-hidden border-l border-[var(--st-border)] bg-[var(--st-bg)]">
      {/* Panel header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--st-border)] px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="flex-1 text-[13px] font-semibold text-[var(--st-text)]">
          Validation
        </span>

        {/* Summary badges (shown after a run) */}
        {results !== null && (
          <div className="flex shrink-0 items-center gap-1">
            {errorCount > 0 && (
              <Badge tone="danger" kind="soft" className="tabular-nums">
                {errorCount}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge tone="warning" kind="soft" className="tabular-nums">
                {warningCount}
              </Badge>
            )}
            {errorCount === 0 && warningCount === 0 && (
              <Badge tone="success" kind="soft">
                OK
              </Badge>
            )}
          </div>
        )}

        {onClose && (
          <IconButton
            label="Close validation panel"
            icon={X}
            size="sm"
            onClick={onClose}
            className="shrink-0"
          />
        )}
      </div>

      {/* Run button row */}
      <div className="shrink-0 border-b border-[var(--st-border)] px-4 py-3">
        <Button
          variant="primary"
          block
          loading={running}
          iconLeft={ShieldCheck}
          onClick={handleRun}
        >
          {running ? 'Checking...' : results === null ? 'Run validation' : 'Re-run validation'}
        </Button>
      </div>

      {/* Results body */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {results === null ? (
          /* Pre-run placeholder */
          <EmptyState
            icon={ShieldCheck}
            tone="neutral"
            title="Not yet checked"
            description='Click "Run validation" to inspect the flow for issues.'
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            tone="success"
            title="All good"
            description="No issues found in this flow."
          />
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

      {/* Footer hint */}
      {results !== null && results.length > 0 && (
        <div className="shrink-0 border-t border-[var(--st-border)] px-4 py-2.5">
          <p className="text-[11px] text-[var(--st-text-tertiary)]">
            Click an item to navigate to the affected block.
          </p>
        </div>
      )}
    </div>
  );
}
