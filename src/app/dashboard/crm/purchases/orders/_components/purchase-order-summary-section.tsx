'use client';

import { ZoruCard, ZoruInput, ZoruLabel, ZoruSeparator } from '@/components/zoruui';
/**
 * <PurchaseOrderSummarySection> — money summary card for
 * `<PurchaseOrderForm>`.
 *
 * Two columns: left is editable inputs (discount, shipping, adjustment,
 * round-off); right is the rendered breakdown ending in Total. Mirrors
 * the Invoices summary section.
 */

import * as React from 'react';

export interface SummarySectionProps {
  currency: string;
  subTotal: number;
  total: number;
  discountOverall: string;
  shippingCharge: string;
  adjustment: string;
  roundOff: string;
  onDiscountOverall: (v: string) => void;
  onShippingCharge: (v: string) => void;
  onAdjustment: (v: string) => void;
  onRoundOff: (v: string) => void;
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

function SummaryInputRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <ZoruLabel className="text-zoru-ink-muted">{label}</ZoruLabel>
      <ZoruInput
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-32 text-right tabular-nums"
        placeholder="0"
      />
    </div>
  );
}

export function PurchaseOrderSummarySection({
  currency,
  subTotal,
  total,
  discountOverall,
  shippingCharge,
  adjustment,
  roundOff,
  onDiscountOverall,
  onShippingCharge,
  onAdjustment,
  onRoundOff,
}: SummarySectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Summary
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <SummaryInputRow
            label="Discount (overall)"
            value={discountOverall}
            onChange={onDiscountOverall}
          />
          <SummaryInputRow
            label="Shipping charge"
            value={shippingCharge}
            onChange={onShippingCharge}
          />
          <SummaryInputRow
            label="Adjustment"
            value={adjustment}
            onChange={onAdjustment}
          />
          <SummaryInputRow
            label="Round off"
            value={roundOff}
            onChange={onRoundOff}
          />
        </div>
        <div className="ml-auto w-full max-w-sm space-y-2 text-[13px]">
          <Row label="Subtotal" value={fmtMoney(subTotal, currency)} />
          {discountOverall ? (
            <Row
              label="Discount"
              value={`-${fmtMoney(Number(discountOverall) || 0, currency)}`}
            />
          ) : null}
          {shippingCharge ? (
            <Row
              label="Shipping"
              value={fmtMoney(Number(shippingCharge) || 0, currency)}
            />
          ) : null}
          {adjustment ? (
            <Row
              label="Adjustment"
              value={fmtMoney(Number(adjustment) || 0, currency)}
            />
          ) : null}
          {roundOff ? (
            <Row
              label="Round off"
              value={fmtMoney(Number(roundOff) || 0, currency)}
            />
          ) : null}
          <ZoruSeparator />
          <div className="flex justify-between">
            <span className="font-medium text-zoru-ink">Total</span>
            <span className="text-base font-semibold tabular-nums text-zoru-ink">
              {fmtMoney(total, currency)}
            </span>
          </div>
          <p className="text-[11px] text-zoru-ink-muted">
            Server recomputes authoritatively on save.
          </p>
        </div>
      </div>
    </ZoruCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zoru-ink-muted">{label}</span>
      <span className="tabular-nums text-zoru-ink">{value}</span>
    </div>
  );
}
