'use client';

/**
 * ExecutionReplayClient - n8n-style step-by-step rewind of a past execution.
 *
 * Layout:
 *   - Header: status badge, flow name, total duration
 *   - Left rail: timeline of nodes (status dot + name + ms)
 *   - Right pane: selected node's input / output / error
 *
 * Keyboard:
 *   Up / Down - step through nodes
 *   Space - toggle playback
 *
 * Reads /api/sabflow/executions/[id] which returns the full
 * `ExecutionHistoryEntry` with the optional `nodes` array.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Loader,
  Play,
  Pause,
  RotateCw,
  Rewind,
  FastForward,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  IconButton,
  Spinner,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import type {
  ExecutionHistoryEntry,
  ExecutionHistoryNode,
} from '@/lib/sabflow/types';

const STATUS_ICON: Record<string, { icon: LucideIcon; color: string }> = {
  success:   { icon: CircleCheck,   color: 'text-[var(--st-status-ok)]' },
  error:     { icon: CircleX,       color: 'text-[var(--st-danger)]' },
  running:   { icon: Loader,        color: 'text-[var(--st-accent)] animate-spin' },
  waiting:   { icon: Clock,         color: 'text-[var(--st-warn)]' },
  skipped:   { icon: CircleAlert,   color: 'text-[var(--st-text-secondary)]' },
  cancelled: { icon: CircleAlert,   color: 'text-[var(--st-text-secondary)]' },
};

const STATUS_TONE: Record<string, BadgeTone> = {
  success: 'success',
  error: 'danger',
  running: 'accent',
  waiting: 'warning',
  skipped: 'neutral',
  cancelled: 'neutral',
};

type ApiResponse = {
  execution: ExecutionHistoryEntry;
  flow?: { id: string; name?: string };
};

export function ExecutionReplayClient({ executionId }: { executionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  /** Block id currently being re-run from, drives the button spinner. */
  const [rerunningFrom, setRerunningFrom] = useState<string | null>(null);
  const [rerunError, setRerunError] = useState<string | null>(null);
  /** Recording-style playback (Step 31). */
  const [playing, setPlaying] = useState(false);
  /** Playback rate in ms-per-step.  Smaller = faster. */
  const [playbackMs, setPlaybackMs] = useState(800);

  const handleRerun = useCallback(
    async (fromBlockId: string) => {
      setRerunningFrom(fromBlockId);
      setRerunError(null);
      try {
        const res = await fetch(
          `/api/sabflow/executions/${executionId}/rerun`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromBlockId }),
          },
        );
        const json = (await res.json().catch(() => ({}))) as {
          execution?: { _id?: string; id?: string };
          executionId?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? `Re-run failed (${res.status})`);
        }
        const newId =
          json.execution?._id ?? json.execution?.id ?? json.executionId;
        if (newId) {
          router.push(`/dashboard/sabflow/executions/${newId}`);
        }
      } catch (e) {
        setRerunError(e instanceof Error ? e.message : 'Re-run failed');
      } finally {
        setRerunningFrom(null);
      }
    },
    [executionId, router],
  );

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
      } else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nodes.length]);

  // Step 31 - playback timer.  Auto-advances selectedIdx at `playbackMs`
  // interval; stops at the last step.  Resets to 0 when the user clicks
  // Play after reaching the end.
  useEffect(() => {
    if (!playing || nodes.length === 0) return;
    const id = setInterval(() => {
      setSelectedIdx((i) => {
        if (i + 1 >= nodes.length) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, playbackMs);
    return () => clearInterval(id);
  }, [playing, nodes.length, playbackMs]);

  /*
   * Live trace via Server-Sent Events.
   *
   * When the loaded execution is still `running`, subscribe to the SSE
   * endpoint and merge each incoming snapshot/update into local state so
   * the timeline animates while the run progresses. The route emits
   * unnamed events whose JSON `data` is `{ type, data }` envelopes -
   * `snapshot` and `update` both carry the full execution row. On a
   * terminal status (or `timeout` / `error` payload, or hard EventSource
   * failure) we close the stream and refresh once to pick up the final
   * row (executionTimeMs, etc.).
   */
  useEffect(() => {
    if (!data || data.execution.status !== 'running') return;
    const src = new EventSource(`/api/sabflow/executions/${executionId}/stream`);

    const TERMINAL = new Set(['success', 'error', 'cancelled']);

    const finish = (refresh: boolean) => {
      src.close();
      if (refresh) void load();
    };

    const onMessage = (e: MessageEvent) => {
      let envelope:
        | { type: 'snapshot' | 'update'; data: Partial<ExecutionHistoryEntry> }
        | { type: 'timeout' }
        | { error: string };
      try {
        envelope = JSON.parse(e.data);
      } catch {
        return; // malformed - ignore
      }

      if ('error' in envelope) {
        finish(false);
        return;
      }
      if (envelope.type === 'timeout') {
        finish(true);
        return;
      }

      const incoming = envelope.data;
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          execution: {
            ...prev.execution,
            ...incoming,
            // Preserve our local Date hydration of timestamps where the
            // server has handed back ISO strings.
            nodes: Array.isArray(incoming.nodes)
              ? incoming.nodes.map((n) => ({
                  ...n,
                  startedAt: n.startedAt
                    ? new Date(n.startedAt as unknown as string)
                    : undefined,
                  finishedAt: n.finishedAt
                    ? new Date(n.finishedAt as unknown as string)
                    : undefined,
                }))
              : prev.execution.nodes,
            nodeCount: Array.isArray(incoming.nodes)
              ? incoming.nodes.length
              : prev.execution.nodeCount,
          },
        };
      });

      if (incoming.status && TERMINAL.has(incoming.status)) {
        finish(true);
      }
    };

    const onError = () => {
      // EventSource auto-reconnects on transient drops; close only on a
      // hard CLOSED state to avoid reconnecting indefinitely.
      if (src.readyState === EventSource.CLOSED) finish(true);
    };

    src.addEventListener('message', onMessage);
    src.addEventListener('error', onError);

    return () => {
      src.removeEventListener('message', onMessage);
      src.removeEventListener('error', onError);
      src.close();
    };
  }, [data, executionId, load]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-[var(--st-text-secondary)]">
        <Spinner size="sm" label="Loading execution" />
        <span className="text-[12px]">Loading execution.</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="m-6">
        <Alert tone="danger" title="Could not load execution">
          {error ?? 'Execution not found'}
        </Alert>
      </div>
    );
  }

  const { execution, flow } = data;
  const selectedNode: ExecutionHistoryNode | undefined = nodes[selectedIdx];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--st-border)] px-6 py-3 shrink-0">
        <Link href="/dashboard/sabflow/executions" aria-label="Back to executions">
          <IconButton label="Back to executions" icon={ArrowLeft} size="sm" />
        </Link>
        <div className="flex flex-col leading-tight min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[execution.status] ?? 'neutral'} className="uppercase">
              {execution.status}
            </Badge>
            <span className="text-[13px] font-semibold text-[var(--st-text)] truncate">
              {flow?.name ?? execution.flowId}
            </span>
          </div>
          <p className="text-[10.5px] text-[var(--st-text-tertiary)] mt-0.5">
            {execution.startedAt && new Date(execution.startedAt).toLocaleString()} ·{' '}
            {formatDuration(execution.executionTimeMs)} ·{' '}
            {execution.nodeCount} {execution.nodeCount === 1 ? 'node' : 'nodes'} ·{' '}
            session {execution.sessionId ?? '-'}
          </p>
        </div>
        {flow && (
          <Link
            href={`/dashboard/sabflow/${flow.id}`}
            className="ml-auto"
            aria-label="Open flow"
          >
            <Button variant="outline" size="sm" iconLeft={Play}>
              Open flow
            </Button>
          </Link>
        )}
      </div>

      {execution.error && (
        <div className="mx-6 my-3">
          <Alert tone="danger" title="Execution failed">
            {execution.error}
          </Alert>
        </div>
      )}

      {/* Body - timeline + detail */}
      {nodes.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <EmptyState
            icon={TriangleAlert}
            title="No per-node detail recorded for this execution."
            description="Verbose execution logging may have been disabled when this run finished."
          />
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Timeline rail */}
          <div className="w-[280px] shrink-0 overflow-y-auto border-r border-[var(--st-border)] py-2">
            {nodes.map((node, idx) => {
              const status = STATUS_ICON[node.status] ?? STATUS_ICON.skipped;
              const Icon = status.icon;
              const selected = idx === selectedIdx;
              return (
                <Button
                  key={`${node.blockId}-${idx}`}
                  variant="ghost"
                  onClick={() => setSelectedIdx(idx)}
                  aria-pressed={selected}
                  className={cn(
                    '!flex w-full !justify-start items-center gap-2.5 !px-4 !py-2 text-left !rounded-none',
                    selected && 'bg-[var(--st-accent)]/10',
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', status.color)} strokeWidth={2} aria-hidden="true" />
                  <span className="flex flex-1 flex-col min-w-0 leading-tight">
                    <span
                      className={cn(
                        'truncate text-[12px] font-medium',
                        selected
                          ? 'text-[var(--st-accent)]'
                          : 'text-[var(--st-text)]',
                      )}
                    >
                      {node.blockType}
                    </span>
                    <span className="truncate text-[10.5px] text-[var(--st-text-tertiary)]">
                      {node.blockId}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--st-text-tertiary)]">
                    {formatDuration(node.durationMs)}
                  </span>
                </Button>
              );
            })}
          </div>

          {/* Detail pane */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedNode ? (
              <NodeDetail
                node={selectedNode}
                onRerun={() => handleRerun(selectedNode.blockId)}
                rerunning={rerunningFrom === selectedNode.blockId}
                rerunError={rerunError}
              />
            ) : (
              <p className="text-[12px] text-[var(--st-text-tertiary)]">Select a node from the timeline.</p>
            )}
          </div>
        </div>
      )}

      {/* Step 31 - recording-style timeline scrubber + transport */}
      {nodes.length > 0 && (
        <TimelineScrubber
          nodes={nodes}
          selectedIdx={selectedIdx}
          playing={playing}
          playbackMs={playbackMs}
          onSelect={setSelectedIdx}
          onTogglePlay={() => {
            // If at the end, rewind before starting.
            if (selectedIdx >= nodes.length - 1) setSelectedIdx(0);
            setPlaying((p) => !p);
          }}
          onRewind={() => setSelectedIdx(0)}
          onForward={() => setSelectedIdx(nodes.length - 1)}
          onRateChange={setPlaybackMs}
        />
      )}
    </div>
  );
}

