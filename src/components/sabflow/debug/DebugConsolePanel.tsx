'use client';

/**
 * DebugConsolePanel - flow inspector shown alongside the preview.
 *
 * Tabs:
 *   - Steps     - execution timeline
 *   - Variables - live variable list with change highlights
 *   - Logs      - script / webhook console output
 *   - Network   - HTTP calls w/ expand details
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
  Trash2,
  Pause,
  Play,
  Download,
  X,
  Search,
  Terminal,
  ListOrdered,
  Variable as VariableIcon,
  Globe,
} from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
} from '@/components/sabcrm/20ui';
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

/* -- Tabs ----------------------------------------------------------- */

type Tab = 'steps' | 'variables' | 'logs' | 'network';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'steps',
    label: 'Steps',
    icon: <ListOrdered className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: 'variables',
    label: 'Variables',
    icon: <VariableIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: <Terminal className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: 'network',
    label: 'Network',
    icon: <Globe className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />,
  },
];

/* -- Helpers -------------------------------------------------------- */

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

/* -- Props ---------------------------------------------------------- */

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
  /* -- Store subscriptions (only when open) ----------------------- */
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

  /* -- Filter logic (memoised per tab) ---------------------------- */

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

  /* -- Auto-scroll to bottom on new entries ----------------------- */

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

  /* -- Ticking "now" for variable highlight fade-out -------------- */
  const now = useTickingNow(open && tab === 'variables', 500);

  /* -- Actions ---------------------------------------------------- */

  const onTogglePause = useCallback(() => {
    if (paused) resumeDebug();
    else pauseDebug();
  }, [paused, resumeDebug, pauseDebug]);

  const onExport = useCallback(() => {
    const json = exportSessionJson();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadJson(`sabflow-debug-${stamp}.json`, json);
  }, [exportSessionJson]);

  /* -- Early return when closed ----------------------------------- */
  if (!open) return null;

  /* -- Render ----------------------------------------------------- */

  const layoutClasses =
    layout === 'bottom'
      ? 'shrink-0 w-full h-[340px] border-t border-[var(--st-border)]'
      : 'shrink-0 h-full w-[420px] border-l border-[var(--st-border)]';

  return (
    <div
      className={
        'ui20 flex flex-col bg-[var(--st-bg)] overflow-hidden relative ' + layoutClasses
      }
    >
      {/* -- Header --------------------------------------------------- */}
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shrink-0">
        <Terminal className="h-3.5 w-3.5 text-[var(--st-text)]" strokeWidth={2} aria-hidden="true" />
        <span className="flex-1 text-[12.5px] font-semibold text-[var(--st-text)]">
          {title}
        </span>

        <IconButton
          label={paused ? 'Resume ingestion' : 'Pause ingestion'}
          icon={paused ? Play : Pause}
          size="sm"
          onClick={onTogglePause}
          aria-pressed={paused}
        />

        <IconButton
          label="Clear debug session"
          icon={Trash2}
          size="sm"
          onClick={clearDebugSession}
        />

        <IconButton
          label="Export session as JSON"
          icon={Download}
          size="sm"
          onClick={onExport}
        />

        <IconButton
          label="Close debug console"
          icon={X}
          size="sm"
          onClick={onClose}
        />
      </div>

      {/* -- Tabs ----------------------------------------------------- */}
      <div
        role="tablist"
        aria-label="Debug console tabs"
        className="flex items-center gap-0.5 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 shrink-0"
      >
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
            <Button
              key={t.id}
              variant="ghost"
              size="sm"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={
                active
                  ? 'text-[var(--st-text)] bg-[var(--st-bg)]'
                  : 'text-[var(--st-text-secondary)]'
              }
            >
              <span className="flex items-center gap-1.5">
                {t.icon}
                {t.label}
                {count > 0 ? (
                  <Badge tone={active ? 'accent' : 'neutral'} kind="soft" className="tabular-nums">
                    {count}
                  </Badge>
                ) : null}
              </span>
            </Button>
          );
        })}
        {paused ? (
          <Badge tone="warning" kind="soft" className="ml-auto self-center uppercase tracking-wide">
            Paused
          </Badge>
        ) : null}
      </div>

      {/* -- Filter --------------------------------------------------- */}
      <div className="border-b border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-1.5 shrink-0">
        <Field className="!gap-0" label={<span className="sr-only">Filter {tab}</span>}>
          <Input
            inputSize="sm"
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${tab}...`}
            iconLeft={Search}
          />
        </Field>
        {filter ? (
          <div className="mt-1 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setFilter('')}>
              Clear
            </Button>
          </div>
        ) : null}
      </div>

      {/* -- Body ----------------------------------------------------- */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1.5"
      >
        {tab === 'steps' ? (
          filteredSteps.length === 0 ? (
            <EmptyState
              icon={ListOrdered}
              title="No steps yet"
              description="Start the preview to begin."
              size="sm"
            />
          ) : (
            filteredSteps.map((s) => <StepTimelineItem key={s.id} step={s} />)
          )
        ) : null}

        {tab === 'variables' ? (
          filteredVariables.length === 0 ? (
            <EmptyState
              icon={VariableIcon}
              title="No variables captured yet"
              size="sm"
            />
          ) : (
            filteredVariables.map(([name, v]) => (
              <VariableDiffItem key={name} name={name} state={v} now={now} />
            ))
          )
        ) : null}

        {tab === 'logs' ? (
          filteredLogs.length === 0 ? (
            <EmptyState icon={Terminal} title="No logs yet" size="sm" />
          ) : (
            filteredLogs.map((l) => <LogRow key={l.id} log={l} />)
          )
        ) : null}

        {tab === 'network' ? (
          filteredNetwork.length === 0 ? (
            <EmptyState icon={Globe} title="No HTTP requests yet" size="sm" />
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

/* -- Log row (inline - simple enough not to warrant its own file) -- */

function LogRow({ log }: { log: DebugLog }) {
  const tone =
    log.level === 'error'
      ? 'text-[var(--st-danger)]'
      : log.level === 'warn'
        ? 'text-[var(--st-warn)]'
        : 'text-[var(--st-text-secondary)]';

  const badgeTone =
    log.level === 'error' ? 'danger' : log.level === 'warn' ? 'warning' : 'neutral';

  return (
    <div className="flex items-start gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2.5 py-1.5">
      <Badge tone={badgeTone} kind="soft" className="shrink-0 mt-[2px] uppercase tracking-wide">
        {log.level}
      </Badge>
      <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--st-text-tertiary)] mt-[2px]">
        {fmtTimestamp(log.timestamp)}
      </span>
      <span className="shrink-0 truncate font-mono text-[10.5px] text-[var(--st-text-secondary)] mt-[2px] max-w-[140px]">
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
