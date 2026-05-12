/**
 * Bill detail — `/dashboard/crm/purchases/expenses/[id]`.
 *
 * Server component: hydrates the bill via the Rust client, resolves
 * relational fields through `<EntityPickerChip>`, and renders the
 * custom-field bag alongside the standard fields. Edit lives on this
 * page; the delete dialog lives on the list page.
 *
 * NB: route segment is `[id]`; the entity is a "bill" in the Rust BFF
 * even though the URL says "expenses".
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Wallet, Pencil, ArrowLeft } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruBadge,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
import { getBill } from '@/app/actions/crm/bills.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import type { CrmBillStatus } from '@/lib/rust-client/crm-bills';

export const dynamic = 'force-dynamic';

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

const STATUS_VARIANT: Record<
  CrmBillStatus,
  'ghost' | 'success' | 'warning' | 'danger'
> = {
  draft: 'ghost',
  submitted: 'warning',
  approved: 'warning',
  paid: 'success',
  partially_paid: 'warning',
  overdue: 'danger',
  cancelled: 'ghost',
};

function statusLabel(s?: string): string {
  if (!s) return '—';
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ bill, error }, customFields] = await Promise.all([
    getBill(id),
    getCustomFieldsFor('expense') as Promise<WsCustomField[]>,
  ]);

  if (!bill) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">Couldn&apos;t load this bill — {error}</p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/expenses">
              <ArrowLeft className="h-4 w-4" /> Back to Bills
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const title = bill.billNo || bill.vendorInvoiceNo || 'Bill';
  const status = bill.status as CrmBillStatus | undefined;
  const cfValues = (bill.customFields ?? {}) as Record<string, unknown>;
  const items = bill.items ?? [];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={title}
        subtitle={bill.vendorInvoiceNo && bill.billNo ? `Vendor invoice ${bill.vendorInvoiceNo}` : 'Bill'}
        icon={Wallet}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/purchases/expenses">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/purchases/expenses/${id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </ZoruButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <ZoruCard className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Header
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Bill number">{bill.billNo || '—'}</Field>
            <Field label="Vendor invoice number">{bill.vendorInvoiceNo || '—'}</Field>
            <Field label="Vendor">
              {bill.vendorId ? (
                <EntityPickerChip entity="vendor" id={bill.vendorId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Status">
              {status ? (
                <ZoruBadge variant={STATUS_VARIANT[status] ?? 'ghost'}>
                  {statusLabel(status)}
                </ZoruBadge>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Bill date">{fmtDate(bill.billDate)}</Field>
            <Field label="Due date">{fmtDate(bill.dueDate)}</Field>
            <Field label="Place of supply">{bill.placeOfSupply || '—'}</Field>
            <Field label="Reverse charge">{bill.reverseCharge ? 'Yes' : 'No'}</Field>
            <Field label="TDS section">{bill.tdsSection || '—'}</Field>
            <Field label="TDS amount">{fmtMoney(bill.tdsAmount, bill.currency)}</Field>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Totals
          </h3>
          <div className="flex flex-col gap-3 text-[13px]">
            <Field label="Currency">{bill.currency || '—'}</Field>
            <div className="flex justify-between">
              <span className="text-zoru-ink-muted">Subtotal</span>
              <span className="tabular-nums text-zoru-ink">
                {fmtMoney(bill.totals?.subTotal, bill.currency)}
              </span>
            </div>
            <div className="flex justify-between border-t border-zoru-line pt-2">
              <span className="font-medium text-zoru-ink">Total</span>
              <span className="text-base font-semibold tabular-nums text-zoru-ink">
                {fmtMoney(bill.totals?.total, bill.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zoru-ink-muted">Paid</span>
              <span className="tabular-nums text-zoru-ink">
                {fmtMoney(bill.amountPaid, bill.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zoru-ink-muted">Balance</span>
              <span className="tabular-nums text-zoru-ink">
                {fmtMoney(bill.balance, bill.currency)}
              </span>
            </div>
          </div>
        </ZoruCard>
      </div>

      <ZoruCard className="overflow-hidden p-0">
        <h3 className="border-b border-zoru-line p-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Line items
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-zoru-surface-2">
              <tr className="border-b border-zoru-line text-left">
                <th className="p-3 font-medium text-zoru-ink">Item</th>
                <th className="p-3 font-medium text-zoru-ink">Description</th>
                <th className="p-3 text-right font-medium text-zoru-ink">Qty</th>
                <th className="p-3 text-right font-medium text-zoru-ink">Rate</th>
                <th className="p-3 text-right font-medium text-zoru-ink">Tax %</th>
                <th className="p-3 text-right font-medium text-zoru-ink">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No line items on this bill.
                  </td>
                </tr>
              ) : (
                items.map((li, idx) => (
                  <tr key={idx} className="border-b border-zoru-line last:border-b-0">
                    <td className="p-3 align-top">
                      {li.itemId ? (
                        <EntityPickerChip entity="item" id={li.itemId} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 align-top text-zoru-ink-muted">
                      {li.description || '—'}
                    </td>
                    <td className="p-3 text-right align-top tabular-nums">
                      {li.qty}
                    </td>
                    <td className="p-3 text-right align-top tabular-nums">
                      {fmtMoney(li.rate, bill.currency)}
                    </td>
                    <td className="p-3 text-right align-top tabular-nums text-zoru-ink-muted">
                      {li.taxRatePct != null ? `${li.taxRatePct}%` : '—'}
                    </td>
                    <td className="p-3 text-right align-top tabular-nums">
                      {fmtMoney(li.total, bill.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ZoruCard>

      {bill.notes ? (
        <ZoruCard className="p-6">
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Notes
          </h3>
          <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">{bill.notes}</p>
        </ZoruCard>
      ) : null}

      {customFields.length > 0 ? (
        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Custom fields
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {customFields.map((f) => (
              <Field key={String(f._id ?? f.name)} label={f.label || f.name}>
                <CustomFieldDisplay
                  field={f}
                  value={cfValues[f.name] as Parameters<typeof CustomFieldDisplay>[0]['value']}
                />
              </Field>
            ))}
          </div>
        </ZoruCard>
      ) : null}

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(bill.createdAt || bill.audit?.createdAt)} · Updated{' '}
        {fmtDate(bill.updatedAt || bill.audit?.updatedAt)}
      </div>
    </div>
  );
}
