'use client';

/**
 * <DealCalendar> — month-view calendar grouping deals by `expectedClose`.
 *
 * Minimal first-cut: read-only month grid with day cells. Each day shows
 * up to 3 deal chips + a "+N more" overflow. Click the month-nav buttons
 * to move forward / back; the calendar is purely client-side after the
 * server passes the full list of deals.
 */

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { statusToTone, StatusPill } from '@/components/crm/status-pill';
import type { DealListRow } from './types';

interface DealCalendarProps {
  deals: DealListRow[];
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

export function DealCalendar({ deals }: DealCalendarProps) {
  const [cursor, setCursor] = React.useState<Date>(() => startOfMonth(new Date()));

  // Group deals by ISO date string (yyyy-mm-dd) of expectedClose.
  const byDay = React.useMemo(() => {
    const map = new Map<string, DealListRow[]>();
    for (const d of deals) {
      if (!d.expectedClose) continue;
      const dt = new Date(d.expectedClose);
      if (Number.isNaN(dt.getTime())) continue;
      const key = dayKey(dt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [deals]);

  const firstOfMonth = cursor;
  const monthLabel = firstOfMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  // Pad the grid back to the previous Sunday and forward to the next
  // Saturday so we always get full weeks.
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const today = new Date();
  const todayKey = dayKey(today);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-medium text-zoru-ink">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <ZoruButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCursor(addMonths(cursor, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </ZoruButton>
          <ZoruButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            Today
          </ZoruButton>
          <ZoruButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCursor(addMonths(cursor, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </ZoruButton>
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
          const inMonth = cell.getMonth() === firstOfMonth.getMonth();
          const isToday = key === todayKey;
          const items = byDay.get(key) ?? [];
          const overflow = items.length - 3;
          return (
            <div
              key={i}
              className={`min-h-[88px] bg-zoru-surface p-1 ${
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
                {items.length > 0 ? (
                  <span className="text-[10px] text-zoru-ink-muted">{items.length}</span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {items.slice(0, 3).map((deal) => (
                  <Link
                    key={deal._id}
                    href={`/dashboard/crm/sales-crm/deals/${deal._id}`}
                    className="truncate rounded bg-zoru-surface-2 px-1.5 py-0.5 text-[11px] text-zoru-ink hover:bg-zoru-line"
                    title={deal.name}
                  >
                    {deal.name}
                  </Link>
                ))}
                {overflow > 0 ? (
                  <span className="text-[10px] text-zoru-ink-muted">+{overflow} more</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-zoru-ink-muted">
        Deals plotted by expected close date. Drag-to-reschedule is queued for a follow-up.
      </p>
    </div>
  );
}
