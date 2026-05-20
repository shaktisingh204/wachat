'use client';

import { ZoruStatCard } from '@/components/zoruui';
import { Activity, Building2, CalendarClock, CalendarX, PauseCircle, TrendingUp, Wallet } from 'lucide-react';

/**
 * <RecurringExpensesKpiStrip> — 4-card KPI strip for Recurring Expenses.
 *
 * Active · Paused · Next 7 days · Total monthly value. Pure presentational.
 */

import type { RecurringExpenseKpiSnapshot } from './types';

interface KpiStripProps {
  kpi: RecurringExpenseKpiSnapshot;
  currency: string;
}

function fmtMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString('en-IN')}`;
  }
}

export function RecurringExpensesKpiStrip({ kpi, currency }: KpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <ZoruStatCard
        label="Active"
        value={kpi.active.toLocaleString()}
        period="schedules running"
        icon={<Activity />}
      />
      <ZoruStatCard
        label="MTD spend"
        value={fmtMoney(kpi.mtdSpend, currency)}
        period="recurring this month"
        icon={<TrendingUp />}
      />
      <ZoruStatCard
        label="Expiring"
        value={kpi.expiringCount.toLocaleString()}
        period="within 30 days"
        icon={<CalendarX />}
        invertDelta
      />
      <ZoruStatCard
        label="Top vendor"
        value={kpi.topVendor ?? '—'}
        period={
          kpi.topVendor
            ? `${fmtMoney(kpi.topVendorAmount, currency)} · ${kpi.topVendorCount}`
            : 'no data'
        }
        icon={<Building2 />}
      />
      <ZoruStatCard
        label="Paused"
        value={kpi.paused.toLocaleString()}
        period="on hold"
        icon={<PauseCircle />}
      />
      <ZoruStatCard
        label="Next 7 days"
        value={kpi.dueNext7.toLocaleString()}
        period="scheduled runs"
        icon={<CalendarClock />}
      />
      <ZoruStatCard
        label="Total monthly value"
        value={fmtMoney(kpi.totalMonthlyValue, currency)}
        period="normalized to month"
        icon={<Wallet />}
      />
    </div>
  );
}
