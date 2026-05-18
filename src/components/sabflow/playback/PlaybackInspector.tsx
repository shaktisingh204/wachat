'use client';

/**
 * PlaybackInspector — C.9.6
 * ────────────────────────────────────────────────────────────────────────────
 * Execution-replay viewer for SabFlow.
 *
 * Connects to `GET /api/sabflow/executions/[executionId]/replay` via
 * Server-Sent Events.  The endpoint streams `TraceEvent` objects one at a
 * time; this component buffers them and renders a scrubable timeline where
 * each block is a row and each event is a clickable dot on a horizontal
 * time axis.  Selecting a dot shows the event's `inputSample` /
 * `outputSample` in a collapsible side panel.
 *
 * Playback controls
 * ─────────────────
 *   • Play / Pause  — advances the "current position" pointer by one event
 *     per tick at the selected speed.
 *   • Speed         — 0.5 × / 1 × / 2 × / 5 ×  (base tick = 600 ms).
 *   • Scrub         — click any dot on the timeline to jump directly.
 *   • Step arrows   — ← / → buttons for frame-by-frame navigation.
 *
 * Layout (dark, matching SabFlow editor)
 * ──────────────────────────────────────
 *   ┌─ header ──────────────────────────────────────────────────────────────┐
 *   │  status pill · speed buttons · play/pause · ← step → · close         │
 *   ├─ body ─────────────────────────────────────────────────────────────────┤
 *   │  timeline (left, data-tour="replay-timeline")                          │
 *   │    each block row → horizontal bar of dots                             │
 *   ├─ scrub bar (data-tour="replay-scrubber") ───────────────────────────── │
 *   │  side panel (right, data-tour="replay-detail") — input/output JSON     │
 *   └───────────────────────────────────────────────────────────────────────┘
 *
 * Styling: plain Tailwind + CSS custom properties inherited from the global
 * dark theme (--gray-*, #f76808 accent). No new library dependencies.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  LuX,
  LuPlay,
  LuPause,
  LuChevronLeft,
  LuChevronRight,
  LuCircleAlert,
  LuLoader2,
  LuCheckCircle2,
  LuAlertCircle,
  LuClock,
  LuBraces,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────────────────── */

/**
 * Shape of a trace event as broadcast by the replay SSE endpoint.
 * Mirrors `TraceEvent` from `src/lib/sabflow/engine/traceEmitter.ts`.
 */
export interface TraceEvent {
  executionId: string;
  nodeId: string;
  /** Node display label — may be injected by the server. */
  nodeLabel?: string;
  itemIndex: number;
  phase: 'pre' | 'post' | 'error';
  ts: number;
  durationMs?: number;
  inputSample?: unknown;
  outputSample?: unknown;
  error?: string;
  workspaceId?: string;
}

/** SSE envelope streamed by the replay route. */
type SseEnvelope =
  | { type: 'connected'; executionId: string }
  | { type: 'event'; event: TraceEvent }
  | { type: 'end'; status: 'success' | 'error' | 'cancelled'; error?: string }
  | { type: 'error'; message: string }
  | { type: 'heartbeat' };

type PlaybackStatus =
  | 'loading'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'done'
  | 'error';

type PlaybackSpeed = 0.5 | 1 | 2 | 5;

const BASE_TICK_MS = 600;
const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 2, 5];

/* ─── Props ──────────────────────────────────────────────────────────── */

