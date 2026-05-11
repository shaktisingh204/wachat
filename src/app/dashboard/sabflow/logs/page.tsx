'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LuCircleCheck, LuCircleX, LuLoader, LuClock, LuPlay, LuRefreshCw, LuChevronDown, LuChevronRight } from 'react-icons/lu';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface ExecutionRow {
  _id?: string;
  executionId: string;
  flowId: string;
  status: string;
  triggerMode?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  error?: string | null;
  createdAt?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  success:   { label: 'Success',   cls: 'bg-green-500/15 text-green-400',   Icon: LuCheckCircle },
  error:     { label: 'Error',     cls: 'bg-red-500/15 text-red-400',       Icon: LuXCircle },
  running:   { label: 'Running',   cls: 'bg-blue-500/15 text-blue-400',     Icon: LuLoader2 },
  queued:    { label: 'Queued',    cls: 'bg-zinc-500/15 text-zinc-400',     Icon: LuClock },
  cancelled: { label: 'Cancelled', cls: 'bg-yellow-500/15 text-yellow-400', Icon: LuXCircle },
};

function formatDuration(ms?: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(d?: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── ExecutionDetail — live SSE drawer ────────────────────────────────────────

function ExecutionDetail({ executionId, onClose }: { executionId: string; onClose: () => void }) {
  const [record, setRecord] = useState<ExecutionRow | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(`/api/sabflow/executions/${executionId}/stream`);
    setConnected(true);

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { type: string; data?: ExecutionRow };
        if ((msg.type === 'snapshot' || msg.type === 'update') && msg.data) {
          setRecord(msg.data);
        }
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [executionId]);

  const status = record?.status ?? 'queued';
  const meta = STATUS_STYLES[status] ?? STATUS_STYLES.queued;
  const { Icon } = meta;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">Execution</p>
          <p className="font-mono text-sm text-zinc-300">{executionId.slice(-12)}</p>
        </div>
        <div className="flex items-center gap-3">
          {connected && status === 'running' && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Live
            </span>
          )}
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {!record ? (
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <LuLoader2 className="w-4 h-4 animate-spin" />
            Connecting…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Status</p>
                <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full', meta.cls)}>
                  <Icon className={cn('w-3 h-3', status === 'running' && 'animate-spin')} />
                  {meta.label}
                </span>
              </div>
              <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Duration</p>
                <p className="text-sm font-mono text-zinc-300">{formatDuration(record.durationMs)}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Started</p>
                <p className="text-xs text-zinc-300">{formatDate(record.startedAt)}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Trigger</p>
                <p className="text-xs text-zinc-300 capitalize">{record.triggerMode ?? '—'}</p>
              </div>
            </div>

            {record.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Error</p>
                <p className="text-xs text-red-300 font-mono break-all">{record.error}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SabFlowLogsPage() {
  const searchParams = useSearchParams();
  const flowIdFilter = searchParams.get('flowId') ?? undefined;

  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchExecutions = useCallback(async () => {
    const url = `/api/sabflow/executions${flowIdFilter ? `?flowId=${flowIdFilter}` : ''}`;
    try {
      const r = await fetch(url);
      const j = (await r.json()) as { executions?: ExecutionRow[] };
      setExecutions(j.executions ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [flowIdFilter]);

  useEffect(() => {
    fetchExecutions();
    // Auto-refresh every 5 s while any execution is in a non-terminal state
    pollRef.current = setInterval(() => {
      fetchExecutions();
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchExecutions]);

  async function handleTrigger(flowId: string) {
    setTriggering(flowId);
    try {
      const r = await fetch(`/api/sabflow/${flowId}/trigger`, { method: 'POST' });
      const j = (await r.json()) as { executionId?: string };
      if (j.executionId) {
        // Add optimistic row
        setExecutions((prev) => [
          { executionId: j.executionId!, flowId, status: 'queued', triggerMode: 'manual', startedAt: null, finishedAt: null },
          ...prev,
        ]);
        setSelectedExecutionId(j.executionId);
      }
    } catch {
      // ignore
    } finally {
      setTriggering(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-1">SabFlow</p>
            <h1 className="text-2xl font-bold text-zinc-100">Execution Logs</h1>
            <p className="text-sm text-zinc-400 mt-1">
              {flowIdFilter ? `Showing runs for flow ${flowIdFilter.slice(-8)}` : 'History of all workflow runs.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {flowIdFilter && (
              <button
                onClick={() => handleTrigger(flowIdFilter)}
                disabled={triggering === flowIdFilter}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors disabled:opacity-50"
              >
                {triggering === flowIdFilter ? (
                  <LuLoader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LuPlay className="w-4 h-4" />
                )}
                Run now
              </button>
            )}
            <button
              onClick={fetchExecutions}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-zinc-200 hover:border-zinc-600 transition-colors"
            >
              <LuRefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <LuLoader2 className="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
        ) : executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center mb-4">
              <LuPlay className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-zinc-300 font-medium">No executions yet</p>
            <p className="text-sm text-zinc-500 mt-1">Activate a flow and trigger it to see runs here.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider w-8" />
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Flow</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Trigger</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Started</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {executions.map((row) => {
                  const statusMeta = STATUS_STYLES[row.status] ?? STATUS_STYLES.queued;
                  const { Icon } = statusMeta;
                  const isSelected = selectedExecutionId === row.executionId;
                  return (
                    <tr
                      key={row.executionId}
                      onClick={() => setSelectedExecutionId(isSelected ? null : row.executionId)}
                      className="hover:bg-zinc-900/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        {isSelected ? (
                          <LuChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                        ) : (
                          <LuChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-zinc-400">
                          {row.flowId?.slice(-8) ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', statusMeta.cls)}>
                          <Icon className={cn('w-3 h-3', row.status === 'running' && 'animate-spin')} />
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 capitalize">{row.triggerMode ?? '—'}</td>
                      <td className="px-4 py-3 text-zinc-400">{formatDate(row.startedAt ?? row.createdAt)}</td>
                      <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{formatDuration(row.durationMs)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live execution drawer */}
      {selectedExecutionId && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40"
            onClick={() => setSelectedExecutionId(null)}
          />
          <ExecutionDetail
            executionId={selectedExecutionId}
            onClose={() => setSelectedExecutionId(null)}
          />
        </>
      )}
    </div>
  );
}
