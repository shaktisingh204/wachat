'use client';

import { ZoruStatCard } from '@/components/zoruui';
import { Activity, CalendarClock, PauseCircle, Wallet } from 'lucide-react';

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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <ZoruStatCard
        label="Active"
        value={kpi.active.toLocaleString()}
        period="schedules running"
        icon={<Activity />}
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
