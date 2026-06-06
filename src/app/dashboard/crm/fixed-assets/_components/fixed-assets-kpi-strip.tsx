'use client';

import { StatCard } from '@/components/sabcrm/20ui';
import { Boxes, IndianRupee, Layers, TrendingDown, Wallet } from 'lucide-react';

/**
 * KPI strip for the Fixed Assets list (§1D.1).
 *
 *  • Total              — count of assets
 *  • By category        — number of distinct categories
 *  • Total cost         — sum of cost
 *  • Total NBV          — sum of netBookValue
 *  • Depreciation YTD   — sum of accumulatedDepreciation (proxy for YTD)
 */

import * as React from 'react';

import type { CrmFixedAssetDoc } from '@/lib/rust-client/crm-fixed-assets';

export type FixedAssetsKpiKey = 'all' | 'active' | 'retired';

export interface FixedAssetsKpiCounts {
  total: number;
  byCategory: number;
  totalCost: number;
  totalNbv: number;
  depreciation: number;
}

export function computeFixedAssetKpis(
  rows: CrmFixedAssetDoc[],
): FixedAssetsKpiCounts {
  const categories = new Set<string>();
  let totalCost = 0;
  let totalNbv = 0;
  let depreciation = 0;
  for (const a of rows) {
    if (a.category) categories.add(a.category);
    if (typeof a.cost === 'number') totalCost += a.cost;
    if (typeof a.netBookValue === 'number') totalNbv += a.netBookValue;
    if (typeof a.accumulatedDepreciation === 'number') {
      depreciation += a.accumulatedDepreciation;
    }
  }
  return {
    total: rows.length,
    byCategory: categories.size,
    totalCost,
    totalNbv,
    depreciation,
  };
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export interface FixedAssetsKpiStripProps {
  counts: FixedAssetsKpiCounts;
  active: FixedAssetsKpiKey;
  onPick: (next: FixedAssetsKpiKey) => void;
}

export function FixedAssetsKpiStrip({
  counts,
  active,
  onPick,
}: FixedAssetsKpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        label="Total"
        value={counts.total.toLocaleString()}
        icon={<Boxes className="h-4 w-4" />}
        active={active === 'all'}
        onClick={() => onPick('all')}
      />
      <KpiCard
        label="Categories"
        value={counts.byCategory.toLocaleString()}
        icon={<Layers className="h-4 w-4" />}
        active={false}
        onClick={() => onPick('all')}
      />
      <KpiCard
        label="Total cost"
        value={inr.format(counts.totalCost)}
        icon={<IndianRupee className="h-4 w-4" />}
        active={false}
        onClick={() => onPick('all')}
      />
      <KpiCard
        label="Total NBV"
        value={inr.format(counts.totalNbv)}
        icon={<Wallet className="h-4 w-4" />}
        active={false}
        onClick={() => onPick('all')}
      />
      <KpiCard
        label="Depreciation"
        value={inr.format(counts.depreciation)}
        icon={<TrendingDown className="h-4 w-4" />}
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

export default FixedAssetsKpiStrip;
