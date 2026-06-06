'use client';

import { StatCard } from '@/components/sabcrm/20ui';
import {
  CheckCircle2,
  ChevronDown,
  IndianRupee,
  TrendingDown,
  TrendingUp,
  } from 'lucide-react';

/**
 * KPI strip for the Budgets list (§1D.1).
 *
 *  • Active          — status !== 'archived' && !== 'rejected'
 *  • Over budget     — actual > planAmount
 *  • Under budget    — actual <= planAmount AND planAmount > 0
 *  • Total allocated — sum of planAmount across non-archived rows
 */

import * as React from 'react';

import type { BudgetRow } from './budgets-types';

export type BudgetsKpiKey = 'all' | 'active' | 'over' | 'under';

export interface BudgetsKpiCounts {
  active: number;
  over: number;
  under: number;
  totalAllocated: number;
}

export function computeBudgetKpis(rows: BudgetRow[]): BudgetsKpiCounts {
  let active = 0;
  let over = 0;
  let under = 0;
  let totalAllocated = 0;
  for (const r of rows) {
    const s = (r.status ?? '').toLowerCase();
    const isArchived = s === 'archived' || s === 'rejected';
    if (!isArchived) {
      active += 1;
      if (typeof r.planAmount === 'number') totalAllocated += r.planAmount;
    }
    if (
      typeof r.actual === 'number' &&
      typeof r.planAmount === 'number' &&
      r.planAmount > 0
    ) {
      if (r.actual > r.planAmount) over += 1;
      else under += 1;
    }
  }
  return { active, over, under, totalAllocated };
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export interface BudgetsKpiStripProps {
  counts: BudgetsKpiCounts;
  active: BudgetsKpiKey;
  onPick: (next: BudgetsKpiKey) => void;
}

export function BudgetsKpiStrip({
  counts,
  active,
  onPick,
}: BudgetsKpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Active"
        value={counts.active.toLocaleString()}
        icon={<CheckCircle2 className="h-4 w-4" />}
        active={active === 'active'}
        onClick={() => onPick(active === 'active' ? 'all' : 'active')}
      />
      <KpiCard
        label="Over budget"
        value={counts.over.toLocaleString()}
        icon={<TrendingUp className="h-4 w-4" />}
        active={active === 'over'}
        onClick={() => onPick(active === 'over' ? 'all' : 'over')}
      />
      <KpiCard
        label="Under budget"
        value={counts.under.toLocaleString()}
        icon={<TrendingDown className="h-4 w-4" />}
        active={active === 'under'}
        onClick={() => onPick(active === 'under' ? 'all' : 'under')}
      />
      <KpiCard
        label="Total allocated"
        value={inr.format(counts.totalAllocated)}
        icon={<IndianRupee className="h-4 w-4" />}
        active={false}
        onClick={() => onPick('all')}
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

// Silence unused import warning for ChevronDown if not used later.
export { ChevronDown };
export default BudgetsKpiStrip;
