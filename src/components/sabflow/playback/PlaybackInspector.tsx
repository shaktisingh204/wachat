'use client';

/**
 * PlaybackInspector. C.9.6
 * ............................................................................
 * Execution-replay viewer for SabFlow.
 *
 * Connects to `GET /api/sabflow/executions/[executionId]/replay` via
 * Server-Sent Events. The endpoint streams `TraceEvent` objects one at a
 * time; this component buffers them and renders a scrubable timeline where
 * each block is a row and each event is a clickable dot on a horizontal
 * time axis. Selecting a dot shows the event's `inputSample` /
 * `outputSample` in a collapsible side panel.
 *
 * Playback controls
 * .................
 *   - Play / Pause: advances the "current position" pointer by one event
 *     per tick at the selected speed.
 *   - Speed: 0.5x / 1x / 2x / 5x (base tick = 600 ms).
 *   - Scrub: click any dot on the timeline to jump directly.
 *   - Step arrows: prev / next buttons for frame-by-frame navigation.
 *
 * Styling: pure 20ui design system, scoped under `.ui20`. Components from
 * `@/components/sabcrm/20ui`; tokens are the `--st-*` family.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  X,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  Check,
  Clock,
  Braces,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  cn,
  Badge,
  type BadgeTone,
  Button,
  IconButton,
  SegmentedControl,
  Slider,
  Spinner,
  EmptyState,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
} from '@/components/sabcrm/20ui';

/* --- Types ------------------------------------------------------------- */

/**
 * Shape of a trace event as broadcast by the replay SSE endpoint.
 * Mirrors `TraceEvent` from `src/lib/sabflow/engine/traceEmitter.ts`.
 */
export interface TraceEvent {
  executionId: string;
  nodeId: string;
  /** Node display label. May be injected by the server. */
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

/* --- Props ------------------------------------------------------------- */

export interface PlaybackInspectorProps {
  executionId: string;
  onClose: () => void;
}

/* --- Helpers ----------------------------------------------------------- */

/** Phase to a status tone (carries meaning, never decoration). */
function phaseTone(phase: TraceEvent['phase']): BadgeTone {
  switch (phase) {
    case 'post':
      return 'success';
    case 'error':
      return 'danger';
    case 'pre':
    default:
      return 'warning';
  }
}

/** Phase to a 20ui status-color token for the runtime-positioned timeline dots. */
function phaseColorVar(phase: TraceEvent['phase']): string {
  switch (phase) {
    case 'post':
      return 'var(--st-status-ok)';
    case 'error':
      return 'var(--st-danger)';
    case 'pre':
    default:
      return 'var(--st-warn)';
  }
}

/** Phase to a small glyph for the clickable dot. */
function phaseIcon(phase: TraceEvent['phase']): LucideIcon {
  switch (phase) {
    case 'post':
      return Check;
    case 'error':
      return AlertCircle;
    case 'pre':
    default:
      return Clock;
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
  if (value === undefined || value === null) return '.';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/* --- Status badge ------------------------------------------------------ */

function StatusBadge({ status }: { status: PlaybackStatus }) {
  const map: Record<
    PlaybackStatus,
    { label: string; tone: BadgeTone; icon: React.ReactNode }
  > = {
    loading: {
      label: 'Loading',
      tone: 'neutral',
      icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />,
    },
    buffering: {
      label: 'Buffering',
      tone: 'neutral',
      icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />,
    },
    playing: {
      label: 'Playing',
      tone: 'accent',
      icon: <Play className="h-3 w-3" aria-hidden="true" />,
    },
    paused: {
      label: 'Paused',
      tone: 'neutral',
      icon: <Pause className="h-3 w-3" aria-hidden="true" />,
    },
    done: {
      label: 'Done',
      tone: 'success',
      icon: <Check className="h-3 w-3" aria-hidden="true" />,
    },
    error: {
      label: 'Error',
      tone: 'danger',
      icon: <AlertCircle className="h-3 w-3" aria-hidden="true" />,
    },
  };
  const { label, tone, icon } = map[status];
  return (
    <Badge tone={tone} kind="soft" className="gap-1">
      {icon}
      {label}
    </Badge>
  );
}

/* --- JSON viewer (lightweight) ----------------------------------------- */

function JsonPane({ label, value }: { label: string; value: unknown }) {
  const text = safeStringify(value);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </span>
      <pre className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2.5 text-[11px] leading-relaxed text-[var(--st-text)] overflow-x-auto whitespace-pre-wrap break-words max-h-52 overflow-y-auto">
        {text}
      </pre>
    </div>
  );
}

/* --- Timeline row ------------------------------------------------------- */

interface TimelineRowProps {
  nodeId: string;
  nodeLabel: string;
  events: TraceEvent[];
  /** 0-based index of the current playback position (or null if not on this node). */
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
        'group flex items-center gap-3 px-3 py-1.5 rounded-[var(--st-radius)] transition-colors',
        isSelected
          ? 'bg-[var(--st-accent-soft)] border border-[var(--st-accent)]/30'
          : 'hover:bg-[var(--st-bg-secondary)]',
      )}
    >
      {/* Node label */}
      <span
        className="shrink-0 w-36 truncate text-[11.5px] text-[var(--st-text)]"
        title={nodeLabel}
      >
        {nodeLabel}
      </span>

