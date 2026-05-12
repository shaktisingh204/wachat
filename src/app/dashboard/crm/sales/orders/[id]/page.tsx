/**
 * Sales Order detail — `/dashboard/crm/sales/orders/[id]`.
 *
 * Server component: hydrates the order via the Rust client and resolves
 * the customer reference through `<EntityPickerChip>`. Edit and Delete
 * actions live on this page; the delete dialog is on the list page.
 *
 * Sales orders skip the worksuite custom-fields panel entirely.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShoppingCart, Pencil, ArrowLeft } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruBadge,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getSalesOrder } from '@/app/actions/crm/sales-orders.actions';
import type { CrmSalesOrderStatus } from '@/lib/rust-client/crm-sales-orders';

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
    return `${currency || 'INR'} ${value.toFixed(2)}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

const STATUS_VARIANT: Record<
  CrmSalesOrderStatus,
  'success' | 'warning' | 'danger' | 'ghost'
> = {
  open: 'warning',
  partial: 'warning',
  fulfilled: 'success',
  closed: 'ghost',
  cancelled: 'danger',
};

function statusVariant(s?: string): 'success' | 'warning' | 'danger' | 'ghost' {
  const key = (s ?? '').toLowerCase() as CrmSalesOrderStatus;
  return STATUS_VARIANT[key] ?? 'ghost';
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

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { order, error } = await getSalesOrder(id);

  if (!order) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this sales order — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/sales/orders">
              <ArrowLeft className="h-4 w-4" /> Back to Sales Orders
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
        title={order.soNo || 'Sales order'}
        subtitle={`Sales order · ${fmtDate(order.date)}`}
        icon={ShoppingCart}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/sales/orders">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/sales/orders/${id}/edit`}>
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
            <Field label="Order #">{order.soNo || '—'}</Field>
            <Field label="Customer">
              {order.clientId ? (
                <EntityPickerChip entity="client" id={order.clientId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Order date">{fmtDate(order.date)}</Field>
            <Field label="Expected shipment">
              {fmtDate(order.expectedShipmentDate)}
            </Field>
            <Field label="Customer PO #">{order.poNo || '—'}</Field>
            <Field label="Customer PO date">{fmtDate(order.poDate)}</Field>
            <Field label="Currency">{currency}</Field>
            <Field label="Payment terms">{order.paymentTerms || '—'}</Field>
            <Field label="Status">
              {order.status ? (
                <ZoruBadge variant={statusVariant(order.status)}>
                  {order.status}
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
          <div className="flex flex-col gap-3 text-[13px]">
            <div className="flex justify-between text-zoru-ink-muted">
              <span>Sub-total</span>
              <span className="tabular-nums text-zoru-ink">
                {fmtMoney(order.totals?.subTotal, currency)}
              </span>
            </div>
            {order.totals?.shippingCharge != null ? (
              <div className="flex justify-between text-zoru-ink-muted">
                <span>Shipping</span>
                <span className="tabular-nums text-zoru-ink">
                  {fmtMoney(order.totals.shippingCharge, currency)}
                </span>
              </div>
            ) : null}
            {order.totals?.discountOverall != null ? (
              <div className="flex justify-between text-zoru-ink-muted">
                <span>Discount</span>
                <span className="tabular-nums text-zoru-ink">
                  − {fmtMoney(order.totals.discountOverall, currency)}
                </span>
              </div>
            ) : null}
            {order.totals?.adjustment != null ? (
              <div className="flex justify-between text-zoru-ink-muted">
                <span>Adjustment</span>
                <span className="tabular-nums text-zoru-ink">
                  {fmtMoney(order.totals.adjustment, currency)}
                </span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-zoru-line pt-2 text-[14px] font-semibold text-zoru-ink">
              <span>Total ({currency})</span>
              <span className="tabular-nums">
                {fmtMoney(order.totals?.total, currency)}
              </span>
            </div>
          </div>
        </ZoruCard>
      </div>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Line items
        </h3>
        <div className="overflow-x-auto rounded-md border border-zoru-line">
          <table className="w-full text-[13px]">
            <thead className="bg-zoru-surface-2 text-left text-zoru-ink-muted">
              <tr>
                <th className="p-2.5 font-medium">#</th>
                <th className="p-2.5 font-medium">Item</th>
                <th className="p-2.5 font-medium">Description</th>
                <th className="p-2.5 text-right font-medium">Qty</th>
                <th className="p-2.5 text-right font-medium">Unit price</th>
                <th className="p-2.5 text-right font-medium">Tax %</th>
                <th className="p-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr className="border-t border-zoru-line">
                  <td
                    colSpan={7}
                    className="p-4 text-center text-[12.5px] text-zoru-ink-muted"
                  >
                    No line items.
                  </td>
                </tr>
              ) : (
                items.map((li, idx) => (
                  <tr key={idx} className="border-t border-zoru-line align-top">
                    <td className="p-2.5 text-zoru-ink-muted">{idx + 1}</td>
                    <td className="p-2.5">
                      {li.itemId ? (
                        <EntityPickerChip entity="item" id={li.itemId} />
                      ) : (
                        <span className="text-zoru-ink-muted">—</span>
                      )}
                    </td>
                    <td className="p-2.5 text-zoru-ink">
                      {li.description || '—'}
                    </td>
                    <td className="p-2.5 text-right tabular-nums">
                      {li.qty}
                      {li.unit ? (
                        <span className="ml-1 text-[11.5px] text-zoru-ink-muted">
                          {li.unit}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-2.5 text-right tabular-nums">
                      {fmtMoney(li.rate, currency)}
                    </td>
                    <td className="p-2.5 text-right tabular-nums text-zoru-ink-muted">
                      {li.taxRatePct != null ? `${li.taxRatePct}%` : '—'}
                    </td>
                    <td className="p-2.5 text-right tabular-nums text-zoru-ink">
                      {fmtMoney(li.total, currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ZoruCard>

      {order.customerNotes || order.internalNotes ? (
        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Notes
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {order.customerNotes ? (
              <Field label="Customer notes">{order.customerNotes}</Field>
            ) : null}
            {order.internalNotes ? (
              <Field label="Internal notes">{order.internalNotes}</Field>
            ) : null}
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
