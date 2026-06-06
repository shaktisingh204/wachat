'use client';

import { StatCard } from '@/components/sabcrm/20ui/compat';
import { fmtINR } from '@/lib/utils';
import { Boxes, CheckCircle2, AlertTriangle, XCircle, Wallet, PackageCheck } from 'lucide-react';

/**
 * <ItemsKpiStrip> — KPI strip for the canonical items list.
 *
 * 5 cards: total SKUs, active, low stock, out of stock, inventory value.
 * Each card is clickable so the user can pivot the list filter from a KPI.
 */

import * as React from 'react';

import type { ItemKpiSnapshot, ItemPresetKey } from './types';

interface ItemsKpiStripProps {
  kpi: ItemKpiSnapshot;
  currency: string;
  active?: ItemPresetKey | null;
  onSelect: (preset: ItemPresetKey) => void;
}


export function ItemsKpiStrip({ kpi, currency, active, onSelect }: ItemsKpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <KpiButton
        active={active === 'all'}
        onClick={() => onSelect('all')}
        ariaLabel="Show all SKUs"
      >
        <StatCard
          label="Total SKUs"
          value={kpi.totalCount.toLocaleString()}
          period="all items"
          icon={<Boxes />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'active'}
        onClick={() => onSelect('active')}
        ariaLabel="Show active SKUs"
      >
        <StatCard
          label="Active"
          value={kpi.activeCount.toLocaleString()}
          period="not archived"
          icon={<CheckCircle2 />}
        />
      </KpiButton>
      <StatCard
        label="In stock"
        value={kpi.inStockCount.toLocaleString()}
        period="on-hand > 0"
        icon={<PackageCheck />}
      />
      <KpiButton
        active={active === 'low-stock'}
        onClick={() => onSelect('low-stock')}
        ariaLabel="Show low-stock SKUs"
      >
        <StatCard
          label="Low stock"
          value={kpi.lowStockCount.toLocaleString()}
          period="≤ reorder point"
          icon={<AlertTriangle />}
          invertDelta
        />
      </KpiButton>
      <KpiButton
        active={active === 'out-of-stock'}
        onClick={() => onSelect('out-of-stock')}
        ariaLabel="Show out-of-stock SKUs"
      >
        <StatCard
          label="Out of stock"
          value={kpi.outOfStockCount.toLocaleString()}
          period="0 on hand"
          icon={<XCircle />}
          invertDelta
        />
      </KpiButton>
      <StatCard
        label="Inventory value"
        value={fmtINR(kpi.inventoryValue, currency)}
        period="cost × on-hand"
        icon={<Wallet />}
      />
    </div>
  );
}

function KpiButton({
  children,
  active,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={Boolean(active)}
      className={[
        'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary',
        active ? 'rounded-[var(--zoru-radius-lg)] ring-1 ring-zoru-primary' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
