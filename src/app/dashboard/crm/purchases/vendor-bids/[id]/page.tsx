/**
 * Vendor bid detail — `/dashboard/crm/purchases/vendor-bids/[id]`.
 *
 * Server component: hydrates the bid via the Rust client, resolves
 * the vendor chip through `<EntityPickerChip>`, and renders the
 * line-item table and totals. Edit and Back actions live on this
 * page; the delete dialog is on the list page.
 *
 * Vendor Bids skip the custom-field panel — `'vendorBid'` is not a
 * registered `WsCustomFieldBelongsTo` key.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Gavel, Pencil, ArrowLeft } from 'lucide-react';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getVendorBid } from '@/app/actions/crm/vendor-bids.actions';

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
    return `${currency || 'INR'} ${value.toFixed(2)}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function statusLabel(status?: string): string {
  if (!status) return '—';
  return status
    .split('_')
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ');
}

function Field({
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

export default async function VendorBidDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { bid, error } = await getVendorBid(id);

  if (!bid) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this vendor bid — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/vendor-bids">
              <ArrowLeft className="h-4 w-4" /> Back to Vendor Bids
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const currency = bid.currency || 'INR';
  const items = bid.items ?? [];
  const title = bid.vendorName || 'Vendor bid';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={title}
        subtitle={`Bid submitted ${fmtDate(bid.submittedAt || bid.createdAt)}`}
        icon={Gavel}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/purchases/vendor-bids">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/purchases/vendor-bids/${id}/edit`}>
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
            <Field label="Vendor">
              {bid.vendorId ? (
                <EntityPickerChip entity="vendor" id={bid.vendorId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Vendor display name">{bid.vendorName || '—'}</Field>
            <Field label="Related RFQ id">
              {bid.rfqId ? (
                <code className="font-mono text-[12px]">{bid.rfqId}</code>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Currency">{currency}</Field>
            <Field label="Submitted at">{fmtDate(bid.submittedAt)}</Field>
            <Field label="Status">
              {bid.status ? (
                <ZoruBadge variant="outline">
                  {statusLabel(
                    typeof bid.status === 'string' ? bid.status : undefined,
                  )}
                </ZoruBadge>
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
            <Field label="Sub-total">
              {fmtMoney(bid.totals?.subTotal, currency)}
            </Field>
            <Field label="Grand total">
              <span className="text-[14px] font-semibold">
                {fmtMoney(bid.totals?.total, currency)}
              </span>
            </Field>
          </div>
        </ZoruCard>
      </div>

      <ZoruCard className="overflow-hidden p-0">
        <div className="border-b border-zoru-line p-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Line items
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-zoru-line bg-zoru-surface-2 text-left text-zoru-ink-muted">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Unit price</th>
                <th className="px-3 py-2 text-right font-medium">Lead (days)</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="h-20 px-3 text-center text-zoru-ink-muted"
                  >
                    No line items.
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => {
                  const qty = Number(it.qty) || 0;
                  const rate = Number(it.rate) || 0;
                  const total = qty * rate;
                  return (
                    <tr
                      key={idx}
                      className="border-b border-zoru-line/60 text-zoru-ink"
                    >
                      <td className="px-3 py-2">
                        {it.itemId ? (
                          <EntityPickerChip entity="item" id={it.itemId} />
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {qty}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtMoney(rate, currency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zoru-ink-muted">
                        {typeof it.leadTimeDays === 'number'
                          ? it.leadTimeDays
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-zoru-ink-muted">
                        {it.notes || '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {fmtMoney(total, currency)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </ZoruCard>

      {bid.terms ? (
        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Terms
          </h3>
          <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
            {bid.terms}
          </p>
        </ZoruCard>
      ) : null}

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(bid.createdAt || bid.audit?.createdAt)} · Updated{' '}
        {fmtDate(bid.updatedAt || bid.audit?.updatedAt)}
      </div>
    </div>
  );
}
