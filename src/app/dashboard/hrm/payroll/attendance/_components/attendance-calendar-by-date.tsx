'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * <AttendanceCalendarByDate> — month grid where each cell counts the
 * total attendance entries for that day, broken down by status. Click
 * a cell to filter the URL to that date (via `?date=`).
 */

import * as React from 'react';

import type { AttendanceListRow } from './types';

interface AttendanceCalendarByDateProps {
  rows: AttendanceListRow[];
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface DayBucket {
  total: number;
  present: number;
  absent: number;
  leave: number;
}

export function AttendanceCalendarByDate({
  rows,
}: AttendanceCalendarByDateProps) {
  const [cursor, setCursor] = React.useState<Date>(() => startOfMonth(new Date()));

  const byDay = React.useMemo(() => {
    const map = new Map<string, DayBucket>();
    for (const r of rows) {
      if (!r.date) continue;
      const d = new Date(r.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = dayKey(d);
      const bucket = map.get(key) ?? {
        total: 0,
        present: 0,
        absent: 0,
        leave: 0,
      };
      bucket.total += 1;
      if (r.status === 'present' || r.status === 'wfh') bucket.present += 1;
      else if (r.status === 'absent') bucket.absent += 1;
      else if (r.status === 'leave') bucket.leave += 1;
      map.set(key, bucket);
    }
    return map;
  }, [rows]);

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const gridStart = new Date(cursor);
  gridStart.setDate(cursor.getDate() - cursor.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const todayKey = dayKey(new Date());

  return (
    <div className="flex w-full flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-medium text-zoru-ink">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCursor(addMonths(cursor, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCursor(addMonths(cursor, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-zoru-line bg-zoru-line text-[12px]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div
            key={d}
            className="bg-zoru-surface-2 px-2 py-1 text-center text-[11px] font-medium text-zoru-ink-muted"
          >
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          const key = dayKey(cell);
          const inMonth = cell.getMonth() === cursor.getMonth();
          const isToday = key === todayKey;
          const bucket = byDay.get(key);
          return (
            <div
              key={i}
              className={`min-h-[88px] bg-zoru-surface p-2 ${
                inMonth ? '' : 'bg-zoru-surface-2/60 text-zoru-ink-muted'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] ${
                    isToday
                      ? 'inline-flex h-4 w-4 items-center justify-center rounded-full bg-zoru-primary text-white'
                      : 'text-zoru-ink-muted'
                  }`}
                >
                  {cell.getDate()}
                </span>
                {bucket ? (
                  <span className="text-[10px] text-zoru-ink-muted">
                    {bucket.total}
                  </span>
                ) : null}
              </div>
              {bucket ? (
                <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                  {bucket.present > 0 ? (
                    <span className="rounded bg-zoru-ink/20 px-1.5 py-0.5 text-zoru-ink dark:text-white">
                      P {bucket.present}
                    </span>
                  ) : null}
                  {bucket.absent > 0 ? (
                    <span className="rounded bg-zoru-ink/20 px-1.5 py-0.5 text-zoru-ink dark:text-white">
                      A {bucket.absent}
                    </span>
                  ) : null}
                  {bucket.leave > 0 ? (
                    <span className="rounded bg-zoru-ink/20 px-1.5 py-0.5 text-zoru-ink dark:text-white">
                      L {bucket.leave}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-zoru-ink-muted">
        Each cell shows the daily count of attendance entries by status.
      </p>
    </div>
  );
}
