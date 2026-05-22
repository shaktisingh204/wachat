'use client';

import { StatCard } from '@/components/zoruui';
import { Banknote, CheckCircle2, CircleDollarSign, FileEdit, Loader2, } from 'lucide-react';

/**
 * <PayrollRunsKpiStrip> — KPI strip for the canonical payroll-runs list
 * (per §1D.1). 5 cards: Drafts · Processing · Approved · Disbursed ·
 * Total payout (sum across periods).
 */

import * as React from 'react';

export interface PayrollRunsKpiSnapshot {
  drafts: number;
  processing: number;
  approved: number;
  disbursed: number;
  totalNetPayout: number;
  currency: string;
}

export type PayrollRunsKpiKey =
  | 'drafts'
  | 'processing'
  | 'approved'
  | 'disbursed'
  | 'payout';

interface PayrollRunsKpiStripProps {
  kpi: PayrollRunsKpiSnapshot;
  active?: PayrollRunsKpiKey | null;
  onSelect: (key: PayrollRunsKpiKey) => void;
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

export function PayrollRunsKpiStrip({
  kpi,
  active,
  onSelect,
}: PayrollRunsKpiStripProps): React.JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiButton
        active={active === 'drafts'}
        onClick={() => onSelect('drafts')}
        ariaLabel="Show draft payroll runs"
      >
        <StatCard
          label="Drafts"
          value={kpi.drafts.toLocaleString()}
          period="not yet processed"
          icon={<FileEdit />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'processing'}
        onClick={() => onSelect('processing')}
        ariaLabel="Show processing payroll runs"
      >
        <StatCard
          label="Processing"
          value={kpi.processing.toLocaleString()}
          period="computed, awaiting review"
          icon={<Loader2 />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'approved'}
        onClick={() => onSelect('approved')}
        ariaLabel="Show approved payroll runs"
      >
        <StatCard
          label="Approved"
          value={kpi.approved.toLocaleString()}
          period="ready to disburse"
          icon={<CheckCircle2 />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'disbursed'}
        onClick={() => onSelect('disbursed')}
        ariaLabel="Show disbursed payroll runs"
      >
        <StatCard
          label="Disbursed"
          value={kpi.disbursed.toLocaleString()}
          period="bank file generated"
          icon={<Banknote />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'payout'}
        onClick={() => onSelect('payout')}
        ariaLabel="Show payout totals"
      >
        <StatCard
          label="Total payout"
          value={fmtMoney(kpi.totalNetPayout, kpi.currency)}
          period="net · all periods"
          icon={<CircleDollarSign />}
        />
      </KpiButton>
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
        active
          ? 'rounded-[var(--zoru-radius-lg)] ring-1 ring-zoru-primary'
          : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
