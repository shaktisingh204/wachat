'use client';

import { ChartNoAxesColumn, RefreshCw, Flame } from 'lucide-react';
import {
  Alert,
  Button,
  EmptyState,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
  Switch,
  cn,
} from '@/components/sabcrm/20ui';
import { useAnalytics } from '../providers/AnalyticsProvider';
import { AnalyticsDateRangePicker } from './AnalyticsDateRangePicker';

type Props = {
  /** Controlled heatmap sub-toggle. Parent state lives in Graph.tsx so HeatmapOverlay can read it. */
  isHeatmapEnabled: boolean;
  onHeatmapToggle: (next: boolean) => void;
};

function formatDurationSeconds(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '-';
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

  const isLoading = status === 'loading';

  return (
    <div className="20ui relative">
      <Popover>
        <PopoverTrigger asChild>
          <IconButton
            label="Analytics overlay"
            icon={ChartNoAxesColumn}
            variant={isEnabled ? 'primary' : 'ghost'}
            size="sm"
          />
        </PopoverTrigger>

        <PopoverContent align="end" className="w-[300px] p-3">
          {/* Header */}
          <div className="mb-2">
            <h3 className="text-[12px] font-semibold text-[var(--st-text)]">
              Analytics overlay
            </h3>
          </div>

          {/* Enabled toggle */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[12px] text-[var(--st-text-secondary)]">
              Show on nodes
            </span>
            <Switch
              checked={isEnabled}
              onCheckedChange={toggleEnabled}
              size="sm"
              aria-label="Show analytics on nodes"
            />
          </div>

          {/* Heatmap sub-toggle */}
          <div
            className={cn(
              'mb-3 flex items-center justify-between gap-2',
              !isEnabled && 'opacity-50',
            )}
          >
            <span className="flex items-center gap-1.5 text-[12px] text-[var(--st-text-secondary)]">
              <Flame size={12} aria-hidden="true" />
              Edge heatmap
            </span>
            <Switch
              checked={isHeatmapEnabled && isEnabled}
              onCheckedChange={onHeatmapToggle}
              disabled={!isEnabled}
              size="sm"
              aria-label="Edge heatmap"
            />
          </div>

          {/* Date range picker */}
          <div className="mb-3">
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
              Date range
            </div>
            <AnalyticsDateRangePicker value={dateRange} onChange={setDateRange} />
          </div>

          {/* Totals summary */}
          <div className="mb-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
              Summary
            </div>
            {isEnabled ? (
              isLoading && !totals ? (
                <div className="space-y-1">
                  <Skeleton width={96} height={12} />
                  <Skeleton width={80} height={12} />
                  <Skeleton width={112} height={12} />
                </div>
              ) : error ? (
                <Alert tone="danger" className="text-[11px]">
                  {error}
                </Alert>
              ) : totals ? (
                <dl className="space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <dt className="text-[var(--st-text-tertiary)]">Sessions</dt>
                    <dd className="font-medium text-[var(--st-text)] tabular-nums">
                      {totals.totalSessions.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-[var(--st-text-tertiary)]">Completion</dt>
                    <dd className="font-medium text-[var(--st-text)] tabular-nums">
                      {totals.completionRate}%
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-[var(--st-text-tertiary)]">Avg. time</dt>
                    <dd className="font-medium text-[var(--st-text)] tabular-nums">
                      {formatDurationSeconds(totals.averageCompletionTime)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <EmptyState
                  size="sm"
                  title="No data yet"
                  description="Run a flow to populate analytics."
                />
              )
            ) : (
              <p className="text-[11px] text-[var(--st-text-tertiary)]">
                Enable analytics to load data.
              </p>
            )}
          </div>

          {/* Refresh button */}
          <Button
            variant="secondary"
            size="sm"
            block
            iconLeft={RefreshCw}
            loading={isLoading}
            onClick={() => {
              if (!isEnabled) setEnabled(true);
              void refresh();
            }}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
