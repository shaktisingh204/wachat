'use client';

import * as React from 'react';

export const GANTT_ROW_HEIGHT = 36;
export const GANTT_HEADER_HEIGHT = 36;
export const GANTT_LABEL_WIDTH = 220;

export interface GanttDayMeta {
  ms: number;
  iso: string; // yyyy-mm-dd
  isWeekend: boolean;
  isMonthStart: boolean;
  monthLabel: string; // e.g. "May '26"
  dayOfMonth: number;
}

/**
 * Build the day-grid for the chart's time axis.
 *
 * `startMs` and `endMs` are inclusive day boundaries (local midnight).
 */
export function buildDays(startMs: number, endMs: number): GanttDayMeta[] {
  const MS = 24 * 60 * 60 * 1000;
  const days: GanttDayMeta[] = [];
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return days;
  }
  for (let t = startMs; t <= endMs; t += MS) {
    const d = new Date(t);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({
      ms: t,
      iso,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isMonthStart: d.getDate() === 1,
      monthLabel: d.toLocaleDateString(undefined, {
        month: 'short',
        year: '2-digit',
      }),
      dayOfMonth: d.getDate(),
    });
  }
  return days;
}

export interface GanttGridProps {
  days: GanttDayMeta[];
  dayWidth: number;
  rowCount: number;
  todayMs: number | null;
}

/**
 * The static day-column grid + month header row + "today" red line.
 * Rendered behind the bars; bars float on top with absolute positioning.
 */
export function GanttGrid({
  days,
  dayWidth,
  rowCount,
  todayMs,
}: GanttGridProps) {
  if (days.length === 0) return null;
  const totalWidth = days.length * dayWidth;
  const totalHeight = rowCount * GANTT_ROW_HEIGHT;

  // Group days into month spans for the header strip.
  const monthSpans: Array<{ label: string; start: number; days: number }> = [];
  for (const d of days) {
    const last = monthSpans[monthSpans.length - 1];
    if (last && last.label === d.monthLabel) {
      last.days += 1;
    } else {
      monthSpans.push({ label: d.monthLabel, start: 0, days: 1 });
    }
  }
  let acc = 0;
  for (const span of monthSpans) {
    span.start = acc;
    acc += span.days;
  }

  return (
    <div
      className="relative"
      style={{ width: totalWidth, minWidth: totalWidth }}
    >
      {/* Month header */}
      <div
        className="relative border-b border-zoru-line bg-zoru-surface-2"
        style={{ height: GANTT_HEADER_HEIGHT }}
      >
        {monthSpans.map((span, i) => (
          <div
            key={`${span.label}-${i}`}
            className="absolute top-0 flex h-full items-center border-l border-zoru-line px-2 text-[11.5px] font-medium text-zoru-ink-muted"
            style={{
              left: span.start * dayWidth,
              width: span.days * dayWidth,
            }}
          >
            {span.label}
          </div>
        ))}
      </div>

      {/* Day grid lines + weekend tint, drawn for full height. */}
      <div
        className="relative"
        style={{ height: totalHeight }}
        aria-hidden
      >
        {days.map((d, i) => (
          <div
            key={d.iso}
            className={`absolute top-0 border-l border-zoru-line ${
              d.isWeekend ? 'bg-zoru-surface-2/60' : ''
            }`}
            style={{
              left: i * dayWidth,
              width: dayWidth,
              height: totalHeight,
            }}
          />
        ))}
        {/* Row separators */}
        {Array.from({ length: rowCount }).map((_, r) => (
          <div
            key={`row-${r}`}
            className="absolute left-0 right-0 border-b border-zoru-line"
            style={{ top: (r + 1) * GANTT_ROW_HEIGHT - 1 }}
          />
        ))}
        {/* Today line */}
        {todayMs !== null
          ? (() => {
              const firstMs = days[0]?.ms;
              if (firstMs === undefined) return null;
              const offsetDays = Math.floor(
                (todayMs - firstMs) / (24 * 60 * 60 * 1000),
              );
              if (offsetDays < 0 || offsetDays >= days.length) return null;
              const left = offsetDays * dayWidth + dayWidth / 2;
              return (
                <div
                  className="pointer-events-none absolute top-0 z-10 w-px bg-rose-500/80"
                  style={{ left, height: totalHeight }}
                  title="Today"
                />
              );
            })()
          : null}
      </div>
    </div>
  );
}