export interface PlaybackInspectorProps {
  executionId: string;
  onClose: () => void;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function phaseColor(phase: TraceEvent['phase']): string {
  switch (phase) {
    case 'post':
      return '#22c55e'; // green-500
    case 'error':
      return '#ef4444'; // red-500
    case 'pre':
    default:
      return '#f59e0b'; // amber-500
  }
}

function formatTs(ts: number, minTs: number): string {
  const delta = (ts - minTs) / 1000;
  if (delta < 60) return `${delta.toFixed(2)} s`;
  const m = Math.floor(delta / 60);
  const s = (delta % 60).toFixed(0).padStart(2, '0');
  return `${m}:${s}`;
}

function safeStringify(value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/* ─── Status pill ────────────────────────────────────────────────────── */

function StatusPill({ status }: { status: PlaybackStatus }) {
  const map: Record<PlaybackStatus, { label: string; className: string; icon: React.ReactNode }> =
    {
      loading: {
        label: 'Loading',
        className: 'bg-[var(--gray-3)] text-[var(--gray-10)]',
        icon: <LuLoader2 className="h-3 w-3 animate-spin" strokeWidth={2} />,
      },
      buffering: {
        label: 'Buffering',
        className: 'bg-[var(--gray-3)] text-[var(--gray-10)]',
        icon: <LuLoader2 className="h-3 w-3 animate-spin" strokeWidth={2} />,
      },
      playing: {
        label: 'Playing',
        className: 'bg-green-900/60 text-green-300 border border-green-700/40',
        icon: <LuPlay className="h-3 w-3" strokeWidth={2} />,
      },
      paused: {
        label: 'Paused',
        className: 'bg-amber-900/50 text-amber-300 border border-amber-700/40',
        icon: <LuPause className="h-3 w-3" strokeWidth={2} />,
      },
      done: {
        label: 'Done',
        className: 'bg-blue-900/50 text-blue-300 border border-blue-700/40',
        icon: <LuCheckCircle2 className="h-3 w-3" strokeWidth={2} />,
      },
      error: {
        label: 'Error',
        className: 'bg-red-900/50 text-red-300 border border-red-700/40',
        icon: <LuAlertCircle className="h-3 w-3" strokeWidth={2} />,
      },
    };
  const { label, className, icon } = map[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        className,
      )}
    >
      {icon}
      {label}
    </span>
  );
}

/* ─── JSON viewer (lightweight) ──────────────────────────────────────── */

function JsonPane({ label, value }: { label: string; value: unknown }) {
  const text = safeStringify(value);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
        {label}
      </span>
      <pre className="rounded-md border border-[var(--gray-5)] bg-[var(--gray-2)] p-2.5 text-[11px] leading-relaxed text-[var(--gray-11)] overflow-x-auto whitespace-pre-wrap break-words max-h-52 overflow-y-auto">
        {text}
      </pre>
    </div>
  );
}

/* ─── Timeline row ────────────────────────────────────────────────────── */

interface TimelineRowProps {
  nodeId: string;
  nodeLabel: string;
  events: TraceEvent[];
  /** 0-based index of the current playback position (or -1 if not on this node). */
  activeEventIndex: number | null;
  minTs: number;
  maxTs: number;
  onDotClick: (event: TraceEvent) => void;
  /** Whether this row contains the selected event. */
  isSelected: boolean;
}

function TimelineRow({
  nodeId: _nodeId,
  nodeLabel,
  events,
  activeEventIndex,
  minTs,
  maxTs,
  onDotClick,
  isSelected,
}: TimelineRowProps) {
  const span = Math.max(maxTs - minTs, 1);

  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-3 py-1.5 rounded-md transition-colors',
        isSelected
          ? 'bg-[#f76808]/10 border border-[#f76808]/30'
          : 'hover:bg-[var(--gray-2)]',
      )}
    >
      {/* Node label */}
      <span
        className="shrink-0 w-36 truncate text-[11.5px] text-[var(--gray-11)]"
        title={nodeLabel}
      >
        {nodeLabel}
      </span>

      {/* Time axis */}
      <div className="relative flex-1 h-5 flex items-center">
        <div className="absolute inset-x-0 h-px bg-[var(--gray-5)]" />
        {events.map((ev, i) => {
          const pct = ((ev.ts - minTs) / span) * 100;
          const isActive = activeEventIndex === i;
          return (
            <button
              key={`${ev.nodeId}-${ev.phase}-${i}`}
              type="button"
              onClick={() => onDotClick(ev)}
              title={`${ev.phase} · ${ev.ts}ms${ev.durationMs !== undefined ? ` · ${ev.durationMs}ms` : ''}`}
              style={{ left: `${pct}%`, backgroundColor: phaseColor(ev.phase) }}
              className={cn(
                'absolute -translate-x-1/2 rounded-full transition-all focus:outline-none',
                isActive
                  ? 'w-4 h-4 border-2 border-white shadow-[0_0_0_2px_#f76808] z-10'
                  : 'w-2.5 h-2.5 hover:w-3.5 hover:h-3.5 hover:z-10',
              )}
              aria-label={`${ev.phase} event at ${formatTs(ev.ts, minTs)}`}
            />
          );
        })}
      </div>

      {/* Duration badge */}
      <span className="shrink-0 w-16 text-right text-[10.5px] tabular-nums text-[var(--gray-8)]">
        {events.find((e) => e.durationMs !== undefined)?.durationMs !== undefined
          ? `${events.find((e) => e.durationMs !== undefined)!.durationMs} ms`
          : ''}
      </span>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */

