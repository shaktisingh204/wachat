'use client';

/**
 * StepTimelineItem — a single row in the debug "Steps" tab.
 *
 * Shows a compact summary (icon + label + timestamp + duration) and,
 * when expanded, a JSON dump of options / inputs / outputs / errors.
 */

import { useState, memo, type ReactNode } from 'react';
import {
  LuCircle,
  LuMessageSquare,
  LuGitBranch,
  LuVariable,
  LuArrowRight,
  LuCornerDownRight,
  LuClock,
  LuChevronRight,
  LuChevronDown,
  LuCircleAlert,
  LuCode,
  LuGlobe,
  LuCheck,
  LuTimerReset,
} from 'react-icons/lu';
import type { DebugStep } from '@/lib/sabflow/debug/types';

const ICON_SIZE = 'h-3.5 w-3.5';
const ICON_STROKE = 2;

function iconFor(type: string): ReactNode {
  switch (type) {
    case 'init':
      return <LuCircle className={ICON_SIZE} strokeWidth={ICON_STROKE} />;
    case 'message':
    case 'text':
      return <LuMessageSquare className={ICON_SIZE} strokeWidth={ICON_STROKE} />;
    case 'condition':
      return <LuGitBranch className={ICON_SIZE} strokeWidth={ICON_STROKE} />;
    case 'set_variable':
      return <LuVariable className={ICON_SIZE} strokeWidth={ICON_STROKE} />;
    case 'input':
      return <LuCornerDownRight className={ICON_SIZE} strokeWidth={ICON_STROKE} />;
    case 'jump':
    case 'redirect':
      return <LuArrowRight className={ICON_SIZE} strokeWidth={ICON_STROKE} />;
    case 'wait':
      return <LuTimerReset className={ICON_SIZE} strokeWidth={ICON_STROKE} />;
    case 'script':
      return <LuCode className={ICON_SIZE} strokeWidth={ICON_STROKE} />;
    case 'webhook':
    case 'integration':
      return <LuGlobe className={ICON_SIZE} strokeWidth={ICON_STROKE} />;
    case 'end':
      return <LuCheck className={ICON_SIZE} strokeWidth={ICON_STROKE} />;
    case 'error':
      return <LuCircleAlert className={ICON_SIZE} strokeWidth={ICON_STROKE} />;
    default:
      return <LuCircle className={ICON_SIZE} strokeWidth={ICON_STROKE} />;
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
  /** If true, render as error-styled row (amber/red accent). */
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
        'rounded-lg border border-[var(--gray-4)] bg-[var(--gray-1)] overflow-hidden ' +
        (isError ? 'border-red-300 dark:border-red-700/60 ' : '')
      }
    >
      <button
        type="button"
        onClick={() => hasDetails && setOpen((o) => !o)}
        className={
          'flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors ' +
          (hasDetails ? 'hover:bg-[var(--gray-3)] cursor-pointer' : 'cursor-default')
        }
      >
        {hasDetails ? (
          open ? (
            <LuChevronDown className="h-3 w-3 shrink-0 text-[var(--gray-9)]" strokeWidth={2} />
          ) : (
            <LuChevronRight className="h-3 w-3 shrink-0 text-[var(--gray-9)]" strokeWidth={2} />
          )
        ) : (
          <span className="h-3 w-3 shrink-0" />
        )}
        <span
          className={
            'flex h-5 w-5 items-center justify-center rounded-md shrink-0 ' +
            (isError
              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
              : 'bg-[#fff4ee] text-[#f76808]')
          }
        >
          {iconFor(step.blockType)}
        </span>

        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--gray-12)]">
          {step.label ?? step.blockType}
          {step.groupName ? (
            <span className="text-[var(--gray-8)] font-normal">
              {' · '}
              {step.groupName}
            </span>
          ) : null}
        </span>

        <span className="flex items-center gap-1.5 text-[10.5px] tabular-nums text-[var(--gray-8)] shrink-0">
          <span className="font-mono">{fmtTimestamp(step.timestamp)}</span>
          {typeof step.duration === 'number' ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-[var(--gray-3)] px-1.5 py-0.5">
              <LuClock className="h-2.5 w-2.5" strokeWidth={2} />
              {step.duration}ms
            </span>
          ) : null}
        </span>
      </button>

      {open && hasDetails ? (
        <div className="border-t border-[var(--gray-4)] bg-[var(--gray-2)] px-2.5 py-2 space-y-2">
          {step.error ? (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                Error
              </div>
              <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-red-700 dark:text-red-300">
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
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
        {title}
      </div>
      <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap break-all rounded bg-[var(--gray-1)] p-2 font-mono text-[11px] leading-snug text-[var(--gray-11)]">
        {body}
      </pre>
    </div>
  );
}

export const StepTimelineItem = memo(StepTimelineItemImpl);
