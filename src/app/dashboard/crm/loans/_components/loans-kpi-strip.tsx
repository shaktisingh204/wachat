'use client';

import { ZoruStatCard } from '@/components/zoruui';
import { AlertTriangle, Banknote, CalendarClock, HandCoins, Receipt, } from 'lucide-react';

/**
 * KPI strip for the Loans list (§1D.1).
 *
 *  • Total active            — status === 'active'
 *  • Overdue                 — npa === true OR status === 'overdue'
 *  • Total disbursed         — sum of `principal`
 *  • Outstanding principal   — sum of `outstanding`
 *  • Next payment due in 7d  — nextPaymentAt within 7 days
 */

import * as React from 'react';

import type { LoanRow } from './loans-types';

export type LoansKpiKey = 'all' | 'active' | 'overdue' | 'dueSoon';

export interface LoansKpiCounts {
  active: number;
  overdue: number;
  totalDisbursed: number;
  outstanding: number;
  dueSoon: number;
}

export function computeLoanKpis(rows: LoanRow[]): LoansKpiCounts {
  const now = Date.now();
  const sevenDays = now + 7 * 24 * 60 * 60 * 1000;
  let active = 0;
  let overdue = 0;
  let totalDisbursed = 0;
  let outstanding = 0;
  let dueSoon = 0;
  for (const r of rows) {
    const s = (r.status ?? '').toLowerCase();
    if (s === 'active') active += 1;
    if (r.npa || s === 'overdue' || s === 'npa') overdue += 1;
    if (typeof r.principal === 'number') totalDisbursed += r.principal;
    if (typeof r.outstanding === 'number') outstanding += r.outstanding;
    if (r.nextPaymentAt) {
      const t = new Date(r.nextPaymentAt).getTime();
      if (Number.isFinite(t) && t >= now && t <= sevenDays) dueSoon += 1;
    }
  }
  return { active, overdue, totalDisbursed, outstanding, dueSoon };
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export interface LoansKpiStripProps {
  counts: LoansKpiCounts;
  active: LoansKpiKey;
  onPick: (next: LoansKpiKey) => void;
}

export function LoansKpiStrip({ counts, active, onPick }: LoansKpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        label="Total active"
        value={counts.active.toLocaleString()}
        icon={<HandCoins className="h-4 w-4" />}
        active={active === 'active'}
        onClick={() => onPick(active === 'active' ? 'all' : 'active')}
      />
      <KpiCard
        label="Overdue"
        value={counts.overdue.toLocaleString()}
        icon={<AlertTriangle className="h-4 w-4" />}
        active={active === 'overdue'}
        onClick={() => onPick(active === 'overdue' ? 'all' : 'overdue')}
      />
      <KpiCard
        label="Total disbursed"
        value={inr.format(counts.totalDisbursed)}
        icon={<Banknote className="h-4 w-4" />}
        active={false}
        onClick={() => onPick('all')}
      />
      <KpiCard
        label="Outstanding"
        value={inr.format(counts.outstanding)}
        icon={<Receipt className="h-4 w-4" />}
        active={false}
        onClick={() => onPick('all')}
      />
      <KpiCard
        label="Due in 7d"
        value={counts.dueSoon.toLocaleString()}
        icon={<CalendarClock className="h-4 w-4" />}
        active={active === 'dueSoon'}
        onClick={() => onPick(active === 'dueSoon' ? 'all' : 'dueSoon')}
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
        'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary',
        active ? 'rounded-[var(--zoru-radius-lg)] ring-1 ring-zoru-primary' : '',
      ].join(' ')}
    >
      <ZoruStatCard label={label} value={value} icon={icon} />
    </button>
  );
}

export default LoansKpiStrip;
