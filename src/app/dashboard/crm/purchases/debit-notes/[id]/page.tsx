/**
 * Debit note detail — `/dashboard/crm/purchases/debit-notes/[id]`.
 *
 * Server component: hydrates the debit note via the Rust client,
 * resolves the vendor reference through `<EntityPickerChip>`, and
 * renders the line items + totals. Edit and Back actions live in the
 * header; the delete dialog is on the list page.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileMinus, Pencil, ArrowLeft } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getDebitNote } from '@/app/actions/crm/debit-notes.actions';

export const dynamic = 'force-dynamic';

function fmtMoney(value: number | undefined, currency?: string): string {
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

export default async function DebitNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { debitNote, error } = await getDebitNote(id);

  if (!debitNote) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this debit note — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/debit-notes">
              <ArrowLeft className="h-4 w-4" /> Back to Debit Notes
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const title = debitNote.dnNo || String(debitNote._id);
  const currency = debitNote.currency || 'INR';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={title}
        subtitle="Debit note"
        icon={FileMinus}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/purchases/debit-notes">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/purchases/debit-notes/${id}/edit`}>
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
            <Field label="Debit note #">{debitNote.dnNo || '—'}</Field>
            <Field label="Date">{fmtDate(debitNote.date)}</Field>
            <Field label="Vendor">
              {debitNote.vendorId ? (
                <EntityPickerChip entity="vendor" id={debitNote.vendorId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Original bill #">{debitNote.linkedBillId || '—'}</Field>
            <Field label="Reason">{debitNote.reason || '—'}</Field>
            <Field label="Status">
              {debitNote.status ? (
                <ZoruBadge variant="outline">{debitNote.status}</ZoruBadge>
              ) : (
                '—'
              )}
            </Field>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Totals
          </h3>
          <div className="flex flex-col gap-4">
            <Field label="Subtotal">{fmtMoney(debitNote.totals?.subTotal, currency)}</Field>
            <Field label="Overall discount">
              {fmtMoney(debitNote.totals?.discountOverall, currency)}
            </Field>
            <Field label="Shipping">
              {fmtMoney(debitNote.totals?.shippingCharge, currency)}
            </Field>
            <Field label="Adjustment">
              {fmtMoney(debitNote.totals?.adjustment, currency)}
            </Field>
            <Field label="Round off">{fmtMoney(debitNote.totals?.roundOff, currency)}</Field>
            <div className="flex items-baseline justify-between border-t border-zoru-line pt-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                Total
              </div>
              <div className="text-[15px] font-semibold tabular-nums text-zoru-ink">
                {fmtMoney(debitNote.totals?.total, currency)}
              </div>
            </div>
          </div>
        </ZoruCard>
      </div>

      <ZoruCard className="overflow-hidden p-0">
        <div className="border-b border-zoru-line p-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Line items
          </h3>
        </div>
        <ZoruTable>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead>Item</ZoruTableHead>
              <ZoruTableHead>Description</ZoruTableHead>
              <ZoruTableHead className="text-right">Qty</ZoruTableHead>
              <ZoruTableHead className="text-right">Unit price</ZoruTableHead>
              <ZoruTableHead className="text-right">Tax %</ZoruTableHead>
              <ZoruTableHead className="text-right">Line total</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {(debitNote.items ?? []).length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell
                  colSpan={6}
                  className="h-20 text-center text-[13px] text-zoru-ink-muted"
                >
                  No line items.
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              (debitNote.items ?? []).map((item, idx) => (
                <ZoruTableRow key={idx}>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                    {item.itemId ? (
                      <EntityPickerChip entity="item" id={item.itemId} />
                    ) : (
                      '—'
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {item.description || '—'}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right tabular-nums text-[12.5px]">
                    {item.qty}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right tabular-nums text-[12.5px]">
                    {fmtMoney(item.rate, currency)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right tabular-nums text-[12.5px]">
                    {item.taxRatePct != null ? `${item.taxRatePct}%` : '—'}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right tabular-nums text-[12.5px]">
                    {fmtMoney(item.total, currency)}
                  </ZoruTableCell>
                </ZoruTableRow>
              ))
            )}
          </ZoruTableBody>
        </ZoruTable>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Refund & notes
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Refund mode">{debitNote.refundMode || '—'}</Field>
          <Field label="Refund txn ID">{debitNote.refundTxnId || '—'}</Field>
          <Field label="Currency">{debitNote.currency || '—'}</Field>
        </div>
        {debitNote.notes ? (
          <div className="mt-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
              Notes
            </div>
            <div className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
              {debitNote.notes}
            </div>
          </div>
        ) : null}
      </ZoruCard>

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(debitNote.createdAt || debitNote.audit?.createdAt)} · Updated{' '}
        {fmtDate(debitNote.updatedAt || debitNote.audit?.updatedAt)}
      </div>
    </div>
  );
}
