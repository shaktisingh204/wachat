'use client';
import { useEffect, useRef, useState } from 'react';
import {
  LuChartNoAxesColumn,
  LuRefreshCw,
  LuFlame,
  LuX,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { useAnalytics } from '../providers/AnalyticsProvider';
import { AnalyticsDateRangePicker } from './AnalyticsDateRangePicker';

type Props = {
  /** Controlled heatmap sub-toggle. Parent state lives in Graph.tsx so HeatmapOverlay can read it. */
  isHeatmapEnabled: boolean;
  onHeatmapToggle: (next: boolean) => void;
};

function formatDurationSeconds(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (minutes < 60) return rem ? `${minutes}m ${rem}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remM = minutes % 60;
  return remM ? `${hours}h ${remM}m` : `${hours}h`;
}

export function AnalyticsToggle({ isHeatmapEnabled, onHeatmapToggle }: Props) {
  const {
    isEnabled,
    toggleEnabled,
    setEnabled,
    refresh,
    dateRange,
    setDateRange,
    status,
    error,
    totals,
  } = useAnalytics();

  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Close popover on outside click / Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const isLoading = status === 'loading';

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Analytics overlay"
        aria-expanded={isOpen}
        title="Analytics overlay"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded transition-colors',
          isEnabled
            ? 'bg-[#f76808] text-white hover:bg-[#ea580c]'
            : 'text-[var(--gray-11)] hover:bg-[var(--gray-3)]',
        )}
      >
        <LuChartNoAxesColumn size={14} />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Analytics settings"
          className="absolute right-0 top-[calc(100%+6px)] z-20 w-[300px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] p-3 shadow-md"
        >
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[12px] font-semibold text-[var(--gray-12)]">
              Analytics overlay
            </h3>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setIsOpen(false)}
              className="flex h-5 w-5 items-center justify-center rounded text-[var(--gray-10)] hover:bg-[var(--gray-3)]"
            >
              <LuX size={12} />
            </button>
          </div>

          {/* Enabled toggle */}
          <label className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[12px] text-[var(--gray-11)]">Show on nodes</span>
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              onClick={toggleEnabled}
              className={cn(
                'relative h-4 w-7 rounded-full transition-colors',
                isEnabled ? 'bg-[#f76808]' : 'bg-[var(--gray-5)]',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform',
                  isEnabled ? 'translate-x-3.5' : 'translate-x-0.5',
                )}
              />
            </button>
          </label>

          {/* Heatmap sub-toggle */}
          <label
            className={cn(
              'mb-3 flex items-center justify-between gap-2',
              !isEnabled && 'opacity-50',
            )}
          >
            <span className="flex items-center gap-1.5 text-[12px] text-[var(--gray-11)]">
              <LuFlame size={12} />
              Edge heatmap
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isHeatmapEnabled}
              disabled={!isEnabled}
              onClick={() => onHeatmapToggle(!isHeatmapEnabled)}
              className={cn(
                'relative h-4 w-7 rounded-full transition-colors',
                isHeatmapEnabled && isEnabled
                  ? 'bg-[#f76808]'
                  : 'bg-[var(--gray-5)]',
                !isEnabled && 'cursor-not-allowed',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform',
                  isHeatmapEnabled && isEnabled ? 'translate-x-3.5' : 'translate-x-0.5',
                )}
              />
            </button>
          </label>

          {/* Date range picker */}
          <div className="mb-3">
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--gray-10)]">
              Date range
            </div>
            <AnalyticsDateRangePicker value={dateRange} onChange={setDateRange} />
          </div>

          {/* Totals summary */}
          <div className="mb-3 rounded-md border border-[var(--gray-5)] bg-[var(--gray-2)] p-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--gray-10)]">
              Summary
            </div>
            {isEnabled ? (
              isLoading && !totals ? (
                <div className="space-y-1">
                  <div className="h-3 w-24 animate-pulse rounded bg-[var(--gray-5)]" />
                  <div className="h-3 w-20 animate-pulse rounded bg-[var(--gray-5)]" />
                  <div className="h-3 w-28 animate-pulse rounded bg-[var(--gray-5)]" />
                </div>
              ) : error ? (
                <div className="text-[11px] text-red-600 dark:text-red-400">
                  {error}
                </div>
              ) : totals ? (
                <dl className="space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <dt className="text-[var(--gray-10)]">Sessions</dt>
                    <dd className="font-medium text-[var(--gray-12)] tabular-nums">
                      {totals.totalSessions.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-[var(--gray-10)]">Completion</dt>
                    <dd className="font-medium text-[var(--gray-12)] tabular-nums">
                      {totals.completionRate}%
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-[var(--gray-10)]">Avg. time</dt>
                    <dd className="font-medium text-[var(--gray-12)] tabular-nums">
                      {formatDurationSeconds(totals.averageCompletionTime)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <div className="text-[11px] text-[var(--gray-10)]">No data yet.</div>
              )
            ) : (
              <div className="text-[11px] text-[var(--gray-10)]">
                Enable analytics to load data.
              </div>
            )}
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => {
              if (!isEnabled) setEnabled(true);
              void refresh();
            }}
            disabled={isLoading}
            className={cn(
              'flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)] px-2 py-1.5 text-[11px] font-medium text-[var(--gray-11)] transition-colors',
              'hover:bg-[var(--gray-3)] disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            <LuRefreshCw size={12} className={cn(isLoading && 'animate-spin')} />
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      )}
    </div>
  );
}
