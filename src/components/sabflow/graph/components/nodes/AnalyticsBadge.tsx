'use client';
import { useState } from 'react';
import { LuUsers, LuTrendingDown } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import {
  useAnalytics,
  makeAnalyticsKey,
  type NodeAnalytics,
} from '../../providers/AnalyticsProvider';

type Props = {
  groupId: string;
  blockId?: string;
  className?: string;
};

/* ── Color coding ─────────────────────────────────────────── */
// <20% drop-off → green, 20–50% → yellow, >50% → red.
function getDropOffTone(rate: number): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  if (rate >= 0.5) {
    return {
      bg: 'bg-red-50 dark:bg-red-950/40',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-300 dark:border-red-800',
      label: 'High drop-off',
    };
  }
  if (rate >= 0.2) {
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-300 dark:border-amber-800',
      label: 'Medium drop-off',
    };
  }
  return {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-800',
    label: 'Low drop-off',
  };
}

function formatCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function formatDuration(ms: number | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

/* ── Skeleton while loading ───────────────────────────────── */

function BadgeSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none flex items-center gap-1 rounded-md border border-[var(--gray-5)] bg-[var(--gray-2)] px-1.5 py-0.5 text-[10px]',
        className,
      )}
    >
      <span className="inline-block h-2 w-6 animate-pulse rounded-sm bg-[var(--gray-5)]" />
      <span className="inline-block h-2 w-6 animate-pulse rounded-sm bg-[var(--gray-5)]" />
    </div>
  );
}

/* ── Tooltip content ──────────────────────────────────────── */

function BadgeTooltip({ stats }: { stats: NodeAnalytics }) {
  const rate = Math.round(stats.dropOffRate * 100);
  const completion = stats.totalVisits > 0
    ? Math.round((stats.completionCount / stats.totalVisits) * 100)
    : 0;
  const avg = formatDuration(stats.averageTimeMs);

  return (
    <div
      role="tooltip"
      className="absolute right-0 top-full z-20 mt-1 w-[180px] rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)] p-2 text-[11px] shadow-md"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-10)]">
        Node analytics
      </div>
      <dl className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--gray-10)]">Visits</dt>
          <dd className="font-medium text-[var(--gray-12)] tabular-nums">
            {stats.totalVisits.toLocaleString()}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--gray-10)]">Completed</dt>
          <dd className="font-medium text-[var(--gray-12)] tabular-nums">
            {stats.completionCount.toLocaleString()}
            {stats.totalVisits > 0 ? (
              <span className="ml-1 text-[var(--gray-9)]">({completion}%)</span>
            ) : null}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--gray-10)]">Drop-off</dt>
          <dd className="font-medium text-[var(--gray-12)] tabular-nums">
            {stats.dropOffCount.toLocaleString()}
            <span className="ml-1 text-[var(--gray-9)]">({rate}%)</span>
          </dd>
        </div>
        {avg && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--gray-10)]">Avg. time</dt>
            <dd className="font-medium text-[var(--gray-12)] tabular-nums">{avg}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────── */

export function AnalyticsBadge({ groupId, blockId, className }: Props) {
  const { data, isEnabled, status } = useAnalytics();
  const [showTooltip, setShowTooltip] = useState(false);

  // Hidden entirely when the analytics overlay is off — zero render cost.
  if (!isEnabled) return null;

  // Loading shimmer while the first request is in flight and no cached row exists yet.
  if (status === 'loading' && data.size === 0) {
    return <BadgeSkeleton className={className} />;
  }

  const key = makeAnalyticsKey(groupId, blockId);
  const stats: NodeAnalytics | undefined =
    data.get(key) ?? (blockId ? data.get(makeAnalyticsKey(groupId)) : undefined);

  // Error or missing data → render a subtle placeholder so layout stays stable.
  if (!stats) {
    if (status === 'error') {
      return (
        <div
          className={cn(
            'pointer-events-none flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400',
            className,
          )}
          title="Failed to load analytics"
        >
          !
        </div>
      );
    }
    return (
      <div
        className={cn(
          'pointer-events-none flex items-center gap-1 rounded-md border border-dashed border-[var(--gray-6)] bg-[var(--gray-2)] px-1.5 py-0.5 text-[10px] text-[var(--gray-9)]',
          className,
        )}
        title="No analytics data for this node in the selected range"
      >
        <LuUsers size={10} />
        <span className="tabular-nums">0</span>
      </div>
    );
  }

  const tone = getDropOffTone(stats.dropOffRate);
  const rate = Math.round(stats.dropOffRate * 100);

  return (
    <div
      className={cn('relative', className)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={cn(
          'prevent-group-drag flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium tabular-nums shadow-sm',
          tone.bg,
          tone.text,
          tone.border,
        )}
        aria-label={`${tone.label}: ${stats.totalVisits} visits, ${rate}% drop-off`}
      >
        <LuUsers size={10} aria-hidden />
        <span>{formatCount(stats.totalVisits)}</span>
        <span className="opacity-50">·</span>
        <LuTrendingDown size={10} aria-hidden />
        <span>{rate}%</span>
      </div>
      {showTooltip && <BadgeTooltip stats={stats} />}
    </div>
  );
}
