/**
 * Quotation detail — `/dashboard/crm/sales/quotations/[id]`.
 *
 * Server component: hydrates the quotation via the Rust client,
 * resolves relational fields through `<EntityPickerChip>`, renders the
 * line-items table + totals breakdown, and exposes the custom-field
 * bag alongside the standard fields. Edit lives on this page; the
 * delete dialog is on the list page.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText, Pencil, ArrowLeft } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
import { getQuotation } from '@/app/actions/crm/quotations.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import type { CrmQuotationLineItem } from '@/lib/rust-client/crm-quotations';

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

const STATUS_VARIANT: Record<string, 'ghost' | 'success' | 'warning' | 'danger' | 'outline'> = {
  draft: 'ghost',
  sent: 'warning',
  accepted: 'success',
  rejected: 'danger',
  expired: 'danger',
  converted: 'outline',
};

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

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ quotation, error }, customFields] = await Promise.all([
    getQuotation(id),
    getCustomFieldsFor('quotation') as Promise<WsCustomField[]>,
  ]);

  if (!quotation) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this quotation — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/sales/quotations">
              <ArrowLeft className="h-4 w-4" /> Back to Quotations
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const status = (quotation.status ?? 'draft').toLowerCase();
  const cfValues = (quotation.customFields ?? {}) as Record<string, unknown>;
  const items: CrmQuotationLineItem[] = quotation.items ?? [];
  const totals = quotation.totals ?? { subTotal: 0, total: 0 };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={quotation.quotationNo || 'Quotation'}
        subtitle={quotation.subject || 'Quotation detail'}
        icon={FileText}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/sales/quotations">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/sales/quotations/${id}/edit`}>
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
            <Field label="Quotation #">{quotation.quotationNo || '—'}</Field>
            <Field label="Status">
              <ZoruBadge variant={STATUS_VARIANT[status] ?? 'ghost'}>{status}</ZoruBadge>
            </Field>
            <Field label="Customer">
              {quotation.clientId ? (
                <EntityPickerChip entity="client" id={quotation.clientId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Owner">
              {quotation.assignment?.assignedTo ? (
                <EntityPickerChip
                  entity="user"
                  id={quotation.assignment.assignedTo}
                />
              ) : quotation.salesAgentId ? (
                <EntityPickerChip entity="user" id={quotation.salesAgentId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Quotation date">{fmtDate(quotation.date)}</Field>
            <Field label="Valid until">{fmtDate(quotation.validUntil)}</Field>
            <Field label="Currency">{quotation.currency || '—'}</Field>
            <Field label="Place of supply">{quotation.placeOfSupply || '—'}</Field>
          </div>

          <h3 className="mb-3 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Line items
          </h3>
          {items.length === 0 ? (
            <p className="text-[13px] text-zoru-ink-muted">No line items.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
              <table className="w-full text-[13px]">
                <thead className="bg-zoru-surface-2">
                  <tr className="border-b border-zoru-line">
                    <th className="p-2.5 text-left text-zoru-ink">Item</th>
                    <th className="p-2.5 text-right text-zoru-ink">Qty</th>
                    <th className="p-2.5 text-right text-zoru-ink">Unit price</th>
                    <th className="p-2.5 text-right text-zoru-ink">Tax %</th>
                    <th className="p-2.5 text-right text-zoru-ink">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((li, idx) => (
                    <tr
                      key={`${li.itemId ?? 'row'}-${idx}`}
                      className="border-b border-zoru-line last:border-b-0"
                    >
                      <td className="p-2.5">
                        {li.itemId ? (
                          <EntityPickerChip entity="item" id={li.itemId} />
                        ) : (
                          <span className="text-zoru-ink">
                            {li.description || '—'}
                          </span>
                        )}
                        {li.itemId && li.description ? (
                          <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                            {li.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-2.5 text-right text-zoru-ink tabular-nums">
                        {li.qty}
                      </td>
                      <td className="p-2.5 text-right text-zoru-ink tabular-nums">
                        {fmtMoney(li.rate, quotation.currency)}
                      </td>
                      <td className="p-2.5 text-right text-zoru-ink-muted tabular-nums">
                        {typeof li.taxRatePct === 'number' ? `${li.taxRatePct}%` : '—'}
                      </td>
                      <td className="p-2.5 text-right text-zoru-ink tabular-nums">
                        {fmtMoney(li.total, quotation.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {quotation.termsAndConditions ? (
            <div className="mt-6 rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
              <div className="text-[11.5px] text-zoru-ink-muted">Terms &amp; conditions</div>
              <div className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                {quotation.termsAndConditions}
              </div>
            </div>
          ) : null}

          {quotation.customerNotes ? (
            <div className="mt-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
              <div className="text-[11.5px] text-zoru-ink-muted">Customer notes</div>
              <div className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                {quotation.customerNotes}
              </div>
            </div>
          ) : null}
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Totals
          </h3>
          <div className="flex flex-col gap-3 text-[13px]">
            <div className="flex justify-between">
              <span className="text-zoru-ink-muted">Subtotal</span>
              <span className="text-zoru-ink tabular-nums">
                {fmtMoney(totals.subTotal, quotation.currency)}
              </span>
            </div>
            {typeof totals.discountOverall === 'number' ? (
              <div className="flex justify-between">
                <span className="text-zoru-ink-muted">Discount</span>
                <span className="text-zoru-ink tabular-nums">
                  −{fmtMoney(totals.discountOverall, quotation.currency)}
                </span>
              </div>
            ) : null}
            {typeof totals.shippingCharge === 'number' ? (
              <div className="flex justify-between">
                <span className="text-zoru-ink-muted">Shipping</span>
                <span className="text-zoru-ink tabular-nums">
                  {fmtMoney(totals.shippingCharge, quotation.currency)}
                </span>
              </div>
            ) : null}
            {typeof totals.adjustment === 'number' ? (
              <div className="flex justify-between">
                <span className="text-zoru-ink-muted">Adjustment</span>
                <span className="text-zoru-ink tabular-nums">
                  {fmtMoney(totals.adjustment, quotation.currency)}
                </span>
              </div>
            ) : null}
            {typeof totals.roundOff === 'number' ? (
              <div className="flex justify-between">
                <span className="text-zoru-ink-muted">Round-off</span>
                <span className="text-zoru-ink tabular-nums">
                  {fmtMoney(totals.roundOff, quotation.currency)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-zoru-line pt-2">
              <span className="font-medium text-zoru-ink">Total</span>
              <span className="text-zoru-ink font-medium tabular-nums">
                {fmtMoney(totals.total, quotation.currency)}
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
                    cfValues[f.name] as Parameters<typeof CustomFieldDisplay>[0]['value']
                  }
                />
              </Field>
            ))}
          </div>
        </ZoruCard>
      ) : null}

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(quotation.createdAt || quotation.audit?.createdAt)} · Updated{' '}
        {fmtDate(quotation.updatedAt || quotation.audit?.updatedAt)}
      </div>
    </div>
  );
}
