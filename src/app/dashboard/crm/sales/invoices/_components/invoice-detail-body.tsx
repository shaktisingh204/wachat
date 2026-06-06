import { Card } from '@/components/sabcrm/20ui/compat';
/**
 * <InvoiceDetailBody> — body cards on the invoice detail page.
 *
 * Pure server component (no client directive). Renders Overview,
 * Customer, Line items + totals, Money summary. The dynamic / mutating
 * regions live elsewhere (right rail, header actions, notes composer).
 */

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { CrmInvoiceDoc } from '@/lib/rust-client/crm-invoices';

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

interface InvoiceDetailBodyProps {
  invoice: CrmInvoiceDoc;
  customer: { email: string | null; phone: string | null };
}

export function InvoiceDetailBody({ invoice, customer }: InvoiceDetailBodyProps) {
  const currency = invoice.currency || 'INR';
  const status = invoice.status ?? 'draft';
  const totals = invoice.totals ?? { subTotal: 0, total: 0 };
  const items = invoice.items ?? [];

  return (
    <>
      {/* Overview */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Overview
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <DetailField label="Invoice number">
            {invoice.invoiceNo || '—'}
          </DetailField>
          <DetailField label="Status">
            <StatusPill
              label={String(status).replace(/_/g, ' ')}
              tone={statusToTone(status)}
            />
          </DetailField>
          <DetailField label="Invoice date">{fmtDate(invoice.date)}</DetailField>
          <DetailField label="Due date">{fmtDate(invoice.dueDate)}</DetailField>
          <DetailField label="Place of supply">
            {invoice.placeOfSupply || '—'}
          </DetailField>
          <DetailField label="GST treatment">
            {invoice.gstTreatment || '—'}
          </DetailField>
          <DetailField label="Currency">{currency}</DetailField>
          <DetailField label="Payment terms">
            {invoice.paymentTerms || '—'}
          </DetailField>
          <DetailField label="Reverse charge">
            {invoice.reverseCharge ? 'Yes' : 'No'}
          </DetailField>
          <DetailField label="E-way bill">{invoice.ewayBillNo || '—'}</DetailField>
        </div>
      </Card>

      {/* Customer */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Customer
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <DetailField label="Customer">
            {invoice.clientId ? (
              <EntityPickerChip entity="client" id={invoice.clientId} />
            ) : (
              '—'
            )}
          </DetailField>
          {customer.email ? (
            <DetailField label="Primary email">{customer.email}</DetailField>
          ) : null}
          {customer.phone ? (
            <DetailField label="Primary phone">{customer.phone}</DetailField>
          ) : null}
          {typeof invoice.billingAddress === 'string' && invoice.billingAddress ? (
            <DetailField label="Billing address">
              <pre className="whitespace-pre-wrap font-sans text-[13px]">
                {invoice.billingAddress}
              </pre>
            </DetailField>
          ) : null}
          {typeof invoice.shippingAddress === 'string' &&
          invoice.shippingAddress ? (
            <DetailField label="Shipping address">
              <pre className="whitespace-pre-wrap font-sans text-[13px]">
                {invoice.shippingAddress}
              </pre>
            </DetailField>
          ) : null}
        </div>
      </Card>

      {/* Line items */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Line items
        </h2>
        {items.length === 0 ? (
          <p className="text-[13px] text-[var(--st-text-secondary)]">No line items.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[var(--st-border)]">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--st-bg-muted)]">
                <tr className="border-b border-[var(--st-border)] text-left">
                  <th className="p-2 font-medium text-[var(--st-text)]">Item</th>
                  <th className="p-2 font-medium text-[var(--st-text)]">Description</th>
                  <th className="p-2 text-right font-medium text-[var(--st-text)]">
                    Qty
                  </th>
                  <th className="p-2 text-right font-medium text-[var(--st-text)]">
                    Rate
                  </th>
                  <th className="p-2 text-right font-medium text-[var(--st-text)]">
                    Disc %
                  </th>
                  <th className="p-2 text-right font-medium text-[var(--st-text)]">
                    Tax %
                  </th>
                  <th className="p-2 text-right font-medium text-[var(--st-text)]">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((li, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-[var(--st-border)] last:border-b-0"
                  >
                    <td className="p-2 align-top">
                      {li.itemId ? (
                        <EntityPickerChip entity="item" id={li.itemId} />
                      ) : (
                        <span className="text-[var(--st-text-secondary)]">—</span>
                      )}
                    </td>
                    <td className="p-2 align-top text-[var(--st-text)]">
                      {li.description || '—'}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-[var(--st-text)]">
                      {li.qty}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-[var(--st-text)]">
                      {fmtMoney(li.rate, currency)}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-[var(--st-text-secondary)]">
                      {li.discountPct != null ? `${li.discountPct}%` : '—'}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-[var(--st-text-secondary)]">
                      {li.taxRatePct != null ? `${li.taxRatePct}%` : '—'}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-[var(--st-text)]">
                      {fmtMoney(li.total, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--st-bg-muted)]/50 font-medium">
                  <td className="p-2" colSpan={6}>
                    Subtotal
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {fmtMoney(totals.subTotal, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Money summary */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Money summary
        </h2>
        <div className="ml-auto max-w-sm space-y-2 text-[13px]">
          <SummaryLine
            label="Subtotal"
            value={fmtMoney(totals.subTotal, currency)}
          />
          {totals.discountOverall != null ? (
            <SummaryLine
              label="Discount"
              value={`-${fmtMoney(totals.discountOverall, currency)}`}
            />
          ) : null}
          {totals.shippingCharge != null ? (
            <SummaryLine
              label="Shipping"
              value={fmtMoney(totals.shippingCharge, currency)}
            />
          ) : null}
          {totals.adjustment != null ? (
            <SummaryLine
              label="Adjustment"
              value={fmtMoney(totals.adjustment, currency)}
            />
          ) : null}
          {totals.roundOff != null ? (
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
          <div className="flex justify-between border-t border-[var(--st-border)] pt-2">
            <span className="font-medium text-[var(--st-text)]">Total</span>
            <span className="text-base font-semibold tabular-nums text-[var(--st-text)]">
              {fmtMoney(totals.total, currency)}
            </span>
          </div>
          <SummaryLine
            label="Paid"
            value={fmtMoney(invoice.amountPaid ?? 0, currency)}
          />
          <SummaryLine
            label="Balance"
            value={fmtMoney(invoice.balance ?? totals.total, currency)}
            tone={
              (invoice.balance ?? totals.total) > 0 ? 'danger' : 'default'
            }
          />
        </div>
      </Card>
    </>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
    </div>
  );
}

function SummaryLine({
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
