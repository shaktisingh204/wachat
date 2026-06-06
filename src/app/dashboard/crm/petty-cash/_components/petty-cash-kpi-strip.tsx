'use client';

import { StatCard } from '@/components/sabcrm/20ui/compat';
import { AlertOctagon, IndianRupee, Receipt, Wallet, } from 'lucide-react';

/**
 * KPI strip for the Petty Cash list (§1D.1).
 *
 *  • Active floats  — status === 'active'
 *  • Total balance  — sum of current balance
 *  • Top-up due     — topUpDueAt in past OR balance ≤ 0
 *  • Pending IOUs   — sum of pendingIous across rows
 */

import * as React from 'react';

import type { PettyCashRow } from './petty-cash-types';

export type PettyCashKpiKey = 'all' | 'active' | 'topUpDue' | 'ious';

export interface PettyCashKpiCounts {
  active: number;
  totalBalance: number;
  topUpDue: number;
  pendingIous: number;
}

export function computePettyCashKpis(rows: PettyCashRow[]): PettyCashKpiCounts {
  const now = Date.now();
  let active = 0;
  let totalBalance = 0;
  let topUpDue = 0;
  let pendingIous = 0;
  for (const r of rows) {
    if ((r.status ?? '').toLowerCase() === 'active') active += 1;
    if (typeof r.balance === 'number') totalBalance += r.balance;
    const due = r.topUpDueAt ? new Date(r.topUpDueAt).getTime() : NaN;
    if (
      (Number.isFinite(due) && due <= now) ||
      (typeof r.balance === 'number' && r.balance <= 0)
    ) {
      topUpDue += 1;
    }
    if (typeof r.pendingIous === 'number') pendingIous += r.pendingIous;
  }
  return { active, totalBalance, topUpDue, pendingIous };
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export interface PettyCashKpiStripProps {
  counts: PettyCashKpiCounts;
  active: PettyCashKpiKey;
  onPick: (next: PettyCashKpiKey) => void;
}

export function PettyCashKpiStrip({
  counts,
  active,
  onPick,
}: PettyCashKpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Active floats"
        value={counts.active.toLocaleString()}
        icon={<Wallet className="h-4 w-4" />}
        active={active === 'active'}
        onClick={() => onPick(active === 'active' ? 'all' : 'active')}
      />
      <KpiCard
        label="Total balance"
        value={inr.format(counts.totalBalance)}
        icon={<IndianRupee className="h-4 w-4" />}
        active={false}
        onClick={() => onPick('all')}
      />
      <KpiCard
        label="Top-up due"
        value={counts.topUpDue.toLocaleString()}
        icon={<AlertOctagon className="h-4 w-4" />}
        active={active === 'topUpDue'}
        onClick={() => onPick(active === 'topUpDue' ? 'all' : 'topUpDue')}
      />
      <KpiCard
        label="Pending IOUs"
        value={inr.format(counts.pendingIous)}
        icon={<Receipt className="h-4 w-4" />}
        active={active === 'ious'}
        onClick={() => onPick(active === 'ious' ? 'all' : 'ious')}
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

export default PettyCashKpiStrip;