/* ── TimelineScrubber ────────────────────────────────────── */

function TimelineScrubber({
  nodes,
  selectedIdx,
  playing,
  playbackMs,
  onSelect,
  onTogglePlay,
  onRewind,
  onForward,
  onRateChange,
}: {
  nodes: ExecutionHistoryNode[];
  selectedIdx: number;
  playing: boolean;
  playbackMs: number;
  onSelect: (idx: number) => void;
  onTogglePlay: () => void;
  onRewind: () => void;
  onForward: () => void;
  onRateChange: (ms: number) => void;
}) {
  // Width each step bar takes, proportional to its duration so a slow step
  // visibly dominates a fast one.  Min 8px so single-ms steps stay clickable.
  const total = nodes.reduce((acc, n) => acc + Math.max(1, n.durationMs ?? 1), 0);
  return (
    <div className="border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-3 shrink-0">
      <div className="flex items-center gap-3">
        {/* Transport controls */}
        <IconButton
          label="Rewind to start"
          icon={Rewind}
          size="sm"
          onClick={onRewind}
        />
        <IconButton
          label={playing ? 'Pause (Space)' : 'Play (Space)'}
          icon={playing ? Pause : Play}
          size="sm"
          variant={playing ? 'primary' : 'secondary'}
          onClick={onTogglePlay}
        />
        <IconButton
          label="Jump to end"
          icon={FastForward}
          size="sm"
          onClick={onForward}
        />

        {/* Step counter */}
        <span className="text-[11px] tabular-nums text-[var(--st-text-secondary)] shrink-0 w-[60px]">
          {selectedIdx + 1} / {nodes.length}
        </span>

        {/* Bars */}
        <div className="flex-1 flex items-stretch gap-px h-8 rounded-[var(--st-radius)] bg-[var(--st-bg-tertiary)] overflow-hidden">
          {nodes.map((node, idx) => {
            const colour =
              node.status === 'success'
                ? 'bg-[var(--st-status-ok)]'
                : node.status === 'error'
                ? 'bg-[var(--st-danger)]'
                : node.status === 'waiting'
                ? 'bg-[var(--st-warn)]'
                : 'bg-[var(--st-text-tertiary)]';
            const widthPct =
              ((Math.max(1, node.durationMs ?? 1) / total) * 100).toFixed(2);
            const selected = idx === selectedIdx;
            return (
              <Button
                key={`${node.blockId}-${idx}`}
                variant="ghost"
                onClick={() => onSelect(idx)}
                title={`${node.blockType} · ${formatDuration(node.durationMs)} · ${node.status}`}
                style={{ width: `${widthPct}%`, minWidth: 8 }}
                className={cn(
                  'h-full !min-w-0 !p-0 !rounded-none transition-opacity',
                  colour,
                  selected ? 'opacity-100 ring-2 ring-[var(--st-accent)] ring-inset' : 'opacity-60 hover:opacity-100',
                )}
                aria-label={`Step ${idx + 1}: ${node.blockType}`}
                aria-pressed={selected}
              />
            );
          })}
        </div>

        {/* Speed selector */}
        <Select value={String(playbackMs)} onValueChange={(v) => onRateChange(Number(v))}>
          <SelectTrigger aria-label="Playback speed" className="w-[88px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1600">0.5x</SelectItem>
            <SelectItem value="800">1x</SelectItem>
            <SelectItem value="400">2x</SelectItem>
            <SelectItem value="200">4x</SelectItem>
            <SelectItem value="100">8x</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function NodeDetail({
  node,
  onRerun,
  rerunning,
  rerunError,
}: {
  node: ExecutionHistoryNode;
  onRerun: () => void;
  rerunning: boolean;
  rerunError: string | null;
}) {
  const status = STATUS_ICON[node.status] ?? STATUS_ICON.skipped;
  const Icon = status.icon;

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', status.color)} strokeWidth={2} aria-hidden="true" />
        <span className="text-[14px] font-semibold text-[var(--st-text)]">
          {node.blockType}
        </span>
        <code className="rounded-[var(--st-radius)] bg-[var(--st-bg-tertiary)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--st-text-secondary)]">
          {node.blockId}
        </code>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRerun}
          disabled={rerunning}
          loading={rerunning}
          iconLeft={rerunning ? undefined : RotateCw}
          title="Re-run the flow from this block. Upstream node outputs are pinned from the original run."
          className="ml-auto"
        >
          {rerunning ? 'Re-running.' : 'Re-run from here'}
        </Button>
      </div>

      {rerunError && (
        <Alert tone="danger">{rerunError}</Alert>
      )}

      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-[var(--st-text-secondary)]">
        <span>
          <span className="text-[var(--st-text-tertiary)]">Status:</span>{' '}
          <span className="font-medium text-[var(--st-text)]">{node.status}</span>
        </span>
        <span>
          <span className="text-[var(--st-text-tertiary)]">Duration:</span>{' '}
          <span className="font-medium text-[var(--st-text)] tabular-nums">
            {formatDuration(node.durationMs)}
          </span>
        </span>
        {node.startedAt && (
          <span>
            <span className="text-[var(--st-text-tertiary)]">Started:</span>{' '}
            <span className="font-medium text-[var(--st-text)]">
              {new Date(node.startedAt).toLocaleTimeString()}
            </span>
          </span>
        )}
      </div>

      {/* Error banner */}
      {node.error && (
        <Alert tone="danger">{node.error}</Alert>
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
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {title}
      </div>
      {children}
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === undefined || value === null) {
    return (
      <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[11.5px] italic text-[var(--st-text-tertiary)]">
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
    <pre className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 font-mono text-[11.5px] leading-snug text-[var(--st-text)]">
      {text}
    </pre>
  );
}

function formatDuration(ms?: number): string {
  if (ms == null || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}
