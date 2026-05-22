'use client';

import { Card, Input, Label, Separator } from '@/components/zoruui';
/**
 * Sub-sections of `<SalesOrdersForm>` — shipping address card + totals
 * preview card. Extracted to keep the parent form under the 600-line
 * per-file cap.
 */

import * as React from 'react';

export type ShipAddr = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

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

/* ─── Shipping address card ─────────────────────────────────────── */

export interface ShippingAddressCardProps {
  ship: ShipAddr;
  setShip: React.Dispatch<React.SetStateAction<ShipAddr>>;
}

export function ShippingAddressCard({ ship, setShip }: ShippingAddressCardProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Shipping address
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <ZoruLabel htmlFor="ship-line1">Line 1</ZoruLabel>
          <ZoruInput
            id="ship-line1"
            value={ship.line1 ?? ''}
            onChange={(e) => setShip((p) => ({ ...p, line1: e.target.value }))}
            className="mt-1.5"
            maxLength={200}
          />
        </div>
        <div className="md:col-span-2">
          <ZoruLabel htmlFor="ship-line2">Line 2</ZoruLabel>
          <ZoruInput
            id="ship-line2"
            value={ship.line2 ?? ''}
            onChange={(e) => setShip((p) => ({ ...p, line2: e.target.value }))}
            className="mt-1.5"
            maxLength={200}
          />
        </div>
        <div>
          <ZoruLabel htmlFor="ship-city">City</ZoruLabel>
          <ZoruInput
            id="ship-city"
            value={ship.city ?? ''}
            onChange={(e) => setShip((p) => ({ ...p, city: e.target.value }))}
            className="mt-1.5"
            maxLength={100}
          />
        </div>
        <div>
          <ZoruLabel htmlFor="ship-state">State</ZoruLabel>
          <ZoruInput
            id="ship-state"
            value={ship.state ?? ''}
            onChange={(e) => setShip((p) => ({ ...p, state: e.target.value }))}
            className="mt-1.5"
            maxLength={100}
          />
        </div>
        <div>
          <ZoruLabel htmlFor="ship-postal">Postal code</ZoruLabel>
          <ZoruInput
            id="ship-postal"
            value={ship.postalCode ?? ''}
            onChange={(e) => setShip((p) => ({ ...p, postalCode: e.target.value }))}
            className="mt-1.5"
            maxLength={20}
          />
        </div>
        <div>
          <ZoruLabel htmlFor="ship-country">Country</ZoruLabel>
          <ZoruInput
            id="ship-country"
            value={ship.country ?? ''}
            onChange={(e) => setShip((p) => ({ ...p, country: e.target.value }))}
            className="mt-1.5"
            maxLength={100}
          />
        </div>
      </div>
    </ZoruCard>
  );
}

/* ─── Totals preview card ───────────────────────────────────────── */

export interface TotalsCardProps {
  currency: string;
  subTotal: number;
  lineTotals: number;
  total: number;
  shippingCharge: string;
  setShippingCharge: (v: string) => void;
  discountOverall: string;
  setDiscountOverall: (v: string) => void;
  adjustment: string;
  setAdjustment: (v: string) => void;
}

export function TotalsCard({
  currency,
  subTotal,
  lineTotals,
  total,
  shippingCharge,
  setShippingCharge,
  discountOverall,
  setDiscountOverall,
  adjustment,
  setAdjustment,
}: TotalsCardProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Totals
      </h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <ZoruLabel htmlFor="shippingCharge">Shipping charge</ZoruLabel>
            <ZoruInput
              id="shippingCharge"
              type="number"
              step="any"
              min={0}
              value={shippingCharge}
              onChange={(e) => setShippingCharge(e.target.value)}
              className="mt-1.5"
              placeholder="0"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="discountOverall">Overall discount</ZoruLabel>
            <ZoruInput
              id="discountOverall"
              type="number"
              step="any"
              min={0}
              value={discountOverall}
              onChange={(e) => setDiscountOverall(e.target.value)}
              className="mt-1.5"
              placeholder="0"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="adjustment">Adjustment</ZoruLabel>
            <ZoruInput
              id="adjustment"
              type="number"
              step="any"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              className="mt-1.5"
              placeholder="0"
            />
          </div>
        </div>
        <div className="flex flex-col justify-end gap-2 rounded-md border border-zoru-line bg-zoru-surface-2 p-4 text-[13px]">
          <div className="flex justify-between text-zoru-ink-muted">
            <span>Sub-total</span>
            <span className="tabular-nums text-zoru-ink">
              {fmtMoney(subTotal, currency)}
            </span>
          </div>
          <div className="flex justify-between text-zoru-ink-muted">
            <span>Lines incl. tax</span>
            <span className="tabular-nums text-zoru-ink">
              {fmtMoney(lineTotals, currency)}
            </span>
          </div>
          <ZoruSeparator />
          <div className="flex justify-between text-[14px] font-semibold text-zoru-ink">
            <span>Total ({currency})</span>
            <span className="tabular-nums">{fmtMoney(total, currency)}</span>
          </div>
          <p className="text-[11px] text-zoru-ink-muted">
            Server recomputes authoritatively on save.
          </p>
        </div>
      </div>
    </ZoruCard>
  );
}
