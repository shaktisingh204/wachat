/**
 * <QuotationPrintView> — clean single-column layout rendered when the
 * detail page receives `?print=1`. Server-renderable (no `'use client'`)
 * so it streams quickly into print contexts.
 */

import type { CrmQuotationDoc, CrmQuotationLineItem } from '@/lib/rust-client/crm-quotations';

interface QuotationPrintViewProps {
  quotation: CrmQuotationDoc;
}

function fmtMoney(value?: number | null, currency = 'INR'): string {
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

function fmtDate(v?: string | Date | null): string {
  if (!v) return '—';
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

function PrintField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="text-[12.5px] text-zoru-ink">{value}</div>
    </div>
  );
}

export function QuotationPrintView({ quotation }: QuotationPrintViewProps) {
  const status = (quotation.status ?? 'draft').toLowerCase();
  const items: CrmQuotationLineItem[] = quotation.items ?? [];
  const totals = quotation.totals ?? { subTotal: 0, total: 0 };
  const currency = quotation.currency ?? 'INR';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 print:p-0">
      <header className="border-b border-zoru-line pb-4">
        <h1 className="text-2xl font-semibold text-zoru-ink">
          Quotation {quotation.quotationNo}
        </h1>
        <p className="mt-1 text-[13px] text-zoru-ink-muted">
          {quotation.subject || ''} · {fmtMoney(totals.total, currency)} · {status}
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Header
        </h2>
        <dl className="grid grid-cols-2 gap-3 text-[13px]">
          <PrintField label="Quotation #" value={quotation.quotationNo} />
          <PrintField label="Status" value={status} />
          <PrintField label="Date" value={fmtDate(quotation.date)} />
          <PrintField label="Valid until" value={fmtDate(quotation.validUntil)} />
          <PrintField label="Customer" value={quotation.clientId ?? '—'} />
          <PrintField label="Currency" value={currency} />
          <PrintField label="Place of supply" value={quotation.placeOfSupply ?? '—'} />
          <PrintField label="Reference #" value={quotation.referenceNo ?? '—'} />
        </dl>
      </section>

      <section>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Line items
        </h2>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-zoru-line">
              <th className="p-2 text-left">Item</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Rate</th>
              <th className="p-2 text-right">Tax %</th>
              <th className="p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((li, i) => (
              <tr key={i} className="border-b border-zoru-line last:border-b-0">
                <td className="p-2">{li.description ?? li.itemId ?? '—'}</td>
                <td className="p-2 text-right font-mono tabular-nums">{li.qty}</td>
                <td className="p-2 text-right font-mono tabular-nums">
                  {fmtMoney(li.rate, currency)}
                </td>
                <td className="p-2 text-right font-mono tabular-nums">
                  {typeof li.taxRatePct === 'number' ? `${li.taxRatePct}%` : '—'}
                </td>
                <td className="p-2 text-right font-mono tabular-nums">
                  {fmtMoney(li.total, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Totals
        </h2>
        <dl className="grid grid-cols-2 gap-1 text-[13px]">
          <dt>Subtotal</dt>
          <dd className="text-right font-mono tabular-nums">
            {fmtMoney(totals.subTotal, currency)}
          </dd>
          <dt>Total</dt>
          <dd className="text-right font-mono tabular-nums font-medium">
            {fmtMoney(totals.total, currency)}
          </dd>
        </dl>
      </section>

      {quotation.termsAndConditions ? (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Terms &amp; conditions
          </h2>
          <p className="whitespace-pre-wrap text-[13px]">
            {quotation.termsAndConditions}
          </p>
        </section>
      ) : null}

      {quotation.customerNotes ? (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-[13px]">{quotation.customerNotes}</p>
        </section>
      ) : null}
    </div>
  );
}
