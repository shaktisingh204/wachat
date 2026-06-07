'use client';

/**
 * StepTimelineItem - a single row in the debug "Steps" tab.
 *
 * Shows a compact summary (icon + label + timestamp + duration) and,
 * when expanded, a JSON dump of options / inputs / outputs / errors.
 */

import { useState, memo, type ReactNode } from 'react';
import {
  Circle,
  MessageSquare,
  GitBranch,
  Variable,
  ArrowRight,
  CornerDownRight,
  Clock,
  ChevronRight,
  ChevronDown,
  CircleAlert,
  Code,
  Globe,
  Check,
  TimerReset,
} from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui';
import type { DebugStep } from '@/lib/sabflow/debug/types';

const ICON_SIZE = 'h-3.5 w-3.5';
const ICON_STROKE = 2;

function iconFor(type: string): ReactNode {
  switch (type) {
    case 'init':
      return <Circle className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />;
    case 'message':
    case 'text':
      return <MessageSquare className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />;
    case 'condition':
      return <GitBranch className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />;
    case 'set_variable':
      return <Variable className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />;
    case 'input':
      return <CornerDownRight className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />;
    case 'jump':
    case 'redirect':
      return <ArrowRight className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />;
    case 'wait':
      return <TimerReset className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />;
    case 'script':
      return <Code className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />;
    case 'webhook':
    case 'integration':
      return <Globe className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />;
    case 'end':
      return <Check className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />;
    case 'error':
      return <CircleAlert className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />;
    default:
      return <Circle className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />;
  }
}

function fmtTimestamp(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const mmm = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${mmm}`;
}

function fmtJSON(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

interface Props {
  step: DebugStep;
  /** If true, render expanded by default. */
  defaultOpen?: boolean;
}

function StepTimelineItemImpl({ step, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const hasDetails =
    !!step.options || !!step.inputs || !!step.outputs || !!step.error;

  const isError = !!step.error;

  return (
    <div
      className={
        'rounded-[var(--st-radius)] border bg-[var(--st-bg)] overflow-hidden ' +
        (isError ? 'border-[var(--st-danger)]/40' : 'border-[var(--st-border)]')
      }
    >
      <Button
        variant="ghost"
        block
        onClick={() => hasDetails && setOpen((o) => !o)}
        aria-expanded={hasDetails ? open : undefined}
        className={
          '!h-auto !justify-start !rounded-none !px-2.5 !py-1.5 ' +
          (hasDetails ? 'cursor-pointer' : '!cursor-default hover:!bg-transparent')
        }
      >
        <span className="flex w-full items-center gap-2 text-left">
          {hasDetails ? (
            open ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-[var(--st-text-tertiary)]" strokeWidth={2} aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-[var(--st-text-tertiary)]" strokeWidth={2} aria-hidden="true" />
            )
          ) : (
            <span className="h-3 w-3 shrink-0" />
          )}
          <span
            className={
              'flex h-5 w-5 items-center justify-center rounded-[var(--st-radius-sm)] shrink-0 ' +
              (isError
                ? 'bg-[var(--st-danger-soft)] text-[var(--st-danger)]'
                : 'bg-[var(--st-bg-secondary)] text-[var(--st-text)]')
            }
          >
            {iconFor(step.blockType)}
          </span>

          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--st-text)]">
            {step.label ?? step.blockType}
            {step.groupName ? (
              <span className="text-[var(--st-text-tertiary)] font-normal">
                {' · '}
                {step.groupName}
              </span>
            ) : null}
          </span>

          <span className="flex items-center gap-1.5 text-[10.5px] tabular-nums text-[var(--st-text-tertiary)] shrink-0">
            <span className="font-mono">{fmtTimestamp(step.timestamp)}</span>
            {typeof step.duration === 'number' ? (
              <span className="inline-flex items-center gap-0.5 rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] px-1.5 py-0.5">
                <Clock className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />
                {step.duration}ms
              </span>
            ) : null}
          </span>
        </span>
      </Button>

      {open && hasDetails ? (
        <div className="border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2.5 py-2 space-y-2">
          {step.error ? (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--st-danger)]">
                Error
              </div>
              <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-[var(--st-danger)]">
                {step.error}
              </pre>
            </div>
          ) : null}
          {step.options ? (
            <Section title="Options" body={fmtJSON(step.options)} />
          ) : null}
          {step.inputs ? <Section title="Inputs" body={fmtJSON(step.inputs)} /> : null}
          {step.outputs ? <Section title="Outputs" body={fmtJSON(step.outputs)} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {title}
      </div>
      <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap break-all rounded-[var(--st-radius-sm)] bg-[var(--st-bg)] p-2 font-mono text-[11px] leading-snug text-[var(--st-text-secondary)]">
        {body}
      </pre>
    </div>
  );
}

export const StepTimelineItem = memo(StepTimelineItemImpl);
