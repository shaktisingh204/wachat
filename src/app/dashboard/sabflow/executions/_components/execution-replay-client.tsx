'use client';

/**
 * ExecutionReplayClient — n8n-style step-by-step rewind of a past execution.
 *
 * Layout:
 *   - Header: status badge, flow name, total duration
 *   - Left rail: timeline of nodes (status dot + name + ms)
 *   - Right pane: selected node's input / output / error
 *
 * Keyboard:
 *   ↑ / ↓ — step through nodes
 *   Esc — back to list
 *
 * Reads /api/sabflow/executions/[id] which returns the full
 * `ExecutionHistoryEntry` with the optional `nodes` array.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LuArrowLeft,
  LuCircleAlert,
  LuCircleCheck,
  LuCircleX,
  LuClock,
  LuLoader,
  LuPlay,
  LuTriangleAlert,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type {
  ExecutionHistoryEntry,
  ExecutionHistoryNode,
} from '@/lib/sabflow/types';

const STATUS_ICON: Record<string, { icon: typeof LuCircleCheck; color: string }> = {
  success:   { icon: LuCircleCheck,   color: 'text-green-500' },
  error:     { icon: LuCircleX,       color: 'text-red-500' },
  running:   { icon: LuLoader,        color: 'text-blue-500 animate-spin' },
  waiting:   { icon: LuClock,         color: 'text-amber-500' },
  skipped:   { icon: LuCircleAlert,   color: 'text-zinc-400' },
  cancelled: { icon: LuCircleAlert,   color: 'text-zinc-400' },
};

type ApiResponse = {
  execution: ExecutionHistoryEntry;
  flow?: { id: string; name?: string };
};

export function ExecutionReplayClient({ executionId }: { executionId: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sabflow/executions/${executionId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load execution (${res.status})`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const nodes = useMemo(() => data?.execution.nodes ?? [], [data]);

  // Keyboard navigation through the timeline.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (nodes.length === 0) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, nodes.length - 1));
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nodes.length]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-[var(--gray-9)]">
        <LuLoader className="h-4 w-4 animate-spin" />
        <span className="text-[12px]">Loading execution…</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="m-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
        <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{error ?? 'Execution not found'}</span>
      </div>
    );
  }

  const { execution, flow } = data;
  const selectedNode: ExecutionHistoryNode | undefined = nodes[selectedIdx];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--gray-4)] px-6 py-3 shrink-0">
        <Link
          href="/dashboard/sabflow/executions"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]"
        >
          <LuArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
        <div className="flex flex-col leading-tight min-w-0">
          <div className="flex items-center gap-2">
            <StatusPill status={execution.status} />
            <span className="text-[13px] font-semibold text-[var(--gray-12)] truncate">
              {flow?.name ?? execution.flowId}
            </span>
          </div>
          <p className="text-[10.5px] text-[var(--gray-9)] mt-0.5">
            {execution.startedAt && new Date(execution.startedAt).toLocaleString()} ·{' '}
            {formatDuration(execution.executionTimeMs)} ·{' '}
            {execution.nodeCount} {execution.nodeCount === 1 ? 'node' : 'nodes'} ·{' '}
            session {execution.sessionId ?? '—'}
          </p>
        </div>
        {flow && (
          <Link
            href={`/dashboard/sabflow/${flow.id}`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]"
          >
            <LuPlay className="h-3 w-3" />
            Open flow
          </Link>
        )}
      </div>

      {execution.error && (
        <div className="mx-6 my-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
          <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Execution failed</p>
            <p className="mt-0.5">{execution.error}</p>
          </div>
        </div>
      )}

      {/* Body — timeline + detail */}
      {nodes.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
          <p className="text-[12.5px] text-[var(--gray-10)]">
            No per-node detail recorded for this execution.
          </p>
          <p className="text-[11px] text-[var(--gray-9)]">
            Verbose execution logging may have been disabled when this run finished.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Timeline rail */}
          <div className="w-[280px] shrink-0 overflow-y-auto border-r border-[var(--gray-4)] py-2">
            {nodes.map((node, idx) => {
              const status = STATUS_ICON[node.status] ?? STATUS_ICON.skipped;
              const Icon = status.icon;
              const selected = idx === selectedIdx;
              return (
                <button
                  key={`${node.blockId}-${idx}`}
                  type="button"
                  onClick={() => setSelectedIdx(idx)}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors',
                    selected
                      ? 'bg-[#f76808]/10'
                      : 'hover:bg-[var(--gray-2)]',
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', status.color)} strokeWidth={2} />
                  <div className="flex flex-1 flex-col min-w-0 leading-tight">
                    <span
                      className={cn(
                        'truncate text-[12px] font-medium',
                        selected
                          ? 'text-[#f76808]'
                          : 'text-[var(--gray-12)]',
                      )}
                    >
                      {node.blockType}
                    </span>
                    <span className="truncate text-[10.5px] text-[var(--gray-9)]">
                      {node.blockId}
                    </span>
                  </div>
                  <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--gray-9)]">
                    {formatDuration(node.durationMs)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Detail pane */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedNode ? (
              <NodeDetail node={selectedNode} />
            ) : (
              <p className="text-[12px] text-[var(--gray-9)]">Select a node from the timeline.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NodeDetail({ node }: { node: ExecutionHistoryNode }) {
  const status = STATUS_ICON[node.status] ?? STATUS_ICON.skipped;
  const Icon = status.icon;

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', status.color)} strokeWidth={2} />
        <span className="text-[14px] font-semibold text-[var(--gray-12)]">
          {node.blockType}
        </span>
        <code className="rounded bg-[var(--gray-3)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--gray-10)]">
          {node.blockId}
        </code>
      </div>

      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-[var(--gray-10)]">
        <span>
          <span className="text-[var(--gray-9)]">Status:</span>{' '}
          <span className="font-medium text-[var(--gray-12)]">{node.status}</span>
        </span>
        <span>
          <span className="text-[var(--gray-9)]">Duration:</span>{' '}
          <span className="font-medium text-[var(--gray-12)] tabular-nums">
            {formatDuration(node.durationMs)}
          </span>
        </span>
        {node.startedAt && (
          <span>
            <span className="text-[var(--gray-9)]">Started:</span>{' '}
            <span className="font-medium text-[var(--gray-12)]">
              {new Date(node.startedAt).toLocaleTimeString()}
            </span>
          </span>
        )}
      </div>

      {/* Error banner */}
      {node.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          <LuTriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{node.error}</span>
        </div>
      )}

      {/* Input */}
      <Section title="Input">
        <JsonBlock value={node.input} />
      </Section>

      {/* Output */}
      <Section title="Output">
        <JsonBlock value={node.output} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
        {title}
      </div>
      {children}
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === undefined || value === null) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--gray-5)] bg-[var(--gray-2)]/50 px-3 py-2 text-[11.5px] italic text-[var(--gray-9)]">
        (no data)
      </div>
    );
  }
  let text: string;
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  return (
    <pre className="overflow-x-auto rounded-lg border border-[var(--gray-5)] bg-[#0d0d0d] px-3 py-2 font-mono text-[11.5px] leading-snug text-green-400">
      {text}
    </pre>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'success'
      ? 'bg-green-50 text-green-700'
      : status === 'error'
      ? 'bg-red-50 text-red-700'
      : status === 'running'
      ? 'bg-blue-50 text-blue-700'
      : 'bg-zinc-100 text-zinc-700';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide',
        tone,
      )}
    >
      {status}
    </span>
  );
}

function formatDuration(ms?: number): string {
  if (ms == null || ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}
