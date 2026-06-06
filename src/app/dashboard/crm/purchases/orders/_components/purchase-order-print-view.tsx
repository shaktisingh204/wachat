/**
 * <PurchaseOrderPrintView> — single-column print layout for `?print=1`.
 *
 * Pure server component (no client directive). Receives a fully-
 * projected PO + a vendor label and renders a stylised PO block with
 * header, vendor, line items, summary, T&C, signature line.
 */

import type { CrmPurchaseOrderDoc } from '@/lib/rust-client/crm-purchase-orders';

interface PurchaseOrderPrintViewProps {
  order: CrmPurchaseOrderDoc;
  vendorLabel?: string;
}

function fmtMoney(value: number | undefined, currency: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function PurchaseOrderPrintView({
  order,
  vendorLabel,
}: PurchaseOrderPrintViewProps) {
  const currency = order.currency || 'INR';
  const items = order.items ?? [];
  const totals = order.totals ?? { subTotal: 0, total: 0 };
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 print:p-0">
      <header className="flex items-start justify-between border-b border-[var(--st-border)] pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--st-text)]">
            Purchase order {order.poNo}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
            Issued {fmtDate(order.date)} · Expected{' '}
            {fmtDate(order.expectedDelivery)}
          </p>
        </div>
        <div className="text-right text-[13px]">
          <div className="text-[var(--st-text-secondary)]">Total</div>
          <div className="text-xl font-semibold tabular-nums text-[var(--st-text)]">
            {fmtMoney(totals.total, currency)}
          </div>
        </div>
      </header>

      <section>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Vendor
        </h2>
        <p className="text-[13px] text-[var(--st-text)]">
          {vendorLabel ?? order.vendorId}
        </p>
        {order.paymentTerms ? (
          <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">
            Payment terms: {order.paymentTerms}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Line items
        </h2>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-[var(--st-border)] text-left">
              <th className="py-1.5">Item</th>
              <th className="py-1.5">Description</th>
              <th className="py-1.5 text-right">Qty</th>
              <th className="py-1.5 text-right">Rate</th>
              <th className="py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-3 text-center text-[var(--st-text-secondary)]"
                >
                  No line items.
                </td>
              </tr>
            ) : (
              items.map((li, i) => (
                <tr key={i} className="border-b border-[var(--st-border)]/60">
                  <td className="py-1.5">{li.itemId ?? '—'}</td>
                  <td className="py-1.5 text-[var(--st-text-secondary)]">
                    {li.description ?? '—'}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{li.qty}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {fmtMoney(li.rate, currency)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {fmtMoney(li.total, currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="flex justify-end">
        <dl className="w-full max-w-sm space-y-1.5 text-[13px]">
          <SummaryLine
            label="Subtotal"
            value={fmtMoney(totals.subTotal, currency)}
          />
          {totals.discountOverall ? (
            <SummaryLine
              label="Discount"
              value={`-${fmtMoney(totals.discountOverall, currency)}`}
            />
          ) : null}
          {totals.shippingCharge ? (
            <SummaryLine
              label="Shipping"
              value={fmtMoney(totals.shippingCharge, currency)}
            />
          ) : null}
          {totals.adjustment ? (
            <SummaryLine
              label="Adjustment"
              value={fmtMoney(totals.adjustment, currency)}
            />
          ) : null}
          {totals.roundOff ? (
            <SummaryLine
              label="Round off"
              value={fmtMoney(totals.roundOff, currency)}
            />
          ) : null}
          <div className="flex justify-between border-t border-[var(--st-border)] pt-2 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">
              {fmtMoney(totals.total, currency)}
            </span>
          </div>
        </dl>
      </section>

      {order.termsAndConditions ? (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Terms &amp; conditions
          </h2>
          <p className="whitespace-pre-wrap text-[12.5px]">
            {order.termsAndConditions}
          </p>
        </section>
      ) : null}

      <footer className="mt-12 flex justify-end">
        <div className="text-right text-[12.5px]">
          <div className="border-t border-[var(--st-border)] pt-2">
            Authorized signature
          </div>
        </div>
      </footer>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--st-text-secondary)]">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