      {/* Time axis */}
      <div className="relative flex-1 h-5 flex items-center">
        <div className="absolute inset-x-0 h-px bg-[var(--st-border)]" />
        {events.map((ev, i) => {
          const pct = ((ev.ts - minTs) / span) * 100;
          const isActive = activeEventIndex === i;
          const DotIcon = phaseIcon(ev.phase);
          return (
            <IconButton
              key={`${ev.nodeId}-${ev.phase}-${i}`}
              icon={DotIcon}
              size="sm"
              label={`${ev.phase} event at ${formatTs(ev.ts, minTs)}`}
              title={`${ev.phase} . ${ev.ts}ms${ev.durationMs !== undefined ? ` . ${ev.durationMs}ms` : ''}`}
              onClick={() => onDotClick(ev)}
              style={{ left: `${pct}%`, color: phaseColorVar(ev.phase) }}
              className={cn(
                'absolute -translate-x-1/2 rounded-full',
                isActive
                  ? 'ring-2 ring-[var(--st-accent)] z-10'
                  : 'hover:z-10',
              )}
            />
          );
        })}
      </div>

      {/* Duration badge */}
      <span className="shrink-0 w-16 text-right text-[10.5px] tabular-nums text-[var(--st-text-tertiary)]">
        {events.find((e) => e.durationMs !== undefined)?.durationMs !== undefined
          ? `${events.find((e) => e.durationMs !== undefined)!.durationMs} ms`
          : ''}
      </span>
    </div>
  );
}

/* --- Main component ---------------------------------------------------- */

