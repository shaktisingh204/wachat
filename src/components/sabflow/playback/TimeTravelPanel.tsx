'use client';

/**
 * TimeTravelPanel — C.9.7
 *
 * Bottom-of-screen debug panel for scrubbing through a SabFlow execution
 * playback. Shows a range scrubber, event density heatmap, transport stats,
 * and keyboard shortcuts (Space / Left / Right / Home / End).
 *
 * Props
 * ─────
 *   executionId  — used externally to key which execution is being replayed
 *   events       — ordered list of TraceEvent (step kind) for this execution
 *   currentTs    — optional wall-clock ms to highlight in the heatmap
 *   onSeek       — called with the 0-based item index when the scrubber moves
 *
 * The component calls `onSeek(itemIndex)` whenever the user drags the
 * scrubber, presses Left/Right, or jumps to the start/end. The parent is
 * responsible for feeding the resulting index to the SSE replay endpoint via
 * `?from=<itemIndex>`.
 *
 * Keyboard shortcuts (captured when the panel has focus or the body is
 * focused and a modal isn't open):
 *   Space        — toggle play / pause
 *   ArrowLeft    — step backward one event
 *   ArrowRight   — step forward one event
 *   Home         — jump to first event
 *   End          — jump to last event
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LuPlay,
  LuPause,
  LuSkipBack,
  LuSkipForward,
  LuClock,
  LuActivity,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { TraceEvent as EngineTraceEvent } from '@/lib/sabflow/engine/traceEmitter';

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface TimeTravelPanelProps {
  /** Opaque execution id — for external keying / aria labels only. */
  executionId: string;
  /**
   * Ordered list of trace events for the execution. The component derives
   * all timing / density data from this list.
   */
  events: EngineTraceEvent[];
  /**
   * Optional wall-clock timestamp (Date.now() value) to highlight on the
   * heatmap. Typically the `ts` field of the currently-selected event.
   */
  currentTs?: number;
  /**
   * Called when the user seeks to a new position. `itemIndex` is the
   * 0-based index into `events`. The parent passes this to `?from=<itemIndex>`
   * on the replay SSE endpoint.
   */
  onSeek: (itemIndex: number) => void;
}

/* ── Constants ────────────────────────────────────────────────────────────── */

const HEATMAP_BINS = 20;

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

/* ── Heatmap bin type ─────────────────────────────────────────────────────── */

interface HeatmapBin {
  /** Total events in this time bin. */
  total: number;
  /** Error events in this time bin. */
  errors: number;
  /** Error rate 0–1. */
  errorRate: number;
}

/* ── Component ────────────────────────────────────────────────────────────── */

