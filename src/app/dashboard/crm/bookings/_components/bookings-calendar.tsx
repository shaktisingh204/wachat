'use client';

import { Badge, Button } from '@/components/zoruui';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Lightweight month-grid calendar view for the Bookings list (§1D.4
 * "Calendar view"). This is a compact, dependency-free month grid —
 * not a full drag-to-reschedule calendar (that requires server
 * mutations and recurrence rules which are out of scope for this
 * pass). It clusters bookings into day cells and shows a colour-tone
 * legend by status.
 *
 * Each day cell lists up to four bookings as compact pills. Clicking
 * a pill navigates to the booking detail.
 */

import * as React from 'react';
import Link from 'next/link';

import type {
  CrmBookingDoc,
  CrmBookingStatus,
} from '@/lib/rust-client/crm-bookings';

interface BookingsCalendarProps {
  bookings: CrmBookingDoc[];
}

function statusVariant(
  status?: CrmBookingStatus,
): 'success' | 'warning' | 'danger' | 'secondary' | 'outline' {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return 'success';
    case 'cancelled':
    case 'no_show':
      return 'danger';
    case 'pending':
      return 'warning';
    default:
      return 'outline';
  }
}

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function BookingsCalendar({ bookings }: BookingsCalendarProps) {
  const today = React.useMemo(() => new Date(), []);
  const [cursor, setCursor] = React.useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  // Index bookings by day key for O(1) lookup.
  const byDay = React.useMemo(() => {
    const m = new Map<string, CrmBookingDoc[]>();
    for (const b of bookings) {
      if (!b.slotStart) continue;
      const d = new Date(b.slotStart);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = m.get(key) ?? [];
      arr.push(b);
      m.set(key, arr);
    }
    return m;
  }, [bookings]);

  // Build the cell grid: lead with the first ISO Monday on or before
  // the 1st of the month, trail to fill the final row to 7.
  const cells = React.useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - lead);
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zoru-line px-3 py-2">
        <div className="flex items-center gap-1">
          <ZoruButton
            size="sm"
            variant="ghost"
            aria-label="Previous month"
            onClick={() =>
              setCursor(
                (c) => new Date(c.getFullYear(), c.getMonth() - 1, 1),
              )
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </ZoruButton>
          <div className="min-w-[140px] text-center text-[13px] font-medium text-zoru-ink">
            {monthLabel}
          </div>
          <ZoruButton
            size="sm"
            variant="ghost"
            aria-label="Next month"
            onClick={() =>
              setCursor(
                (c) => new Date(c.getFullYear(), c.getMonth() + 1, 1),
              )
            }
          >
            <ChevronRight className="h-4 w-4" />
          </ZoruButton>
          <ZoruButton
            size="sm"
            variant="outline"
            onClick={() =>
              setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
            }
          >
            Today
          </ZoruButton>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-zoru-ink-muted">
          <LegendDot tone="success" label="Confirmed / Completed" />
          <LegendDot tone="warning" label="Pending" />
          <LegendDot tone="danger" label="Cancelled / No-show" />
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-zoru-line bg-zoru-surface-2 text-[11px] uppercase text-zoru-ink-subtle">
        {WEEK_LABELS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const key = `${cell.getFullYear()}-${cell.getMonth()}-${cell.getDate()}`;
          const list = byDay.get(key) ?? [];
          const inMonth = cell.getMonth() === cursor.getMonth();
          const isToday =
            cell.getFullYear() === today.getFullYear() &&
            cell.getMonth() === today.getMonth() &&
            cell.getDate() === today.getDate();
          return (
            <div
              key={i}
              className={[
                'min-h-[88px] border-b border-r border-zoru-line p-1.5',
                inMonth ? '' : 'bg-zoru-surface-2/40 text-zoru-ink-subtle',
              ].join(' ')}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={[
                    'text-[11.5px] font-medium',
                    isToday
                      ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-zoru-primary text-white'
                      : 'text-zoru-ink',
                  ].join(' ')}
                >
                  {cell.getDate()}
                </span>
                {list.length > 0 ? (
                  <span className="text-[10px] text-zoru-ink-muted">
                    {list.length}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-0.5">
                {list.slice(0, 4).map((b) => (
                  <Link
                    key={String(b._id)}
                    href={`/dashboard/crm/bookings/${String(b._id)}`}
                    className="block"
                  >
                    <ZoruBadge
                      variant={statusVariant(b.status)}
                      className="w-full truncate text-[10.5px]"
                    >
                      {b.service || 'Booking'}
                    </ZoruBadge>
                  </Link>
                ))}
                {list.length > 4 ? (
                  <span className="text-[10px] text-zoru-ink-muted">
                    +{list.length - 4} more
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegendDot({
  tone,
  label,
}: {
  tone: 'success' | 'warning' | 'danger';
  label: string;
}) {
  const cls =
    tone === 'success'
      ? 'bg-zoru-success'
      : tone === 'warning'
        ? 'bg-amber-500'
        : 'bg-zoru-danger';
  return (
    <span className="inline-flex items-center gap-1">
      <span className={['inline-block h-2 w-2 rounded-full', cls].join(' ')} />
      {label}
    </span>
  );
}
