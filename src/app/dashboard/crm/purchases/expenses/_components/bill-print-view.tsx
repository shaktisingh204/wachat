/**
 * <BillPrintView> — standalone printable bill layout. Rendered when the
 * detail page receives `?print=1`.
 */

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

interface BillPrintViewProps {
  bill: CrmBillDoc;
  vendorLabel?: string | null;
}

export function BillPrintView({ bill, vendorLabel }: BillPrintViewProps) {
  const currency = bill.currency || 'INR';
  const totals = bill.totals ?? { subTotal: 0, total: 0 };
  const items = bill.items ?? [];
  const expenseLines = bill.expenseLines ?? [];

  return (
    <div className="mx-auto max-w-3xl bg-white p-10 text-[13px] text-black print:p-6">
      <header className="mb-8 flex items-start justify-between border-b border-black/30 pb-6">
        <div>
          <h1 className="text-3xl font-semibold">BILL</h1>
          <p className="mt-1 text-[14px] text-zoru-ink">
            {bill.billNo || '—'}
          </p>
        </div>
        <div className="text-right text-[12px] text-zoru-ink">
          <p>
            <strong>Bill date:</strong> {fmtDate(bill.billDate)}
          </p>
          <p>
            <strong>Due date:</strong> {fmtDate(bill.dueDate)}
          </p>
          {bill.vendorInvoiceNo ? (
            <p>
              <strong>Vendor invoice:</strong> {bill.vendorInvoiceNo}
            </p>
          ) : null}
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-6">
        <div>
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zoru-ink">
            Vendor
          </h2>
          <p className="text-[14px]">{vendorLabel || bill.vendorId || '—'}</p>
        </div>
        <div>
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zoru-ink">
            Status
          </h2>
          <p className="text-[14px] capitalize">
            {(bill.status ?? 'draft').replace(/_/g, ' ')}
          </p>
        </div>
      </section>

      {items.length > 0 ? (
        <table className="mb-6 w-full border border-black/30 text-[12.5px]">
          <thead className="bg-zoru-surface-2">
            <tr>
              <th className="border-r border-black/30 p-2 text-left">
                Description
              </th>
              <th className="border-r border-black/30 p-2 text-right">Qty</th>
              <th className="border-r border-black/30 p-2 text-right">Rate</th>
              <th className="p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((li, idx) => (
              <tr key={idx} className="border-t border-black/20">
                <td className="border-r border-black/30 p-2">
                  {li.description || '—'}
                </td>
                <td className="border-r border-black/30 p-2 text-right tabular-nums">
                  {li.qty}
                </td>
                <td className="border-r border-black/30 p-2 text-right tabular-nums">
                  {fmtMoney(li.rate, currency)}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {fmtMoney(li.total, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {expenseLines.length > 0 ? (
        <table className="mb-6 w-full border border-black/30 text-[12.5px]">
          <thead className="bg-zoru-surface-2">
            <tr>
              <th className="border-r border-black/30 p-2 text-left">Account</th>
              <th className="border-r border-black/30 p-2 text-left">
                Description
              </th>
              <th className="p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenseLines.map((li, idx) => (
              <tr key={idx} className="border-t border-black/20">
                <td className="border-r border-black/30 p-2">
                  {li.accountId || '—'}
                </td>
                <td className="border-r border-black/30 p-2">
                  {li.description || '—'}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {fmtMoney(li.amount, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <section className="ml-auto max-w-xs space-y-1 text-[13px]">
        <div className="flex justify-between">
          <span className="text-zoru-ink">Subtotal</span>
          <span className="tabular-nums">
            {fmtMoney(totals.subTotal, currency)}
          </span>
        </div>
        {bill.tdsAmount != null && bill.tdsAmount > 0 ? (
          <div className="flex justify-between">
            <span className="text-zoru-ink">
              TDS{bill.tdsSection ? ` (${bill.tdsSection})` : ''}
            </span>
            <span className="tabular-nums">
              -{fmtMoney(bill.tdsAmount, currency)}
            </span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-black/30 pt-1">
          <span className="font-semibold">Total</span>
          <span className="text-[14px] font-semibold tabular-nums">
            {fmtMoney(totals.total, currency)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zoru-ink">Paid</span>
          <span className="tabular-nums">
            {fmtMoney(bill.amountPaid ?? 0, currency)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zoru-ink">Balance</span>
          <span className="tabular-nums">
            {fmtMoney(bill.balance ?? totals.total, currency)}
          </span>
        </div>
      </section>

      {bill.notes ? (
        <section className="mt-8 border-t border-black/30 pt-4">
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zoru-ink">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-[12.5px]">{bill.notes}</p>
        </section>
      ) : null}
    </div>
  );
}