export function PlaybackInspector({
  executionId,
  onClose,
}: PlaybackInspectorProps) {
  /* ── SSE / event buffer ─────────────────────────────────────────── */
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [sseError, setSseError] = useState<string | null>(null);

  /* ── Playback state ─────────────────────────────────────────────── */
  const [cursor, setCursor] = useState<number>(-1); // index into `events`
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  /* ── Selection (side panel) ─────────────────────────────────────── */
  const [selected, setSelected] = useState<TraceEvent | null>(null);

  /* ── Derived playback status ────────────────────────────────────── */
  const status: PlaybackStatus = (() => {
    if (sseStatus === 'connecting') return 'loading';
    if (sseError) return 'error';
    if (sseStatus === 'open' && events.length === 0) return 'buffering';
    if (isPlaying) return 'playing';
    if (cursor >= events.length - 1 && sseStatus === 'closed') return 'done';
    return 'paused';
  })();

  /* ── Connect SSE ────────────────────────────────────────────────── */
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    setSseStatus('connecting');
    setSseError(null);
    setEvents([]);
    setCursor(-1);
    setIsPlaying(false);
    setSelected(null);

    const url = `/api/sabflow/executions/${encodeURIComponent(executionId)}/replay`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setSseStatus('open');

    es.onmessage = (msgEvent: MessageEvent<string>) => {
      let envelope: SseEnvelope;
      try {
        envelope = JSON.parse(msgEvent.data) as SseEnvelope;
      } catch {
        return;
      }

      if (envelope.type === 'event') {
        setEvents((prev) => [...prev, envelope.event]);
      } else if (envelope.type === 'end') {
        setSseStatus('closed');
        setIsPlaying(false);
        es.close();
      } else if (envelope.type === 'error') {
        setSseError(envelope.message ?? 'Unknown SSE error');
        setSseStatus('closed');
        es.close();
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects on transient failures; only surface if
      // we never opened at all (still 'connecting').
      setSseStatus((prev) => {
        if (prev === 'connecting') {
          setSseError('Failed to connect to replay stream');
          es.close();
          return 'closed';
        }
        return prev;
      });
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [executionId]);

  /* ── Playback tick ──────────────────────────────────────────────── */
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (!isPlaying) return;

    const intervalMs = BASE_TICK_MS / speed;
    tickRef.current = setInterval(() => {
      setCursor((prev) => {
        const next = prev + 1;
        if (next >= events.length - 1) {
          // Reached last known event — pause if SSE is closed (run done),
          // otherwise keep going in case new events arrive.
          if (sseStatus === 'closed') {
            setIsPlaying(false);
          }
          return Math.min(next, events.length - 1);
        }
        return next;
      });
    }, intervalMs);

    return () => {
      if (tickRef.current !== null) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [isPlaying, speed, events.length, sseStatus]);

  /* ── Sync selection to cursor ───────────────────────────────────── */
  useEffect(() => {
    if (cursor >= 0 && cursor < events.length) {
      setSelected(events[cursor]);
    }
  }, [cursor, events]);

  /* ── Handlers ───────────────────────────────────────────────────── */
  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && cursor >= events.length - 1 && sseStatus === 'closed') {
        // Replay from start
        setCursor(0);
        return true;
      }
      return !prev;
    });
  }, [cursor, events.length, sseStatus]);

  const handleStepBack = useCallback(() => {
    setIsPlaying(false);
    setCursor((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleStepForward = useCallback(() => {
    setIsPlaying(false);
    setCursor((prev) => Math.min(prev + 1, events.length - 1));
  }, [events.length]);

  const handleDotClick = useCallback((ev: TraceEvent) => {
    setIsPlaying(false);
    const idx = events.indexOf(ev);
    setCursor(idx >= 0 ? idx : cursor);
    setSelected(ev);
  }, [events, cursor]);

  /* ── Timeline grouping ──────────────────────────────────────────── */
  const nodeOrder: string[] = [];
  const nodeMap = new Map<string, { label: string; events: TraceEvent[] }>();
  for (const ev of events) {
    if (!nodeMap.has(ev.nodeId)) {
      nodeOrder.push(ev.nodeId);
      nodeMap.set(ev.nodeId, {
        label: ev.nodeLabel ?? ev.nodeId,
        events: [],
      });
    }
    nodeMap.get(ev.nodeId)!.events.push(ev);
  }

  const minTs = events.length > 0 ? events[0].ts : 0;
  const maxTs = events.length > 0 ? events[events.length - 1].ts : 1;

  const currentEvent = cursor >= 0 && cursor < events.length ? events[cursor] : null;

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div
      className="flex flex-col w-full h-full bg-[var(--gray-1)] text-[var(--gray-12)] overflow-hidden"
      aria-label="Playback Inspector"
      data-tour="replay-header"
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0 border-b border-[var(--gray-5)] px-3 py-2">
        <LuBraces className="h-4 w-4 text-[#f76808] shrink-0" strokeWidth={2} />
        <span className="text-[13px] font-semibold text-[var(--gray-12)]">
          Replay
        </span>
        <span className="text-[11px] text-[var(--gray-8)] font-mono truncate max-w-[120px]">
          {executionId}
        </span>

        <StatusPill status={status} />

        {/* spacer */}
        <div className="flex-1" />

        {/* Speed selector */}
        <div className="flex items-center gap-0.5" aria-label="Playback speed">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s}
              className={cn(
                'rounded px-2 py-0.5 text-[11px] font-semibold transition-colors',
                speed === s
                  ? 'bg-[#f76808] text-white'
                  : 'text-[var(--gray-9)] hover:text-[var(--gray-12)] hover:bg-[var(--gray-3)]',
              )}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Step backward */}
        <button
          type="button"
          onClick={handleStepBack}
          disabled={cursor <= 0}
          aria-label="Step backward"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <LuChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>

        {/* Play / Pause */}
        <button
          type="button"
          onClick={handlePlayPause}
          disabled={events.length === 0}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f76808] text-white hover:bg-[#e25c00] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isPlaying ? (
            <LuPause className="h-3.5 w-3.5" strokeWidth={2.5} />
          ) : (
            <LuPlay className="h-3.5 w-3.5" strokeWidth={2.5} />
          )}
        </button>

        {/* Step forward */}
        <button
          type="button"
          onClick={handleStepForward}
          disabled={cursor >= events.length - 1}
          aria-label="Step forward"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <LuChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close playback inspector"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
        >
          <LuX className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Timeline + scrubber ────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Timeline */}
          <div
            className="flex-1 min-h-0 overflow-y-auto py-2 px-1"
            data-tour="replay-timeline"
            aria-label="Execution timeline"
          >
            {status === 'loading' || status === 'buffering' ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <LuLoader2 className="h-5 w-5 text-[#f76808] animate-spin" strokeWidth={1.75} />
                <p className="text-[12px] text-[var(--gray-9)]">
                  {status === 'loading' ? 'Connecting to replay stream…' : 'Waiting for events…'}
                </p>
              </div>
            ) : status === 'error' ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <LuCircleAlert className="h-5 w-5 text-red-400" strokeWidth={1.75} />
                <p className="text-[12px] text-red-400">
                  {sseError ?? 'Replay stream error'}
                </p>
              </div>
            ) : nodeOrder.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <LuClock className="h-5 w-5 text-[var(--gray-8)]" strokeWidth={1.75} />
                <p className="text-[12px] text-[var(--gray-9)]">No events received yet.</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {nodeOrder.map((nodeId) => {
                  const row = nodeMap.get(nodeId)!;
                  // Find which index on this row the cursor points to
                  const activeIdx = (() => {
                    if (currentEvent?.nodeId !== nodeId) return null;
                    return row.events.indexOf(currentEvent);
                  })();
                  return (
                    <TimelineRow
                      key={nodeId}
                      nodeId={nodeId}
                      nodeLabel={row.label}
                      events={row.events}
                      activeEventIndex={activeIdx}
                      minTs={minTs}
                      maxTs={maxTs}
                      onDotClick={handleDotClick}
                      isSelected={currentEvent?.nodeId === nodeId}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Scrub bar */}
          <div
            className="shrink-0 border-t border-[var(--gray-5)] px-4 py-2 flex items-center gap-3"
            data-tour="replay-scrubber"
            aria-label="Scrub bar"
          >
            <span className="text-[10.5px] tabular-nums text-[var(--gray-8)] w-14 text-right">
              {cursor >= 0 && events.length > 0 ? formatTs(events[cursor]?.ts ?? minTs, minTs) : '0.00 s'}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(events.length - 1, 0)}
              value={cursor < 0 ? 0 : cursor}
              onChange={(e) => {
                setIsPlaying(false);
                setCursor(Number(e.target.value));
              }}
              disabled={events.length === 0}
              aria-label="Playback position"
              className="flex-1 h-1 accent-[#f76808] cursor-pointer disabled:opacity-40"
            />
            <span className="text-[10.5px] tabular-nums text-[var(--gray-8)] w-14">
              {events.length > 0 ? formatTs(maxTs, minTs) : '—'}
            </span>
            <span className="text-[10.5px] tabular-nums text-[var(--gray-8)]">
              {cursor >= 0 ? cursor + 1 : 0} / {events.length}
            </span>
          </div>
        </div>

        {/* ── Side panel ─────────────────────────────────────────── */}
        <div
          className="shrink-0 w-[340px] flex flex-col border-l border-[var(--gray-5)] overflow-hidden"
          data-tour="replay-detail"
          aria-label="Node detail panel"
        >
          {selected ? (
            <>
              {/* Panel header */}
              <div className="shrink-0 flex items-center gap-2 border-b border-[var(--gray-5)] px-3 py-2.5">
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: phaseColor(selected.phase) }}
                  aria-hidden
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[12px] font-semibold text-[var(--gray-12)] truncate">
                    {selected.nodeLabel ?? selected.nodeId}
                  </span>
                  <span className="text-[10.5px] text-[var(--gray-9)]">
                    {selected.phase}
                    {selected.durationMs !== undefined && ` · ${selected.durationMs} ms`}
                    {' · '}{formatTs(selected.ts, minTs)}
                  </span>
                </div>
              </div>

              {/* Panel body */}
              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4">
                {selected.error ? (
                  <div className="rounded-md border border-red-500/30 bg-red-950/30 p-3">
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-red-300 mb-2">
                      <LuCircleAlert className="h-3.5 w-3.5" strokeWidth={2} />
                      Error
                    </div>
                    <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words text-red-300">
                      {selected.error}
                    </pre>
                  </div>
                ) : null}

                <JsonPane label="Input" value={selected.inputSample} />
                <JsonPane label="Output" value={selected.outputSample} />

                <div className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
                    Meta
                  </span>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                    <dt className="text-[var(--gray-9)]">Node ID</dt>
                    <dd className="font-mono text-[var(--gray-11)] truncate">{selected.nodeId}</dd>
                    <dt className="text-[var(--gray-9)]">Phase</dt>
                    <dd className="text-[var(--gray-11)]">{selected.phase}</dd>
                    <dt className="text-[var(--gray-9)]">Item index</dt>
                    <dd className="text-[var(--gray-11)]">{selected.itemIndex}</dd>
                    <dt className="text-[var(--gray-9)]">Timestamp</dt>
                    <dd className="font-mono text-[var(--gray-11)]">{new Date(selected.ts).toISOString()}</dd>
                    {selected.durationMs !== undefined && (
                      <>
                        <dt className="text-[var(--gray-9)]">Duration</dt>
                        <dd className="text-[var(--gray-11)]">{selected.durationMs} ms</dd>
                      </>
                    )}
                  </dl>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 h-full text-center px-4">
              <LuBraces className="h-5 w-5 text-[var(--gray-7)]" strokeWidth={1.75} />
              <p className="text-[12px] text-[var(--gray-9)]">
                Click a dot on the timeline to inspect its input and output.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
