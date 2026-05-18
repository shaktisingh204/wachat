'use client';

import { ZoruStatCard } from '@/components/zoruui';
import { AlertCircle, Banknote, Clock, FileEdit, Wallet, } from 'lucide-react';

/**
 * <InvoicesKpiStrip> — KPI strip for the canonical invoices list.
 *
 * 5 cards: outstanding, overdue, paid this month, draft, avg days to pay.
 * Each card is clickable so users can pivot the list filter from a KPI.
 */

import * as React from 'react';

import type { InvoiceKpiSnapshot, InvoicePresetKey } from './types';

interface InvoicesKpiStripProps {
  kpi: InvoiceKpiSnapshot;
  currency: string;
  active?: InvoicePresetKey | null;
  onSelect: (preset: InvoicePresetKey) => void;
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

export function InvoicesKpiStrip({
  kpi,
  currency,
  active,
  onSelect,
}: InvoicesKpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiButton
        active={active === 'all'}
        onClick={() => onSelect('all')}
        ariaLabel="Show all unpaid invoices"
      >
        <ZoruStatCard
          label="Outstanding"
          value={fmtMoney(kpi.outstanding, currency)}
          period="non-paid balance"
          icon={<Wallet />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'my-overdue'}
        onClick={() => onSelect('my-overdue')}
        ariaLabel="Show overdue invoices"
      >
        <ZoruStatCard
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
        ariaLabel="Show invoices paid this month"
      >
        <ZoruStatCard
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
        ariaLabel="Show draft invoices"
      >
        <ZoruStatCard
          label="Drafts"
          value={kpi.draftCount.toLocaleString()}
          period="not yet sent"
          icon={<FileEdit />}
        />
      </KpiButton>
      <ZoruStatCard
        label="Avg days to pay"
        value={kpi.avgDaysToPay != null ? `${kpi.avgDaysToPay.toFixed(1)} d` : '—'}
        period="create → paid"
        icon={<Clock />}
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
