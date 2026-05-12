/**
 * Invoice detail — `/dashboard/crm/sales/invoices/[id]`.
 *
 * Server component: hydrates the invoice via the Rust client, resolves
 * relational fields through `<EntityPickerChip>`, and renders the
 * custom-field bag alongside the standard fields. Edit and Delete
 * actions live on this page; the delete dialog is on the list page.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Receipt, Pencil, ArrowLeft } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruBadge,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
import { getInvoice } from '@/app/actions/crm/invoices.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import type { CrmInvoiceStatus } from '@/lib/rust-client/crm-invoices';

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
  CrmInvoiceStatus,
  'ghost' | 'success' | 'warning' | 'danger'
> = {
  draft: 'ghost',
  sent: 'warning',
  paid: 'success',
  partially_paid: 'warning',
  overdue: 'danger',
  cancelled: 'ghost',
};

function statusLabel(s?: string): string {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ invoice, error }, customFields] = await Promise.all([
    getInvoice(id),
    getCustomFieldsFor('invoice') as Promise<WsCustomField[]>,
  ]);

  if (!invoice) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this invoice — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/sales/invoices">
              <ArrowLeft className="h-4 w-4" /> Back to Invoices
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const cfValues = (invoice.customFields ?? {}) as Record<string, unknown>;
  const currency = invoice.currency || 'INR';
  const status = invoice.status as CrmInvoiceStatus | undefined;
  const totals = invoice.totals ?? { subTotal: 0, total: 0 };
  const items = invoice.items ?? [];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={invoice.invoiceNo || 'Invoice'}
        subtitle={`Issued ${fmtDate(invoice.date)} · Due ${fmtDate(invoice.dueDate)}`}
        icon={Receipt}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/sales/invoices">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/sales/invoices/${id}/edit`}>
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
            <Field label="Invoice number">{invoice.invoiceNo || '—'}</Field>
            <Field label="Status">
              {status ? (
                <ZoruBadge variant={STATUS_VARIANT[status] ?? 'ghost'}>
                  {statusLabel(status)}
                </ZoruBadge>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Customer">
              {invoice.clientId ? (
                <EntityPickerChip entity="client" id={invoice.clientId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Place of supply">{invoice.placeOfSupply || '—'}</Field>
            <Field label="Issue date">{fmtDate(invoice.date)}</Field>
            <Field label="Due date">{fmtDate(invoice.dueDate)}</Field>
            <Field label="Currency">{currency}</Field>
            <Field label="Payment terms">{invoice.paymentTerms || '—'}</Field>
          </div>

          <h3 className="mb-4 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Line items
          </h3>
          {items.length === 0 ? (
            <p className="text-[13px] text-zoru-ink-muted">No line items.</p>
          ) : (
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
                      Tax %
                    </th>
                    <th className="p-2 text-right font-medium text-zoru-ink">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((li, idx) => (
                    <tr key={idx} className="border-b border-zoru-line last:border-b-0">
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
                        {li.taxRatePct != null ? `${li.taxRatePct}%` : '—'}
                      </td>
                      <td className="p-2 text-right align-top tabular-nums text-zoru-ink">
                        {fmtMoney(li.total, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(invoice.customerNotes || invoice.termsAndConditions) && (
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {invoice.customerNotes ? (
                <Field label="Customer notes">
                  <div className="whitespace-pre-wrap text-[13px]">
                    {invoice.customerNotes}
                  </div>
                </Field>
              ) : null}
              {invoice.termsAndConditions ? (
                <Field label="Terms & conditions">
                  <div className="whitespace-pre-wrap text-[13px]">
                    {invoice.termsAndConditions}
                  </div>
                </Field>
              ) : null}
            </div>
          )}
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Totals
          </h3>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-zoru-ink-muted">Subtotal</span>
              <span className="tabular-nums text-zoru-ink">
                {fmtMoney(totals.subTotal, currency)}
              </span>
            </div>
            {totals.discountOverall != null ? (
              <div className="flex justify-between">
                <span className="text-zoru-ink-muted">Discount</span>
                <span className="tabular-nums text-zoru-ink">
                  -{fmtMoney(totals.discountOverall, currency)}
                </span>
              </div>
            ) : null}
            {totals.shippingCharge != null ? (
              <div className="flex justify-between">
                <span className="text-zoru-ink-muted">Shipping</span>
                <span className="tabular-nums text-zoru-ink">
                  {fmtMoney(totals.shippingCharge, currency)}
                </span>
              </div>
            ) : null}
            {invoice.tcsPct != null ? (
              <div className="flex justify-between">
                <span className="text-zoru-ink-muted">TCS</span>
                <span className="tabular-nums text-zoru-ink">
                  {invoice.tcsPct}%
                </span>
              </div>
            ) : null}
            {invoice.tdsPct != null ? (
              <div className="flex justify-between">
                <span className="text-zoru-ink-muted">TDS</span>
                <span className="tabular-nums text-zoru-ink">
                  {invoice.tdsPct}%
                </span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-zoru-line pt-2">
              <span className="font-medium text-zoru-ink">Total</span>
              <span className="text-base font-semibold tabular-nums text-zoru-ink">
                {fmtMoney(totals.total, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zoru-ink-muted">Amount paid</span>
              <span className="tabular-nums text-zoru-ink">
                {fmtMoney(invoice.amountPaid ?? 0, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zoru-ink-muted">Balance</span>
              <span className="tabular-nums text-zoru-ink">
                {fmtMoney(invoice.balance ?? totals.total, currency)}
              </span>
            </div>
          </div>
        </ZoruCard>
      </div>

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
                  value={
                    cfValues[f.name] as Parameters<
                      typeof CustomFieldDisplay
                    >[0]['value']
                  }
                />
              </Field>
            ))}
          </div>
        </ZoruCard>
      ) : null}

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(invoice.createdAt || invoice.audit?.createdAt)} · Updated{' '}
        {fmtDate(invoice.updatedAt || invoice.audit?.updatedAt)}
      </div>
    </div>
  );
}
