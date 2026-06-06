'use client';

import { Card, Separator } from '@/components/sabcrm/20ui';
/**
 * <BillSummarySection> — bill money summary card.
 *
 * Subtotal, total tax (rolled up from line items if any), total, amount
 * paid (RO), balance. Server recomputes authoritatively on save.
 */

import * as React from 'react';

export interface BillSummarySectionProps {
  currency: string;
  subTotal: number;
  total: number;
  totalTax?: number;
  editing: boolean;
  amountPaid?: number;
  balance?: number;
}

function fmtMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value.toFixed(2)}`;
  }
}

export function BillSummarySection({
  currency,
  subTotal,
  total,
  totalTax = 0,
  editing,
  amountPaid,
  balance,
}: BillSummarySectionProps) {
  return (
    <Card className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
        Summary
      </h3>
      <div className="ml-auto w-full max-w-sm space-y-2 text-[13px]">
        <Row label="Subtotal" value={fmtMoney(subTotal, currency)} />
        {totalTax > 0 ? (
          <Row label="Total tax" value={fmtMoney(totalTax, currency)} />
        ) : null}
        <Separator />
        <div className="flex justify-between">
          <span className="font-medium text-[var(--st-text)]">Total</span>
          <span className="text-base font-semibold tabular-nums text-[var(--st-text)]">
            {fmtMoney(total, currency)}
          </span>
        </div>
        {editing ? (
          <>
            <Row label="Amount paid" value={fmtMoney(amountPaid ?? 0, currency)} />
            <Row
              label="Balance"
              value={fmtMoney(balance ?? total, currency)}
              tone={(balance ?? total) > 0 ? 'danger' : 'default'}
            />
          </>
        ) : null}
        <p className="text-[11px] text-[var(--st-text-secondary)]">
          Server recomputes authoritatively on save.
        </p>
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--st-text-secondary)]">{label}</span>
      <span
        className={`font-mono tabular-nums ${
          tone === 'danger' ? 'text-[var(--st-danger)]' : 'text-[var(--st-text)]'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
