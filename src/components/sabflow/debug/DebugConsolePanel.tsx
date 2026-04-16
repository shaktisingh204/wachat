'use client';

/**
 * DebugConsolePanel — flow inspector shown alongside the preview.
 *
 * Tabs:
 *   - Steps    — execution timeline
 *   - Variables — live variable list with change highlights
 *   - Logs      — script / webhook console output
 *   - Network   — HTTP calls w/ expand details
 *
 * Header:
 *   - Pause/resume ingestion
 *   - Clear session
 *   - Export as JSON
 *   - Close
 *
 * Performance:
 *   - Subscribes to the debug store via a slice selector so unrelated
 *     updates never trigger re-renders.
 *   - The store's `active` flag is toggled on mount / unmount so that
 *     instrumentation helpers stay cheap when the panel is not open.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  LuTrash2,
  LuPause,
  LuPlay,
  LuDownload,
  LuX,
  LuSearch,
  LuTerminal,
  LuListOrdered,
  LuVariable,
  LuGlobe,
} from 'react-icons/lu';
import { useDebugStore } from '@/lib/sabflow/debug/store';
import type {
  DebugLog,
  DebugNetworkRequest,
  DebugStep,
  DebugVariableState,
} from '@/lib/sabflow/debug/types';
import { StepTimelineItem } from './StepTimelineItem';
import { VariableDiffItem, useTickingNow } from './VariableDiffItem';
import { NetworkRequestItem } from './NetworkRequestItem';

/* ── Tabs ─────────────────────────────────────────────────────────── */

type Tab = 'steps' | 'variables' | 'logs' | 'network';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'steps',
    label: 'Steps',
    icon: <LuListOrdered className="h-3.5 w-3.5" strokeWidth={2} />,
  },
  {
    id: 'variables',
    label: 'Variables',
    icon: <LuVariable className="h-3.5 w-3.5" strokeWidth={2} />,
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: <LuTerminal className="h-3.5 w-3.5" strokeWidth={2} />,
  },
  {
    id: 'network',
    label: 'Network',
    icon: <LuGlobe className="h-3.5 w-3.5" strokeWidth={2} />,
  },
];

/* ── Helpers ──────────────────────────────────────────────────────── */

