/**
 * Purchase order detail — `/dashboard/crm/purchases/orders/[id]`.
 *
 * Server component: hydrates the PO via the Rust client, resolves the
 * vendor / warehouse / branch chips through `<EntityPickerChip>`, and
 * renders the line-item table and totals. Edit and Back actions live
 * on this page; the delete dialog is on the list page.
 *
 * Purchase Orders skip the custom-field panel — `'purchaseOrder'` is
 * not a registered `WsCustomFieldBelongsTo` key.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShoppingBag, Pencil, ArrowLeft } from 'lucide-react';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getPurchaseOrder } from '@/app/actions/crm/purchase-orders.actions';

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

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { order, error } = await getPurchaseOrder(id);

  if (!order) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this purchase order — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/orders">
              <ArrowLeft className="h-4 w-4" /> Back to Purchase Orders
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const currency = order.currency || 'INR';
  const items = order.items ?? [];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={order.poNo || 'Purchase order'}
        subtitle={`PO dated ${fmtDate(order.date)}`}
        icon={ShoppingBag}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/purchases/orders">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/purchases/orders/${id}/edit`}>
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
            <Field label="PO number">{order.poNo || '—'}</Field>
            <Field label="Vendor">
              {order.vendorId ? (
                <EntityPickerChip entity="vendor" id={order.vendorId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="PO date">{fmtDate(order.date)}</Field>
            <Field label="Expected delivery">
              {fmtDate(order.expectedDelivery)}
            </Field>
            <Field label="Ship-to warehouse">
              {order.shipToWarehouseId ? (
                <EntityPickerChip
                  entity="warehouse"
                  id={order.shipToWarehouseId}
                />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Billing branch">
              {order.billingBranchId ? (
                <EntityPickerChip
                  entity="branch"
                  id={order.billingBranchId}
                />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Payment terms">{order.paymentTerms || '—'}</Field>
            <Field label="Currency">{currency}</Field>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Status
          </h3>
          <div className="flex flex-col gap-4">
            <Field label="Workflow">
              {order.status ? (
                <ZoruBadge variant="outline">
                  {statusLabel(typeof order.status === 'string' ? order.status : undefined)}
                </ZoruBadge>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Approved by">
              {order.approval?.approvedBy ? (
                <EntityPickerChip
                  entity="user"
                  id={order.approval.approvedBy}
                />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Approved at">
              {fmtDate(order.approval?.approvedAt)}
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
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">HSN/SAC</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 text-right font-medium">Rate</th>
                <th className="px-3 py-2 text-right font-medium">Disc %</th>
                <th className="px-3 py-2 text-right font-medium">Tax %</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="h-20 px-3 text-center text-zoru-ink-muted"
                  >
                    No line items.
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-zoru-line/60 text-zoru-ink"
                  >
                    <td className="px-3 py-2">{it.description || '—'}</td>
                    <td className="px-3 py-2 text-zoru-ink-muted">
                      {it.hsnSac || '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {it.qty ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-zoru-ink-muted">
                      {it.unit || '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtMoney(it.rate, currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zoru-ink-muted">
                      {typeof it.discountPct === 'number'
                        ? `${it.discountPct}%`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zoru-ink-muted">
                      {typeof it.taxRatePct === 'number'
                        ? `${it.taxRatePct}%`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {fmtMoney(it.total, currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="grid gap-4 border-t border-zoru-line p-4 md:grid-cols-2">
          <div />
          <div className="flex flex-col gap-1 text-[13px]">
            <div className="flex justify-between text-zoru-ink-muted">
              <span>Sub-total</span>
              <span className="tabular-nums">
                {fmtMoney(order.totals?.subTotal, currency)}
              </span>
            </div>
            {typeof order.totals?.discountOverall === 'number' ? (
              <div className="flex justify-between text-zoru-ink-muted">
                <span>Discount</span>
                <span className="tabular-nums">
                  {fmtMoney(-order.totals.discountOverall, currency)}
                </span>
              </div>
            ) : null}
            {typeof order.totals?.shippingCharge === 'number' ? (
              <div className="flex justify-between text-zoru-ink-muted">
                <span>Shipping</span>
                <span className="tabular-nums">
                  {fmtMoney(order.totals.shippingCharge, currency)}
                </span>
              </div>
            ) : null}
            {typeof order.totals?.adjustment === 'number' ? (
              <div className="flex justify-between text-zoru-ink-muted">
                <span>Adjustment</span>
                <span className="tabular-nums">
                  {fmtMoney(order.totals.adjustment, currency)}
                </span>
              </div>
            ) : null}
            {typeof order.totals?.roundOff === 'number' ? (
              <div className="flex justify-between text-zoru-ink-muted">
                <span>Round off</span>
                <span className="tabular-nums">
                  {fmtMoney(order.totals.roundOff, currency)}
                </span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-zoru-line pt-2 text-[14px] font-semibold text-zoru-ink">
              <span>Grand total</span>
              <span className="tabular-nums">
                {fmtMoney(order.totals?.total, currency)}
              </span>
            </div>
          </div>
        </div>
      </ZoruCard>

      {order.termsAndConditions || order.notes ? (
        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Terms &amp; notes
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Terms &amp; conditions">
              {order.termsAndConditions || '—'}
            </Field>
            <Field label="Notes">{order.notes || '—'}</Field>
          </div>
        </ZoruCard>
      ) : null}

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(order.createdAt || order.audit?.createdAt)} · Updated{' '}
        {fmtDate(order.updatedAt || order.audit?.updatedAt)}
      </div>
    </div>
  );
}