export function TimeTravelPanel({
  executionId,
  events,
  currentTs,
  onSeek,
}: TimeTravelPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const count = events.length;

  /* ── Derived timing values ────────────────────────────────────────────── */

  const { minTs, maxTs, totalDurationMs } = useMemo(() => {
    if (count === 0) return { minTs: 0, maxTs: 0, totalDurationMs: 0 };
    let min = events[0].ts;
    let max = events[0].ts;
    for (const ev of events) {
      if (ev.ts < min) min = ev.ts;
      if (ev.ts > max) max = ev.ts;
    }
    return { minTs: min, maxTs: max, totalDurationMs: max - min };
  }, [events, count]);

  /* ── Current timestamp ────────────────────────────────────────────────── */

  const activeTs = useMemo(() => {
    if (currentTs !== undefined) return currentTs;
    if (count === 0) return 0;
    const idx = Math.max(0, Math.min(currentIndex, count - 1));
    return events[idx].ts;
  }, [currentTs, events, currentIndex, count]);

  /* ── Heatmap bins ─────────────────────────────────────────────────────── */

  const heatmapBins = useMemo<HeatmapBin[]>(() => {
    if (count === 0 || totalDurationMs === 0) {
      return Array.from({ length: HEATMAP_BINS }, () => ({
        total: 0,
        errors: 0,
        errorRate: 0,
      }));
    }
    const bins: HeatmapBin[] = Array.from({ length: HEATMAP_BINS }, () => ({
      total: 0,
      errors: 0,
      errorRate: 0,
    }));
    for (const ev of events) {
      const ratio = (ev.ts - minTs) / totalDurationMs;
      const binIdx = Math.min(HEATMAP_BINS - 1, Math.floor(ratio * HEATMAP_BINS));
      bins[binIdx].total += 1;
      if (ev.phase === 'error') bins[binIdx].errors += 1;
    }
    for (const bin of bins) {
      bin.errorRate = bin.total === 0 ? 0 : bin.errors / bin.total;
    }
    return bins;
  }, [events, count, minTs, totalDurationMs]);

  /* ── Heatmap active bin ───────────────────────────────────────────────── */

  const activeBinIdx = useMemo(() => {
    if (totalDurationMs === 0) return -1;
    const ratio = (activeTs - minTs) / totalDurationMs;
    return Math.min(HEATMAP_BINS - 1, Math.floor(ratio * HEATMAP_BINS));
  }, [activeTs, minTs, totalDurationMs]);

  /* ── Seek helper ──────────────────────────────────────────────────────── */

  const seekTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, Math.max(0, count - 1)));
      setCurrentIndex(clamped);
      onSeek(clamped);
    },
    [count, onSeek],
  );

  /* ── Play / pause ─────────────────────────────────────────────────────── */

  const stopPlayback = useCallback(() => {
    if (playIntervalRef.current !== null) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    if (count === 0) return;
    setIsPlaying(true);
    playIntervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= count) {
          stopPlayback();
          return prev;
        }
        onSeek(next);
        return next;
      });
    }, 300);
  }, [count, onSeek, stopPlayback]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      if (currentIndex >= count - 1) {
        seekTo(0);
      }
      startPlayback();
    }
  }, [isPlaying, currentIndex, count, stopPlayback, startPlayback, seekTo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current !== null) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);

  /* ── Keyboard shortcuts ───────────────────────────────────────────────── */

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't steal keys when an input/textarea is focused
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stopPlayback();
          seekTo(currentIndex - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          stopPlayback();
          seekTo(currentIndex + 1);
          break;
        case 'Home':
          e.preventDefault();
          stopPlayback();
          seekTo(0);
          break;
        case 'End':
          e.preventDefault();
          stopPlayback();
          seekTo(count - 1);
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, stopPlayback, seekTo, currentIndex, count]);

  /* ── Heatmap bin colour ───────────────────────────────────────────────── */

  function binColour(bin: HeatmapBin, isActive: boolean): string {
    if (bin.total === 0) {
      return isActive
        ? 'bg-[var(--gray-6)]'
        : 'bg-[var(--gray-4)]';
    }
    if (bin.errorRate >= 0.1) {
      return isActive
        ? 'bg-red-500'
        : 'bg-red-400/70 dark:bg-red-600/60';
    }
    if (bin.errorRate > 0) {
      return isActive
        ? 'bg-amber-400'
        : 'bg-amber-300/70 dark:bg-amber-500/60';
    }
    return isActive
      ? 'bg-emerald-500'
      : 'bg-emerald-400/60 dark:bg-emerald-600/50';
  }

  /* ── Elapsed for current position ────────────────────────────────────── */

  const elapsedMs = count > 0 ? activeTs - minTs : 0;

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div
      data-tour="replay-scrubber"
      aria-label={`Execution playback controls for ${executionId}`}
      className={cn(
        'flex flex-col gap-2 border-t border-[var(--gray-5)]',
        'bg-[var(--gray-1)] px-4 py-3',
      )}
    >
      {/* ── Top row: stats ────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Transport buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <TransportButton
            aria-label="Jump to start (Home)"
            disabled={count === 0 || currentIndex === 0}
            onClick={() => { stopPlayback(); seekTo(0); }}
          >
            <LuSkipBack className="h-3.5 w-3.5" strokeWidth={2} />
          </TransportButton>

          <TransportButton
            aria-label={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            disabled={count === 0}
            onClick={togglePlay}
            prominent
          >
            {isPlaying
              ? <LuPause className="h-3.5 w-3.5" strokeWidth={2} />
              : <LuPlay className="h-3.5 w-3.5" strokeWidth={2} />
            }
          </TransportButton>

          <TransportButton
            aria-label="Jump to end (End)"
            disabled={count === 0 || currentIndex >= count - 1}
            onClick={() => { stopPlayback(); seekTo(count - 1); }}
          >
            <LuSkipForward className="h-3.5 w-3.5" strokeWidth={2} />
          </TransportButton>
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-1.5 min-w-0">
          <LuClock
            className="h-3 w-3 text-[var(--gray-8)] shrink-0"
            strokeWidth={2}
          />
          <span className="text-[11.5px] tabular-nums text-[var(--gray-10)] font-mono">
            {count > 0 ? formatTs(activeTs) : '—'}
          </span>
          <span className="text-[10.5px] text-[var(--gray-7)]">
            {count > 0 ? `+${formatMs(elapsedMs)}` : ''}
          </span>
        </div>

        <div className="flex-1" />

        {/* Item / total counter */}
        <div className="flex items-center gap-1.5 shrink-0">
          <LuActivity
            className="h-3 w-3 text-[var(--gray-8)] shrink-0"
            strokeWidth={2}
          />
          <span className="text-[11.5px] tabular-nums text-[var(--gray-10)]">
            {count === 0
              ? 'No events'
              : `${currentIndex + 1} / ${count}`}
          </span>
          {totalDurationMs > 0 && (
            <span className="text-[10.5px] text-[var(--gray-7)]">
              {formatMs(totalDurationMs)} total
            </span>
          )}
        </div>
      </div>

      {/* ── Heatmap + scrubber ────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 shrink-0">
        {/* Mini heatmap */}
        <div
          aria-hidden
          className="flex h-4 w-full gap-px rounded overflow-hidden"
          title="Event density heatmap — green=0% error, yellow<10%, red≥10%"
        >
          {heatmapBins.map((bin, i) => (
            <button
              key={i}
              type="button"
              title={
                bin.total === 0
                  ? 'No events'
                  : `${bin.total} event${bin.total === 1 ? '' : 's'}${bin.errors > 0 ? `, ${bin.errors} error${bin.errors === 1 ? '' : 's'}` : ''}`
              }
              onClick={() => {
                if (count === 0) return;
                // Jump to first event in this bin
                const ratio = i / HEATMAP_BINS;
                const targetTs = minTs + ratio * totalDurationMs;
                // Find the closest event by ts
                let closest = 0;
                let closestDiff = Infinity;
                for (let j = 0; j < events.length; j++) {
                  const diff = Math.abs(events[j].ts - targetTs);
                  if (diff < closestDiff) {
                    closestDiff = diff;
                    closest = j;
                  }
                }
                stopPlayback();
                seekTo(closest);
              }}
              className={cn(
                'flex-1 min-w-0 transition-opacity hover:opacity-80 cursor-pointer',
                binColour(bin, i === activeBinIdx),
                count === 0 && 'cursor-default pointer-events-none',
              )}
            />
          ))}
        </div>

        {/* Range scrubber */}
        <input
          type="range"
          min={0}
          max={Math.max(0, count - 1)}
          value={currentIndex}
          disabled={count === 0}
          aria-label="Execution playback position"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, count - 1)}
          aria-valuenow={currentIndex}
          aria-valuetext={
            count === 0
              ? 'No events'
              : `Event ${currentIndex + 1} of ${count} at ${formatTs(activeTs)}`
          }
          onChange={(e) => {
            stopPlayback();
            seekTo(Number(e.target.value));
          }}
          className={cn(
            'w-full h-1.5 appearance-none rounded-full cursor-pointer',
            'bg-[var(--gray-4)]',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:w-3.5',
            '[&::-webkit-slider-thumb]:h-3.5',
            '[&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-[#f76808]',
            '[&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-webkit-slider-thumb]:shadow-sm',
            '[&::-moz-range-thumb]:w-3.5',
            '[&::-moz-range-thumb]:h-3.5',
            '[&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-[#f76808]',
            '[&::-moz-range-thumb]:border-0',
            '[&::-moz-range-thumb]:cursor-pointer',
            count === 0 && 'opacity-40 cursor-not-allowed',
          )}
        />
      </div>

      {/* ── Keyboard hint ─────────────────────────────────────────────── */}
      <p className="shrink-0 text-[10.5px] text-[var(--gray-7)] select-none">
        Space = play/pause · ← / → = step · Home / End = jump
      </p>
    </div>
  );
}

/* ── TransportButton ──────────────────────────────────────────────────────── */

interface TransportButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  prominent?: boolean;
  'aria-label'?: string;
}

function TransportButton({
  children,
  onClick,
  disabled,
  prominent,
  'aria-label': ariaLabel,
}: TransportButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
        prominent
          ? 'bg-[#f76808] text-white hover:bg-[#e25c00] active:bg-[#c94e00]'
          : 'text-[var(--gray-10)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
      )}
    >
      {children}
    </button>
  );
}