function fmtTimestamp(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const mmm = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${mmm}`;
}

function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Allow the browser to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── Props ────────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional title (defaults to "Debug console"). */
  title?: string;
  /** Layout: side (left of preview) or bottom (drawer). */
  layout?: 'side' | 'bottom';
}

export function DebugConsolePanel({
  open,
  onClose,
  title = 'Debug console',
  layout = 'side',
}: Props) {
  /* ── Store subscriptions (only when open) ──────────────────────── */
  // `active` flag lives in the store so non-UI instrumentation can
  // short-circuit without ever touching React.
  const setActive = useDebugStore((s) => s.setActive);
  useEffect(() => {
    setActive(open);
    return () => setActive(false);
  }, [open, setActive]);

  // Individual slice selectors keep re-renders scoped to the active tab.
  const steps = useDebugStore((s) => s.steps);
  const variables = useDebugStore((s) => s.variables);
  const logs = useDebugStore((s) => s.logs);
  const network = useDebugStore((s) => s.network);
  const paused = useDebugStore((s) => s.paused);
  const pauseDebug = useDebugStore((s) => s.pauseDebug);
  const resumeDebug = useDebugStore((s) => s.resumeDebug);
  const clearDebugSession = useDebugStore((s) => s.clearDebugSession);
  const exportSessionJson = useDebugStore((s) => s.exportSessionJson);

  const [tab, setTab] = useState<Tab>('steps');
  const [filter, setFilter] = useState('');

  /* ── Filter logic (memoised per tab) ───────────────────────────── */

  const q = filter.trim().toLowerCase();

  const filteredSteps = useMemo<DebugStep[]>(() => {
    if (!q) return steps;
    return steps.filter((s) => {
      const hay = `${s.label ?? ''} ${s.blockType} ${s.groupName ?? ''} ${s.groupId ?? ''} ${
        s.blockId ?? ''
      } ${s.error ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [steps, q]);

  const filteredVariables = useMemo<Array<[string, DebugVariableState]>>(() => {
    const entries = Object.entries(variables);
    if (!q) return entries;
    return entries.filter(([name, v]) => {
      const valStr = (() => {
        try {
          return JSON.stringify(v.current);
        } catch {
          return String(v.current);
        }
      })();
      return (
        name.toLowerCase().includes(q) || valStr.toLowerCase().includes(q)
      );
    });
  }, [variables, q]);

  const filteredLogs = useMemo<DebugLog[]>(() => {
    if (!q) return logs;
    return logs.filter((l) =>
      `${l.level} ${l.source} ${l.message}`.toLowerCase().includes(q),
    );
  }, [logs, q]);

  const filteredNetwork = useMemo<DebugNetworkRequest[]>(() => {
    if (!q) return network;
    return network.filter((r) => {
      return (
        r.url.toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q) ||
        (r.status !== undefined && String(r.status).includes(q))
      );
    });
  }, [network, q]);

  /* ── Auto-scroll to bottom on new entries ──────────────────────── */

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeLen = (() => {
    switch (tab) {
      case 'steps':
        return filteredSteps.length;
      case 'variables':
        return filteredVariables.length;
      case 'logs':
        return filteredLogs.length;
      case 'network':
        return filteredNetwork.length;
    }
  })();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Only auto-scroll if user was already near the bottom.
    const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [activeLen, tab]);

  /* ── Ticking "now" for variable highlight fade-out ─────────────── */
  const now = useTickingNow(open && tab === 'variables', 500);

  /* ── Actions ───────────────────────────────────────────────────── */

  const onTogglePause = useCallback(() => {
    if (paused) resumeDebug();
    else pauseDebug();
  }, [paused, resumeDebug, pauseDebug]);

  const onExport = useCallback(() => {
    const json = exportSessionJson();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadJson(`sabflow-debug-${stamp}.json`, json);
  }, [exportSessionJson]);

  /* ── Early return when closed ──────────────────────────────────── */
  if (!open) return null;

  /* ── Render ────────────────────────────────────────────────────── */

  const layoutClasses =
    layout === 'bottom'
      ? 'shrink-0 w-full h-[340px] border-t border-[var(--gray-5)]'
      : 'shrink-0 h-full w-[420px] border-l border-[var(--gray-5)]';

  return (
    <div
      className={
        'flex flex-col bg-[var(--gray-1)] overflow-hidden relative ' + layoutClasses
      }
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[var(--gray-4)] bg-[var(--gray-2)] px-3 py-2 shrink-0">
        <LuTerminal className="h-3.5 w-3.5 text-[#f76808]" strokeWidth={2} />
        <span className="flex-1 text-[12.5px] font-semibold text-[var(--gray-12)]">
          {title}
        </span>

        <button
          type="button"
          onClick={onTogglePause}
          title={paused ? 'Resume ingestion' : 'Pause ingestion'}
          className={
            'flex h-6 w-6 items-center justify-center rounded-md transition-colors active:scale-95 ' +
            (paused
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300'
              : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]')
          }
        >
          {paused ? (
            <LuPlay className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <LuPause className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>

        <button
          type="button"
          onClick={clearDebugSession}
          title="Clear debug session"
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--gray-9)] transition-colors hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] active:scale-95"
        >
          <LuTrash2 className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={onExport}
          title="Export session as JSON"
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--gray-9)] transition-colors hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] active:scale-95"
        >
          <LuDownload className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={onClose}
          title="Close debug console"
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--gray-9)] transition-colors hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] active:scale-95"
        >
          <LuX className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-0.5 border-b border-[var(--gray-4)] bg-[var(--gray-2)] px-2 shrink-0">
        {TABS.map((t) => {
          const count =
            t.id === 'steps'
              ? steps.length
              : t.id === 'variables'
                ? Object.keys(variables).length
                : t.id === 'logs'
                  ? logs.length
                  : network.length;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] font-medium transition-colors rounded-t-md ' +
                (active
                  ? 'bg-[var(--gray-1)] text-[var(--gray-12)] border border-[var(--gray-4)] border-b-[var(--gray-1)] -mb-px'
                  : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]')
              }
            >
              {t.icon}
              {t.label}
              {count > 0 ? (
                <span
                  className={
                    'inline-flex min-w-[16px] items-center justify-center rounded px-1 text-[10px] font-semibold tabular-nums ' +
                    (active
                      ? 'bg-[#fff4ee] text-[#f76808]'
                      : 'bg-[var(--gray-3)] text-[var(--gray-10)]')
                  }
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
        {paused ? (
          <span className="ml-auto self-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            Paused
          </span>
        ) : null}
      </div>

      {/* ── Filter ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 border-b border-[var(--gray-4)] bg-[var(--gray-1)] px-3 py-1.5 shrink-0">
        <LuSearch className="h-3.5 w-3.5 text-[var(--gray-8)]" strokeWidth={2} />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${tab}…`}
          className="flex-1 min-w-0 bg-transparent text-[12px] outline-none placeholder:text-[var(--gray-7)] text-[var(--gray-12)]"
        />
        {filter ? (
          <button
            type="button"
            onClick={() => setFilter('')}
            className="text-[10px] text-[var(--gray-8)] hover:text-[var(--gray-12)]"
          >
            clear
          </button>
        ) : null}
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1.5"
      >
        {tab === 'steps' ? (
          filteredSteps.length === 0 ? (
            <EmptyState message="No steps yet. Start the preview to begin." />
          ) : (
            filteredSteps.map((s) => <StepTimelineItem key={s.id} step={s} />)
          )
        ) : null}

        {tab === 'variables' ? (
          filteredVariables.length === 0 ? (
            <EmptyState message="No variables captured yet." />
          ) : (
            filteredVariables.map(([name, v]) => (
              <VariableDiffItem key={name} name={name} state={v} now={now} />
            ))
          )
        ) : null}

        {tab === 'logs' ? (
          filteredLogs.length === 0 ? (
            <EmptyState message="No logs yet." />
          ) : (
            filteredLogs.map((l) => <LogRow key={l.id} log={l} />)
          )
        ) : null}

        {tab === 'network' ? (
          filteredNetwork.length === 0 ? (
            <EmptyState message="No HTTP requests yet." />
          ) : (
            filteredNetwork.map((r) => (
              <NetworkRequestItem key={r.id} request={r} />
            ))
          )
        ) : null}
      </div>
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────── */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
      <span className="text-[11.5px] italic text-[var(--gray-8)]">{message}</span>
    </div>
  );
}

/* ── Log row (inline — simple enough not to warrant its own file) ── */

function LogRow({ log }: { log: DebugLog }) {
  const tone =
    log.level === 'error'
      ? 'text-red-700 dark:text-red-400'
      : log.level === 'warn'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-[var(--gray-10)]';

  const badge =
    log.level === 'error'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      : log.level === 'warn'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-[var(--gray-3)] text-[var(--gray-10)]';

  return (
    <div className="flex items-start gap-2 rounded-md border border-[var(--gray-4)] bg-[var(--gray-1)] px-2.5 py-1.5">
      <span
        className={
          'inline-flex min-w-[40px] justify-center rounded px-1 py-0.5 text-[9.5px] font-bold uppercase tracking-wide shrink-0 mt-[2px] ' +
          badge
        }
      >
        {log.level}
      </span>
      <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--gray-8)] mt-[2px]">
        {fmtTimestamp(log.timestamp)}
      </span>
      <span className="shrink-0 truncate font-mono text-[10.5px] text-[var(--gray-9)] mt-[2px] max-w-[140px]">
        {log.source}
      </span>
      <pre
        className={
          'min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[11.5px] leading-snug ' +
          tone
        }
      >
        {log.message}
      </pre>
    </div>
  );
}
