'use client';

/**
 * ChartGroupHeatmap. A custom 24 x 7 grid (hour x day) coloured by activity
 * intensity. Pure CSS, no chart library. Uses the neutral 20ui text token for
 * intensity (greyscale only) so colour never carries standalone meaning.
 */

import * as React from 'react';
import { Activity } from 'lucide-react';

import { EmptyState } from '@/components/sabcrm/20ui';

import type { SabwaAnalyticsHeatCell } from '@/app/actions/sabwa.actions.types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function intensityStyle(value: number, max: number): React.CSSProperties {
  if (max <= 0 || value <= 0) {
    return { backgroundColor: 'var(--st-bg-secondary)' };
  }
  const ratio = value / max;
  // Map intensity to alpha against the text token.
  const alpha = 0.1 + ratio * 0.8;
  return { backgroundColor: `hsla(var(--st-text) / ${alpha})` };
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

  // Build a 7 x 24 lookup with zero defaults.
  const lookup: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0),
  );
  let max = 0;
  for (const cell of data) {
    if (cell.day < 0 || cell.day > 6 || cell.hour < 0 || cell.hour > 23) {
      continue;
    }
    lookup[cell.day]![cell.hour] = cell.count;
    if (cell.count > max) max = cell.count;
  }

  const legendStops = [0.15, 0.32, 0.5, 0.7, 0.9];

  return (
    <div className="space-y-2 overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-[36px_repeat(24,minmax(0,1fr))] items-center gap-px text-[10px] text-[var(--st-text-secondary)]">
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
                  title={`${day} ${hour}:00, ${value} msgs`}
                  className="h-5 rounded-[var(--st-radius-sm)] transition-colors"
                  style={intensityStyle(value, max)}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1 text-[10px] text-[var(--st-text-secondary)]">
        <span>Low</span>
        {legendStops.map((stop) => (
          <span
            key={stop}
            aria-hidden
            className="h-3 w-3 rounded-[var(--st-radius-sm)]"
            style={{ backgroundColor: `hsla(var(--st-text) / ${stop})` }}
          />
        ))}
        <span>High</span>
      </div>
    </div>
  );
}
