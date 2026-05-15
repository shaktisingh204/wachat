'use client';

/**
 * ChartGroupHeatmap — custom 24 × 7 grid (hour × day) coloured by activity
 * intensity. Pure CSS — no Recharts.
 */

import * as React from 'react';
import { Activity } from 'lucide-react';

import type { SabwaAnalyticsHeatCell } from '@/app/actions/sabwa.actions';

import { EmptyState } from '@/app/sabwa/_components/empty-state';
import { cn } from '@/lib/utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function intensityClass(value: number, max: number): string {
  if (max <= 0 || value <= 0) return 'bg-muted/50';
  const ratio = value / max;
  if (ratio < 0.2) return 'bg-blue-500/15';
  if (ratio < 0.4) return 'bg-blue-500/30';
  if (ratio < 0.6) return 'bg-blue-500/50';
  if (ratio < 0.8) return 'bg-blue-500/70';
  return 'bg-blue-500/90';
}

export interface ChartGroupHeatmapProps {
  data: SabwaAnalyticsHeatCell[];
}

export function ChartGroupHeatmap({ data }: ChartGroupHeatmapProps) {
  if (!data.length) {
    return (
      <EmptyState
        icon={Activity}
        title="No group activity yet"
        description="A heat-map of group hour-of-day activity will appear once your groups are busy."
      />
    );
  }

  // Build a 7 × 24 lookup with zero defaults.
  const lookup: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0),
  );
  let max = 0;
  for (const cell of data) {
    if (
      cell.day < 0 ||
      cell.day > 6 ||
      cell.hour < 0 ||
      cell.hour > 23
    ) {
      continue;
    }
    lookup[cell.day]![cell.hour] = cell.count;
    if (cell.count > max) max = cell.count;
  }

  return (
    <div className="space-y-2 overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-[36px_repeat(24,minmax(0,1fr))] items-center gap-px text-[10px] text-muted-foreground">
        <div aria-hidden />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center tabular-nums">
            {h % 3 === 0 ? h : ''}
          </div>
        ))}
        {DAYS.map((day, dIdx) => (
          <React.Fragment key={day}>
            <div className="pr-1 text-right text-[10px]">{day}</div>
            {Array.from({ length: 24 }, (_, hour) => {
              const value = lookup[dIdx]![hour] ?? 0;
              return (
                <div
                  key={hour}
                  title={`${day} ${hour}:00 — ${value} msgs`}
                  className={cn(
                    'h-5 rounded-sm transition-colors',
                    intensityClass(value, max),
                  )}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>Low</span>
        <span className="h-3 w-3 rounded-sm bg-blue-500/15" />
        <span className="h-3 w-3 rounded-sm bg-blue-500/30" />
        <span className="h-3 w-3 rounded-sm bg-blue-500/50" />
        <span className="h-3 w-3 rounded-sm bg-blue-500/70" />
        <span className="h-3 w-3 rounded-sm bg-blue-500/90" />
        <span>High</span>
      </div>
    </div>
  );
}
