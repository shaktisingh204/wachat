'use client';

import { Card, Input, Label, Separator } from '@/components/zoruui';
/**
 * <SummarySection> — invoice money summary card.
 *
 * Two columns: left is editable inputs (discounts, shipping, adjustment,
 * round-off, TCS, TDS); right is the rendered breakdown ending in Total
 * + (in edit mode) Paid / Balance.
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
  defaultTcsPct: number | string;
  defaultTdsPct: number | string;
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

function SummaryRow({
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

export function SummarySection({
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
  defaultTcsPct,
  defaultTdsPct,
  editing,
  amountPaid,
  balance,
}: SummarySectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Summary
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <SummaryRow
            label="Discount (overall)"
            value={discountOverall}
            onChange={onDiscountOverall}
          />
          <SummaryRow
            label="Shipping charge"
            value={shippingCharge}
            onChange={onShippingCharge}
          />
          <SummaryRow
            label="Adjustment"
            value={adjustment}
            onChange={onAdjustment}
          />
          <SummaryRow label="Round off" value={roundOff} onChange={onRoundOff} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <ZoruLabel htmlFor="tcsPct">TCS %</ZoruLabel>
              <ZoruInput
                id="tcsPct"
                name="tcsPct"
                type="number"
                step="0.01"
                min={0}
                defaultValue={defaultTcsPct}
                className="mt-1.5"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="tdsPct">TDS %</ZoruLabel>
              <ZoruInput
                id="tdsPct"
                name="tdsPct"
                type="number"
                step="0.01"
                min={0}
                defaultValue={defaultTdsPct}
                className="mt-1.5"
              />
            </div>
          </div>
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
          {editing ? (
            <>
              <Row label="Amount paid" value={fmtMoney(amountPaid ?? 0, currency)} />
              <Row label="Balance" value={fmtMoney(balance ?? total, currency)} />
            </>
          ) : null}
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