export function PlaybackInspector({
  executionId,
  onClose,
}: PlaybackInspectorProps) {
  /* -- SSE / event buffer ----------------------------------------------- */
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [sseError, setSseError] = useState<string | null>(null);

  /* -- Playback state --------------------------------------------------- */
  const [cursor, setCursor] = useState<number>(-1); // index into `events`
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  /* -- Selection (side panel) ------------------------------------------- */
  const [selected, setSelected] = useState<TraceEvent | null>(null);

  /* -- Derived playback status ------------------------------------------ */
  const status: PlaybackStatus = (() => {
    if (sseStatus === 'connecting') return 'loading';
    if (sseError) return 'error';
    if (sseStatus === 'open' && events.length === 0) return 'buffering';
    if (isPlaying) return 'playing';
    if (cursor >= events.length - 1 && sseStatus === 'closed') return 'done';
    return 'paused';
  })();

  /* -- Connect SSE ------------------------------------------------------ */
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

  /* -- Playback tick ---------------------------------------------------- */
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
          // Reached last known event. Pause if SSE is closed (run done),
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

  /* -- Sync selection to cursor ----------------------------------------- */
  useEffect(() => {
    if (cursor >= 0 && cursor < events.length) {
      setSelected(events[cursor]);
    }
  }, [cursor, events]);

  /* -- Handlers --------------------------------------------------------- */
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

  const handleSpeedChange = useCallback((next: string) => {
    setSpeed(Number(next) as PlaybackSpeed);
  }, []);

  const handleScrub = useCallback((value: number | number[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    setIsPlaying(false);
    setCursor(v);
  }, []);

  /* -- Timeline grouping ------------------------------------------------ */
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

  /* -- Render ----------------------------------------------------------- */
  return (
    <div
      className="ui20 flex flex-col w-full h-full bg-[var(--st-bg)] text-[var(--st-text)] overflow-hidden"
      aria-label="Playback Inspector"
      data-tour="replay-header"
    >
      {/* -- Header --------------------------------------------------------- */}
      <div className="flex items-center gap-2 shrink-0 border-b border-[var(--st-border)] px-3 py-2">
        <Braces className="h-4 w-4 text-[var(--st-accent)] shrink-0" aria-hidden="true" />
        <span className="text-[13px] font-semibold text-[var(--st-text)]">
          Replay
        </span>
        <span className="text-[11px] text-[var(--st-text-tertiary)] font-mono truncate max-w-[120px]">
          {executionId}
        </span>

        <StatusBadge status={status} />

        {/* spacer */}
        <div className="flex-1" />

        {/* Speed selector */}
        <SegmentedControl
          aria-label="Playback speed"
          size="sm"
          value={String(speed)}
          onChange={handleSpeedChange}
          items={SPEED_OPTIONS.map((s) => ({ value: String(s), label: `${s}x` }))}
        />

        {/* Step backward */}
        <IconButton
          icon={ChevronLeft}
          label="Step backward"
          onClick={handleStepBack}
          disabled={cursor <= 0}
        />

        {/* Play / Pause */}
        <IconButton
          icon={isPlaying ? Pause : Play}
          variant="primary"
          label={isPlaying ? 'Pause' : 'Play'}
          onClick={handlePlayPause}
          disabled={events.length === 0}
        />

        {/* Step forward */}
        <IconButton
          icon={ChevronRight}
          label="Step forward"
          onClick={handleStepForward}
          disabled={cursor >= events.length - 1}
        />

        {/* Close */}
        <IconButton
          icon={X}
          label="Close playback inspector"
          onClick={onClose}
        />
      </div>

      {/* -- Body ----------------------------------------------------------- */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* -- Timeline + scrubber ------------------------------------------ */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Timeline */}
          <div
            className="flex-1 min-h-0 overflow-y-auto py-2 px-1"
            data-tour="replay-timeline"
            aria-label="Execution timeline"
          >
            {status === 'loading' || status === 'buffering' ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Spinner size="lg" label="Loading replay" />
                <p className="text-[12px] text-[var(--st-text-secondary)]">
                  {status === 'loading' ? 'Connecting to replay stream.' : 'Waiting for events.'}
                </p>
              </div>
            ) : status === 'error' ? (
              <EmptyState
                icon={AlertCircle}
                tone="danger"
                size="sm"
                title="Replay stream error"
                description={sseError ?? 'The replay stream could not be read.'}
              />
            ) : nodeOrder.length === 0 ? (
              <EmptyState
                icon={Clock}
                size="sm"
                title="No events yet"
                description="No events received yet."
              />
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
            className="shrink-0 border-t border-[var(--st-border)] px-4 py-2 flex items-center gap-3"
            data-tour="replay-scrubber"
            aria-label="Scrub bar"
          >
            <span className="text-[10.5px] tabular-nums text-[var(--st-text-tertiary)] w-14 text-right">
              {cursor >= 0 && events.length > 0 ? formatTs(events[cursor]?.ts ?? minTs, minTs) : '0.00 s'}
            </span>
            <Slider
              className="flex-1"
              ariaLabel="Playback position"
              min={0}
              max={Math.max(events.length - 1, 0)}
              step={1}
              value={cursor < 0 ? 0 : cursor}
              onValueChange={handleScrub}
              disabled={events.length === 0}
            />
            <span className="text-[10.5px] tabular-nums text-[var(--st-text-tertiary)] w-14">
              {events.length > 0 ? formatTs(maxTs, minTs) : '.'}
            </span>
            <span className="text-[10.5px] tabular-nums text-[var(--st-text-tertiary)]">
              {cursor >= 0 ? cursor + 1 : 0} / {events.length}
            </span>
          </div>
        </div>

        {/* -- Side panel --------------------------------------------------- */}
        <div
          className="shrink-0 w-[340px] flex flex-col border-l border-[var(--st-border)] overflow-hidden"
          data-tour="replay-detail"
          aria-label="Node detail panel"
        >
          {selected ? (
            <Card className="flex flex-col h-full rounded-none border-0">
              {/* Panel header */}
              <CardHeader className="shrink-0 border-b border-[var(--st-border)]">
                <div className="flex items-center gap-2">
                  <Badge tone={phaseTone(selected.phase)} kind="soft" dot>
                    {selected.phase}
                  </Badge>
                  <div className="flex flex-col min-w-0 flex-1">
                    <CardTitle className="text-[12px] truncate">
                      {selected.nodeLabel ?? selected.nodeId}
                    </CardTitle>
                    <CardDescription className="text-[10.5px]">
                      {selected.durationMs !== undefined && `${selected.durationMs} ms . `}
                      {formatTs(selected.ts, minTs)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              {/* Panel body */}
              <CardBody className="flex-1 min-h-0 overflow-y-auto space-y-4">
                {selected.error ? (
                  <div className="rounded-[var(--st-radius)] border border-[var(--st-danger)]/30 bg-[var(--st-danger-soft)] p-3">
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--st-danger)] mb-2">
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Error
                    </div>
                    <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words text-[var(--st-danger)]">
                      {selected.error}
                    </pre>
                  </div>
                ) : null}

                <JsonPane label="Input" value={selected.inputSample} />
                <JsonPane label="Output" value={selected.outputSample} />

                <div className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Meta
                  </span>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                    <dt className="text-[var(--st-text-secondary)]">Node ID</dt>
                    <dd className="font-mono text-[var(--st-text)] truncate">{selected.nodeId}</dd>
                    <dt className="text-[var(--st-text-secondary)]">Phase</dt>
                    <dd className="text-[var(--st-text)]">{selected.phase}</dd>
                    <dt className="text-[var(--st-text-secondary)]">Item index</dt>
                    <dd className="text-[var(--st-text)]">{selected.itemIndex}</dd>
                    <dt className="text-[var(--st-text-secondary)]">Timestamp</dt>
                    <dd className="font-mono text-[var(--st-text)]">{new Date(selected.ts).toISOString()}</dd>
                    {selected.durationMs !== undefined && (
                      <>
                        <dt className="text-[var(--st-text-secondary)]">Duration</dt>
                        <dd className="text-[var(--st-text)]">{selected.durationMs} ms</dd>
                      </>
                    )}
                  </dl>
                </div>
              </CardBody>
            </Card>
          ) : (
            <EmptyState
              className="h-full"
              icon={Braces}
              title="Nothing selected"
              description="Click a dot on the timeline to inspect its input and output."
            />
          )}
        </div>
      </div>
    </div>
  );
}
