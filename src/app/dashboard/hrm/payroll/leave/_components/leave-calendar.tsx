'use client';

import { Button, Card } from '@/components/sabcrm/20ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * <LeaveCalendarView> — monthly calendar view for the canonical leave
 * list (per §1D.1 view-switcher).
 *
 * Color-coded by leave-type (status overrides for cancelled / rejected).
 * Approved leaves render in the leave-type's accent; pending lights up
 * amber; rejected / cancelled mute.
 */

import * as React from 'react';

import type { LeaveListRow, LeaveRowStatus } from './types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface LeaveCalendarViewProps {
  rows: LeaveListRow[];
}

function startOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eachDayBetween(fromIso: string, toIso: string): string[] {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];
  const out: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor.getTime() <= end.getTime()) {
    out.push(isoDay(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function statusTint(
  status: LeaveRowStatus,
  fallback: string,
): { bg: string; fg: string } {
  if (status === 'rejected' || status === 'cancelled') {
    return { bg: '#94A3B820', fg: '#64748B' };
  }
  if (status === 'pending') {
    return { bg: '#F59E0B25', fg: '#92400E' };
  }
  return { bg: fallback + '25', fg: fallback };
}

export function LeaveCalendarView({
  rows,
}: LeaveCalendarViewProps): React.JSX.Element {
  const [cursor, setCursor] = React.useState<Date>(() => new Date());

  const monthStart = React.useMemo(() => startOfMonth(cursor), [cursor]);

  const grid = React.useMemo(() => {
    const first = monthStart.getDay();
    const daysInMonth = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
    ).getDate();
    const cells: Array<{ date: Date | null; iso: string | null }> = [];
    for (let i = 0; i < first; i++) cells.push({ date: null, iso: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
      date.setHours(0, 0, 0, 0);
      cells.push({ date, iso: isoDay(date) });
    }
    return cells;
  }, [cursor, monthStart]);

  const byDay = React.useMemo(() => {
    const map = new Map<string, LeaveListRow[]>();
    for (const row of rows) {
      if (!row.from || !row.to) continue;
      const days = eachDayBetween(row.from, row.to);
      for (const d of days) {
        const bucket = map.get(d) ?? [];
        bucket.push(row);
        map.set(d, bucket);
      }
    }
    return map;
  }, [rows]);

  const today = isoDay(new Date());

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCursor(
                (c) => new Date(c.getFullYear(), c.getMonth() - 1, 1),
              )
            }
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[160px] text-center text-[14px] text-[var(--st-text)]">
            {cursor.toLocaleString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCursor(
                (c) => new Date(c.getFullYear(), c.getMonth() + 1, 1),
              )
            }
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCursor(new Date())}
        >
          Today
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-[11px] uppercase text-[var(--st-text-secondary)]"
          >
            {d}
          </div>
        ))}
        {grid.map((cell, idx) => {
          if (!cell.date) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[90px] rounded-[var(--st-radius)] border border-transparent"
              />
            );
          }
          const dayEntries = byDay.get(cell.iso!) ?? [];
          const isToday = cell.iso === today;
          return (
            <div
              key={cell.iso!}
              className={
                'min-h-[90px] rounded-[var(--st-radius)] border bg-[var(--st-bg)] p-1.5 ' +
                (isToday
                  ? 'border-[var(--st-text)] ring-1 ring-[var(--st-text)]'
                  : 'border-[var(--st-border)]')
              }
            >
              <div className="mb-1 text-[12px] text-[var(--st-text)]">
                {cell.date.getDate()}
              </div>
              <div className="space-y-1">
                {dayEntries.slice(0, 3).map((e) => {
                  const tint = statusTint(
                    e.status,
                    e.leaveTypeColor || '#3B82F6',
                  );
                  return (
                    <div
                      key={`${e._id}-${cell.iso}`}
                      className="truncate rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        backgroundColor: tint.bg,
                        color: tint.fg,
                      }}
                      title={`${e.employeeName} · ${e.leaveTypeName ?? 'Leave'} · ${e.status}`}
                    >
                      {e.employeeName}
                    </div>
                  );
                })}
                {dayEntries.length > 3 ? (
                  <div className="text-[10.5px] text-[var(--st-text-secondary)]">
                    +{dayEntries.length - 3} more
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
