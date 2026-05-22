import { Badge, Card } from '@/components/zoruui';
/**
 * <BillDetailBody> — body cards on the bill detail page.
 *
 * Pure server component (no client directive). Renders Overview, Vendor,
 * Line items + totals OR Expense lines, Money summary, Payment history
 * (payouts), Linked PO/GRN, Notes, Tags.
 */

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { CrmBillDoc } from '@/lib/rust-client/crm-bills';

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

interface BillDetailBodyProps {
  bill: CrmBillDoc;
  vendorContact: { email: string | null; phone: string | null };
}

export function BillDetailBody({ bill, vendorContact }: BillDetailBodyProps) {
  const currency = bill.currency || 'INR';
  const status = bill.status ?? 'draft';
  const totals = bill.totals ?? { subTotal: 0, total: 0 };
  const items = bill.items ?? [];
  const expenseLines = bill.expenseLines ?? [];

  /* Aggregate GST split for the money-summary card. */
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let cess = 0;
  for (const li of items) {
    cgst += Number(li.cgstAmount) || 0;
    sgst += Number(li.sgstAmount) || 0;
    igst += Number(li.igstAmount) || 0;
    cess += Number(li.cessAmount) || 0;
  }

  return (
    <>
      {/* Overview */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Overview
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <DetailField label="Bill number">{bill.billNo || '—'}</DetailField>
          <DetailField label="Status">
            <StatusPill
              label={String(status).replace(/_/g, ' ')}
              tone={statusToTone(status)}
            />
          </DetailField>
          <DetailField label="Vendor invoice number">
            {bill.vendorInvoiceNo || '—'}
          </DetailField>
          <DetailField label="Bill date">{fmtDate(bill.billDate)}</DetailField>
          <DetailField label="Due date">{fmtDate(bill.dueDate)}</DetailField>
          <DetailField label="Place of supply">
            {bill.placeOfSupply || '—'}
          </DetailField>
          <DetailField label="Currency">{currency}</DetailField>
          <DetailField label="Reverse charge">
            {bill.reverseCharge ? 'Yes' : 'No'}
          </DetailField>
          <DetailField label="TDS section">{bill.tdsSection || '—'}</DetailField>
          <DetailField label="TDS amount">
            {fmtMoney(bill.tdsAmount, currency)}
          </DetailField>
        </div>
      </Card>

      {/* Vendor */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Vendor
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <DetailField label="Vendor">
            {bill.vendorId ? (
              <EntityPickerChip entity="vendor" id={bill.vendorId} />
            ) : (
              '—'
            )}
          </DetailField>
          {vendorContact.email ? (
            <DetailField label="Primary email">{vendorContact.email}</DetailField>
          ) : null}
          {vendorContact.phone ? (
            <DetailField label="Primary phone">{vendorContact.phone}</DetailField>
          ) : null}
        </div>
      </Card>

      {/* Line items */}
      {items.length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Line items
          </h2>
          <div className="overflow-x-auto rounded-md border border-zoru-line">
            <table className="w-full text-[13px]">
              <thead className="bg-zoru-surface-2">
                <tr className="border-b border-zoru-line text-left">
                  <th className="p-2 font-medium text-zoru-ink">Item</th>
                  <th className="p-2 font-medium text-zoru-ink">Description</th>
                  <th className="p-2 text-right font-medium text-zoru-ink">
                    Qty
                  </th>
                  <th className="p-2 text-right font-medium text-zoru-ink">
                    Rate
                  </th>
                  <th className="p-2 text-right font-medium text-zoru-ink">
                    Disc %
                  </th>
                  <th className="p-2 text-right font-medium text-zoru-ink">
                    Tax %
                  </th>
                  <th className="p-2 text-right font-medium text-zoru-ink">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((li, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-zoru-line last:border-b-0"
                  >
                    <td className="p-2 align-top">
                      {li.itemId ? (
                        <EntityPickerChip entity="item" id={li.itemId} />
                      ) : (
                        <span className="text-zoru-ink-muted">—</span>
                      )}
                    </td>
                    <td className="p-2 align-top text-zoru-ink">
                      {li.description || '—'}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-zoru-ink">
                      {li.qty}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-zoru-ink">
                      {fmtMoney(li.rate, currency)}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-zoru-ink-muted">
                      {li.discountPct != null ? `${li.discountPct}%` : '—'}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-zoru-ink-muted">
                      {li.taxRatePct != null ? `${li.taxRatePct}%` : '—'}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-zoru-ink">
                      {fmtMoney(li.total, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zoru-surface-2/50 font-medium">
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
        </Card>
      ) : null}

      {/* Expense lines */}
      {expenseLines.length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Expense lines
          </h2>
          <div className="overflow-x-auto rounded-md border border-zoru-line">
            <table className="w-full text-[13px]">
              <thead className="bg-zoru-surface-2">
                <tr className="border-b border-zoru-line text-left">
                  <th className="p-2 font-medium text-zoru-ink">Account</th>
                  <th className="p-2 font-medium text-zoru-ink">Description</th>
                  <th className="p-2 text-right font-medium text-zoru-ink">
                    Tax %
                  </th>
                  <th className="p-2 text-right font-medium text-zoru-ink">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {expenseLines.map((li, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-zoru-line last:border-b-0"
                  >
                    <td className="p-2 align-top">
                      {li.accountId ? (
                        <EntityPickerChip entity="account" id={li.accountId} />
                      ) : (
                        <span className="text-zoru-ink-muted">—</span>
                      )}
                    </td>
                    <td className="p-2 align-top text-zoru-ink">
                      {li.description || '—'}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-zoru-ink-muted">
                      {li.taxRatePct != null ? `${li.taxRatePct}%` : '—'}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-zoru-ink">
                      {fmtMoney(li.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* Money summary */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Money summary
        </h2>
        <div className="ml-auto max-w-sm space-y-2 text-[13px]">
          <SummaryLine
            label="Subtotal"
            value={fmtMoney(totals.subTotal, currency)}
          />
          {cgst > 0 ? (
            <SummaryLine label="CGST" value={fmtMoney(cgst, currency)} />
          ) : null}
          {sgst > 0 ? (
            <SummaryLine label="SGST" value={fmtMoney(sgst, currency)} />
          ) : null}
          {igst > 0 ? (
            <SummaryLine label="IGST" value={fmtMoney(igst, currency)} />
          ) : null}
          {cess > 0 ? (
            <SummaryLine label="Cess" value={fmtMoney(cess, currency)} />
          ) : null}
          {bill.tdsAmount != null && bill.tdsAmount > 0 ? (
            <SummaryLine
              label={`TDS${bill.tdsSection ? ` (${bill.tdsSection})` : ''}`}
              value={`-${fmtMoney(bill.tdsAmount, currency)}`}
            />
          ) : null}
          <div className="flex justify-between border-t border-zoru-line pt-2">
            <span className="font-medium text-zoru-ink">Total</span>
            <span className="text-base font-semibold tabular-nums text-zoru-ink">
              {fmtMoney(totals.total, currency)}
            </span>
          </div>
          <SummaryLine
            label="Paid"
            value={fmtMoney(bill.amountPaid ?? 0, currency)}
          />
          <SummaryLine
            label="Balance"
            value={fmtMoney(bill.balance ?? totals.total, currency)}
            tone={(bill.balance ?? totals.total) > 0 ? 'danger' : 'default'}
          />
        </div>
      </Card>

      {/* Notes */}
      {bill.notes ? (
        <Card className="p-6">
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
            {bill.notes}
          </p>
        </Card>
      ) : null}

      {/* Tags */}
      {Array.isArray(bill.tags) && bill.tags.length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {bill.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}
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
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
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
      <span className="text-zoru-ink-muted">{label}</span>
      <span
        className={`font-mono tabular-nums ${
          tone === 'danger' ? 'text-zoru-danger-ink' : 'text-zoru-ink'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
