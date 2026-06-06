'use client';

import { StatCard } from '@/components/sabcrm/20ui/compat';
import { Ban, CalendarClock, CalendarDays, CreditCard, UserX, } from 'lucide-react';

/**
 * KPI strip for the Bookings list page (§1D.1).
 *
 * Five clickable stat cards drive an in-place virtual filter — counts
 * are derived locally from the loaded bookings page (the Rust list
 * endpoint doesn't yet surface aggregate KPIs).
 *
 *  • Today           — bookings whose slotStart falls today
 *  • This week       — bookings inside the current ISO week
 *  • Pending payment — paymentStatus in {unpaid, partial}
 *  • Cancelled       — status === 'cancelled'
 *  • No-show         — status === 'no_show' OR noShow === true
 */

import * as React from 'react';

import type { CrmBookingDoc } from '@/lib/rust-client/crm-bookings';

export type BookingsKpiKey =
  | 'all'
  | 'today'
  | 'week'
  | 'pendingPayment'
  | 'cancelled'
  | 'noShow';

export interface BookingsKpiCounts {
  today: number;
  thisWeek: number;
  pendingPayment: number;
  cancelled: number;
  noShow: number;
}

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function startOfWeek(d: Date): number {
  const x = new Date(d);
  const day = x.getDay();
  // Treat Monday as week start (ISO).
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function computeBookingKpis(
  bookings: CrmBookingDoc[],
): BookingsKpiCounts {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;
  const weekStart = startOfWeek(now);
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
  let today = 0;
  let thisWeek = 0;
  let pendingPayment = 0;
  let cancelled = 0;
  let noShow = 0;
  for (const b of bookings) {
    const ts = b.slotStart ? new Date(b.slotStart).getTime() : NaN;
    if (Number.isFinite(ts)) {
      if (ts >= todayStart && ts < todayEnd) today += 1;
      if (ts >= weekStart && ts < weekEnd) thisWeek += 1;
    }
    const pay = (b.paymentStatus ?? '').toLowerCase();
    if (pay === 'unpaid' || pay === 'partial') pendingPayment += 1;
    const status = (b.status ?? '').toLowerCase();
    if (status === 'cancelled') cancelled += 1;
    if (status === 'no_show' || b.noShow === true) noShow += 1;
  }
  return { today, thisWeek, pendingPayment, cancelled, noShow };
}

export interface BookingsKpiStripProps {
  counts: BookingsKpiCounts;
  active: BookingsKpiKey;
  onPick: (next: BookingsKpiKey) => void;
}

export function BookingsKpiStrip({
  counts,
  active,
  onPick,
}: BookingsKpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        label="Today"
        value={counts.today.toLocaleString()}
        icon={<CalendarClock className="h-4 w-4" />}
        active={active === 'today'}
        onClick={() => onPick(active === 'today' ? 'all' : 'today')}
      />
      <KpiCard
        label="This week"
        value={counts.thisWeek.toLocaleString()}
        icon={<CalendarDays className="h-4 w-4" />}
        active={active === 'week'}
        onClick={() => onPick(active === 'week' ? 'all' : 'week')}
      />
      <KpiCard
        label="Pending payment"
        value={counts.pendingPayment.toLocaleString()}
        icon={<CreditCard className="h-4 w-4" />}
        active={active === 'pendingPayment'}
        onClick={() =>
          onPick(active === 'pendingPayment' ? 'all' : 'pendingPayment')
        }
      />
      <KpiCard
        label="Cancelled"
        value={counts.cancelled.toLocaleString()}
        icon={<Ban className="h-4 w-4" />}
        active={active === 'cancelled'}
        onClick={() => onPick(active === 'cancelled' ? 'all' : 'cancelled')}
      />
      <KpiCard
        label="No-show"
        value={counts.noShow.toLocaleString()}
        icon={<UserX className="h-4 w-4" />}
        active={active === 'noShow'}
        onClick={() => onPick(active === 'noShow' ? 'all' : 'noShow')}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  active,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]',
        active ? 'rounded-[var(--st-radius-lg)] ring-1 ring-[var(--st-text)]' : '',
      ].join(' ')}
    >
      <StatCard label={label} value={value} icon={icon} />
    </button>
  );
}

export default BookingsKpiStrip;
