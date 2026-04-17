'use client';

/**
 * ScriptTestPanel — shown after the user clicks "Test run" in the Script
 * block's settings. Presents the sandbox's SandboxResult across four tabs:
 *
 *   • Result             — JSON-pretty-printed return value
 *   • Logs               — console.log / .error entries
 *   • Variables changed  — diff (before → after) for mutated variables
 *   • Error              — stack trace, only when the run failed
 */

import { useMemo, useState } from 'react';
import {
  LuCircleCheck,
  LuCircleX,
  LuInfo,
  LuTriangleAlert,
  LuClock,
  LuX,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { SandboxResult } from '@/lib/sabflow/execution/sandbox';

type TabId = 'result' | 'logs' | 'vars' | 'error';

type Props = {
  result: SandboxResult;
  variablesBefore: Record<string, unknown>;
  onClose?: () => void;
};

export function ScriptTestPanel({ result, variablesBefore, onClose }: Props) {
  const defaultTab: TabId = result.success ? 'result' : 'error';
  const [tab, setTab] = useState<TabId>(defaultTab);

  const tabs: { id: TabId; label: string; disabled?: boolean }[] = useMemo(
    () => [
      { id: 'result', label: 'Result' },
      { id: 'logs', label: `Logs (${result.logs.length})` },
      {
        id: 'vars',
        label: `Variables (${Object.keys(result.variables ?? {}).length})`,
      },
      { id: 'error', label: 'Error', disabled: result.success },
    ],
    [result],
  );

  return (
    <div className="mt-1 rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] overflow-hidden">
      {/* Header row */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 border-b border-[var(--gray-5)]',
          result.success ? 'bg-green-500/5' : 'bg-red-500/5',
        )}
      >
        {result.success ? (
          <LuCircleCheck
            className="h-3.5 w-3.5 text-green-500 shrink-0"
            strokeWidth={2.2}
            aria-label="Success"
          />
        ) : (
          <LuCircleX
            className="h-3.5 w-3.5 text-red-500 shrink-0"
            strokeWidth={2.2}
            aria-label="Error"
          />
        )}
        <span
          className={cn(
            'text-[11.5px] font-semibold uppercase tracking-wide',
            result.success ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400',
          )}
        >
          {result.success ? 'Passed' : 'Failed'}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-[var(--gray-8)] ml-auto">
          <LuClock className="h-3 w-3" strokeWidth={1.8} />
          {result.executionTimeMs}ms
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--gray-8)] hover:bg-[var(--gray-4)] hover:text-[var(--gray-11)] transition-colors"
          >
            <LuX className="h-3 w-3" strokeWidth={2.2} />
          </button>
        )}
      </div>

      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Test result sections"
        className="flex border-b border-[var(--gray-5)] bg-[var(--gray-1)]"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`script-test-${t.id}`}
            disabled={t.disabled}
            onClick={() => !t.disabled && setTab(t.id)}
            className={cn(
              'flex-1 px-2 py-2 text-[11px] font-medium transition-colors',
              t.disabled
                ? 'text-[var(--gray-6)] cursor-not-allowed'
                : tab === t.id
                ? 'text-[#f76808] border-b-2 border-[#f76808] -mb-px'
                : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div
        id={`script-test-${tab}`}
        role="tabpanel"
        className="p-3 max-h-[320px] overflow-y-auto"
      >
        {tab === 'result' && <ResultTab result={result} />}
        {tab === 'logs' && <LogsTab logs={result.logs} />}
        {tab === 'vars' && (
          <VariablesTab before={variablesBefore} after={result.variables ?? {}} />
        )}
        {tab === 'error' && <ErrorTab message={result.error} />}
      </div>
    </div>
  );
}

/* ── Tabs ────────────────────────────────────────────────────────────────── */

function ResultTab({ result }: { result: SandboxResult }) {
  // Hooks must run unconditionally, before any early return.
  const pretty = useMemo(() => safeStringify(result.returnValue), [result]);
  if (!result.success) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-[var(--gray-9)]">
        <LuInfo className="h-3.5 w-3.5" strokeWidth={1.8} />
        Script failed — see the Error tab for details.
      </div>
    );
  }
  return (
    <pre
      className={cn(
        'rounded-lg bg-[#0d0d0d] p-3',
        'font-mono text-[11.5px] leading-[1.55] text-green-400',
        'overflow-auto whitespace-pre-wrap break-words',
      )}
    >
      {pretty}
    </pre>
  );
}

function LogsTab({ logs }: { logs: SandboxResult['logs'] }) {
  if (logs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-[var(--gray-9)]">
        <LuInfo className="h-3.5 w-3.5" strokeWidth={1.8} />
        No log output.
      </div>
    );
  }
  return (
    <ul className="space-y-1">
      {logs.map((entry, idx) => (
        <li
          key={idx}
          className={cn(
            'flex items-start gap-2 rounded-md px-2 py-1.5',
            'font-mono text-[11.5px] leading-relaxed',
            entry.level === 'error'
              ? 'bg-red-500/5 text-red-600 dark:text-red-400'
              : 'bg-[var(--gray-1)] text-[var(--gray-12)]',
          )}
        >
          {entry.level === 'error' ? (
            <LuTriangleAlert
              className="h-3 w-3 mt-0.5 shrink-0"
              strokeWidth={2}
              aria-label="error"
            />
          ) : (
            <LuInfo
              className="h-3 w-3 mt-0.5 shrink-0 text-[var(--gray-8)]"
              strokeWidth={1.8}
              aria-label="log"
            />
          )}
          <span className="whitespace-pre-wrap break-words">{entry.message}</span>
        </li>
      ))}
    </ul>
  );
}

function VariablesTab({
  before,
  after,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const keys = useMemo(() => Object.keys(after), [after]);
  if (keys.length === 0) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-[var(--gray-9)]">
        <LuInfo className="h-3.5 w-3.5" strokeWidth={1.8} />
        No variables changed.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-[var(--gray-4)] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] overflow-hidden">
      {keys.map((k) => {
        const b = safeStringify(before[k]);
        const a = safeStringify(after[k]);
        const changed = b !== a;
        return (
          <li key={k} className="px-3 py-2 text-[11.5px]">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[var(--gray-11)]">{k}</span>
              {changed && (
                <span className="text-[9.5px] font-semibold text-[#f76808] uppercase tracking-widest">
                  changed
                </span>
              )}
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <span className="text-[var(--gray-8)]">before</span>
              <code className="font-mono text-[var(--gray-10)] whitespace-pre-wrap break-words">
                {b}
              </code>
              <span className="text-[var(--gray-8)]">after</span>
              <code
                className={cn(
                  'font-mono whitespace-pre-wrap break-words',
                  changed ? 'text-[#f76808]' : 'text-[var(--gray-10)]',
                )}
              >
                {a}
              </code>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ErrorTab({ message }: { message?: string }) {
  if (!message) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-[var(--gray-9)]">
        <LuInfo className="h-3.5 w-3.5" strokeWidth={1.8} />
        No error.
      </div>
    );
  }
  return (
    <pre
      className={cn(
        'rounded-lg bg-red-500/5 border border-red-500/20 p-3',
        'font-mono text-[11px] leading-relaxed text-red-600 dark:text-red-400',
        'overflow-auto whitespace-pre-wrap break-words',
      )}
    >
      {message}
    </pre>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function safeStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
