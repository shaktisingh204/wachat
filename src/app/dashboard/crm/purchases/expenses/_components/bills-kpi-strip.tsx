'use client';

import { StatCard } from '@/components/sabcrm/20ui';
import { AlertCircle, Banknote, Building2, Clock, FileEdit, Hourglass, TrendingUp, Wallet } from 'lucide-react';

/**
 * <BillsKpiStrip> — KPI strip for the canonical bills list (§1D).
 *
 * 5 cards: outstanding · overdue · paid this month · drafts · avg days
 * to pay. Each card is clickable so users can pivot the list filter
 * from a KPI.
 *
 * Mirrors `<InvoicesKpiStrip>`, adapted for the AP / vendor side.
 */

import * as React from 'react';

import type { BillKpiSnapshot, BillPresetKey } from './types';

interface BillsKpiStripProps {
  kpi: BillKpiSnapshot;
  currency: string;
  active?: BillPresetKey | null;
  onSelect: (preset: BillPresetKey) => void;
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

export function BillsKpiStrip({
  kpi,
  currency,
  active,
  onSelect,
}: BillsKpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiButton
        active={active === 'all'}
        onClick={() => onSelect('all')}
        ariaLabel="Show all unpaid bills"
      >
        <StatCard
          label="Outstanding"
          value={fmtMoney(kpi.outstanding, currency)}
          period="non-paid balance"
          icon={<Wallet />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'my-overdue'}
        onClick={() => onSelect('my-overdue')}
        ariaLabel="Show overdue bills"
      >
        <StatCard
          label="Overdue"
          value={`${kpi.overdueCount.toLocaleString()} · ${fmtMoney(
            kpi.overdueAmount,
            currency,
          )}`}
          period="past due date"
          icon={<AlertCircle />}
          invertDelta
        />
      </KpiButton>
      <KpiButton
        active={active === 'paid-30d'}
        onClick={() => onSelect('paid-30d')}
        ariaLabel="Show bills paid this month"
      >
        <StatCard
          label="Paid this month"
          value={`${kpi.paidThisMonthCount.toLocaleString()} · ${fmtMoney(
            kpi.paidThisMonthAmount,
            currency,
          )}`}
          period="closed-paid"
          icon={<Banknote />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'draft'}
        onClick={() => onSelect('draft')}
        ariaLabel="Show draft bills"
      >
        <StatCard
          label="Drafts"
          value={kpi.draftCount.toLocaleString()}
          period="not yet submitted"
          icon={<FileEdit />}
        />
      </KpiButton>
      <StatCard
        label="Avg days to pay"
        value={
          kpi.avgDaysToPay != null ? `${kpi.avgDaysToPay.toFixed(1)} d` : '—'
        }
        period="receive → paid"
        icon={<Clock />}
      />
      <StatCard
        label="Total MTD"
        value={fmtMoney(kpi.mtdSpend, currency)}
        period="this month billed"
        icon={<TrendingUp />}
      />
      <StatCard
        label="Pending approval"
        value={kpi.pendingApprovalCount.toLocaleString()}
        period="awaiting approver"
        icon={<Hourglass />}
        invertDelta
      />
      <StatCard
        label="Top vendor"
        value={
          kpi.topVendorId
            ? fmtMoney(kpi.topVendorAmount, currency)
            : '—'
        }
        period={
          kpi.topVendorId
            ? `${kpi.topVendorCount} bill${kpi.topVendorCount === 1 ? '' : 's'}`
            : 'no data'
        }
        icon={<Building2 />}
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
        'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]',
        active ? 'rounded-[var(--st-radius-lg)] ring-1 ring-[var(--st-text)]' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
