/**
 * <InvoicePrintView> — single-column print layout for `?print=1`.
 *
 * Pure server component (no client directive). Receives a fully-projected
 * invoice + a customer label and renders a stylised invoice block with
 * header, customer, line items, summary, bank/UPI, T&C, signature line.
 */

import type { CrmInvoiceDoc } from '@/lib/rust-client/crm-invoices';

interface InvoicePrintViewProps {
  invoice: CrmInvoiceDoc;
  customerLabel?: string;
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

export function InvoicePrintView({ invoice, customerLabel }: InvoicePrintViewProps) {
  const currency = invoice.currency || 'INR';
  const items = invoice.items ?? [];
  const totals = invoice.totals ?? { subTotal: 0, total: 0 };
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 print:p-0">
      <header className="flex items-start justify-between border-b border-[var(--st-border)] pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--st-text)]">
            Invoice {invoice.invoiceNo}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
            Issued {fmtDate(invoice.date)} · Due {fmtDate(invoice.dueDate)}
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
          Bill to
        </h2>
        <p className="text-[13px] text-[var(--st-text)]">{customerLabel ?? invoice.clientId}</p>
        {invoice.placeOfSupply ? (
          <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">
            Place of supply: {invoice.placeOfSupply}
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
                <td colSpan={5} className="py-3 text-center text-[var(--st-text-secondary)]">
                  No line items.
                </td>
              </tr>
            ) : (
              items.map((li, i) => (
                <tr key={i} className="border-b border-[var(--st-border)]/60">
                  <td className="py-1.5">{li.itemId ?? '—'}</td>
                  <td className="py-1.5 text-[var(--st-text-secondary)]">{li.description ?? '—'}</td>
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
          <SummaryLine label="Subtotal" value={fmtMoney(totals.subTotal, currency)} />
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
          {invoice.tcsPct != null ? (
            <SummaryLine label="TCS %" value={`${invoice.tcsPct}%`} />
          ) : null}
          {invoice.tdsPct != null ? (
            <SummaryLine label="TDS %" value={`${invoice.tdsPct}%`} />
          ) : null}
          <div className="flex justify-between border-t border-[var(--st-border)] pt-2 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{fmtMoney(totals.total, currency)}</span>
          </div>
          {invoice.amountPaid != null ? (
            <SummaryLine
              label="Paid"
              value={fmtMoney(invoice.amountPaid, currency)}
            />
          ) : null}
          {invoice.balance != null ? (
            <SummaryLine
              label="Balance"
              value={fmtMoney(invoice.balance, currency)}
            />
          ) : null}
        </dl>
      </section>

      {invoice.bankDetails || invoice.upiId ? (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Bank / UPI
          </h2>
          <div className="grid gap-2 text-[12.5px] md:grid-cols-2">
            {invoice.bankDetails?.bankName ? (
              <p>
                <span className="text-[var(--st-text-secondary)]">Bank:</span>{' '}
                {invoice.bankDetails.bankName}
              </p>
            ) : null}
            {invoice.bankDetails?.accountNo ? (
              <p>
                <span className="text-[var(--st-text-secondary)]">A/c:</span>{' '}
                {invoice.bankDetails.accountNo}
              </p>
            ) : null}
            {invoice.bankDetails?.ifsc ? (
              <p>
                <span className="text-[var(--st-text-secondary)]">IFSC:</span>{' '}
                {invoice.bankDetails.ifsc}
              </p>
            ) : null}
            {invoice.upiId ? (
              <p>
                <span className="text-[var(--st-text-secondary)]">UPI:</span> {invoice.upiId}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {invoice.termsAndConditions ? (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Terms &amp; conditions
          </h2>
          <p className="whitespace-pre-wrap text-[12.5px]">
            {invoice.termsAndConditions}
          </p>
        </section>
      ) : null}

      <footer className="mt-12 flex justify-end">
        <div className="text-right text-[12.5px]">
          <div className="border-t border-[var(--st-border)] pt-2">Authorized signature</div>
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
