import { Button, Card } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import {
  Pencil,
  Truck,
  Receipt,
  Mail,
  Printer,
  Share2,
  Copy,
  Archive,
  Activity,
  Trash2,
  } from 'lucide-react';

/**
 * Sales Order detail — `/dashboard/crm/sales/orders/[id]`.
 *
 * §1D detail surface. Renders:
 *   - Header card (status pill via `statusToTone`, eyebrow, action group
 *     with 10 buttons: Edit · Convert→DC · Convert→Invoice · Email ·
 *     Print · Share · Duplicate · Archive · Activity · Delete)
 *   - Overview card with every header field
 *   - Line-items table with per-line fulfillment progress
 *     (delivered/invoiced) via `<SalesOrdersDetailFulfillment>`
 *   - Totals card (sub-total, shipping, discount, adjustment, total)
 *   - Notes / shipping address breakouts
 *   - Right rail: LineageRail (sales chain — Lead → Deal → Quotation →
 *     Sales Order [current] → Delivery Challan → Invoice → Receipt)
 *
 * Sales orders skip worksuite custom fields.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { LineageRail } from '@/components/crm/lineage-rail';
import { RelatedRail } from '@/components/crm/RelatedRail';
import { SplitBackorderedButton } from '../_components/split-backordered-button';

// `<StatusPill>` is rendered inside `<SalesOrderInlineStatus>` — no
// direct import needed here anymore.
import {
  getCrmSalesOrderRelatedCounts,
  getSalesOrder,
} from '@/app/actions/crm/sales-orders.actions';
import { SalesOrdersDetailFulfillment } from '../_components/sales-orders-detail-fulfillment';
import { SalesOrderInlineStatus } from '../_components/sales-orders-detail-status';
import type { LineageRef } from '@/lib/definitions';

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
  const [{ order, error }, relatedCounts] = await Promise.all([
    getSalesOrder(id),
    getCrmSalesOrderRelatedCounts(id),
  ]);

  if (!order) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this sales order — {error}
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/crm/sales/orders">
              <ArrowLeft className="h-4 w-4" /> Back to Sales Orders
            </Link>
          </Button>
        </div>
      );
    }
    notFound();
  }

  const currency = order.currency || 'INR';
  const items = order.items ?? [];
  const ship = (order.shippingAddress as
    | {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      }
    | undefined) ?? {};
  const lineage: LineageRef[] = (order.lineage as LineageRef[] | undefined) ?? [];
  const agentId = order.assignment?.assignedTo;

  return (
    <EntityDetailShell
      eyebrow="SALES ORDER"
      title={order.soNo || 'Sales order'}
      back={{ href: '/dashboard/crm/sales/orders', label: 'Sales Orders' }}
      actions={
        <Button asChild>
          <Link href={`/dashboard/crm/sales/orders/${id}/edit`}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        </Button>
      }
    >

      {/* Action group ─────────────────────────────────────────────── */}
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <Button variant="default" size="sm" asChild>
          <Link
            href={`/dashboard/crm/sales/delivery/new?fromKind=salesOrder&fromId=${id}`}
          >
            <Truck className="h-3.5 w-3.5" /> Convert to delivery challan
          </Link>
        </Button>
        <SplitBackorderedButton salesOrderId={id} />
        <Button variant="default" size="sm" asChild>
          <Link
            href={`/dashboard/crm/sales/invoices/new?fromKind=salesOrder&fromId=${id}`}
          >
            <Receipt className="h-3.5 w-3.5" /> Convert to invoice
          </Link>
        </Button>
        <span className="mx-1 h-4 w-px bg-zoru-line" />
        <Button variant="outline" size="sm" disabled title="Email — coming soon">
          <Mail className="h-3.5 w-3.5" /> Email
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link
            href={`/dashboard/crm/sales/orders/${id}?print=1`}
            target="_blank"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </Link>
        </Button>
        <Button variant="outline" size="sm" disabled title="Share link — coming soon">
          <Share2 className="h-3.5 w-3.5" /> Share
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link
            href={`/dashboard/crm/sales/orders/new?fromKind=salesOrder&fromId=${id}`}
          >
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </Link>
        </Button>
        <Button variant="outline" size="sm" disabled title="Archive — coming soon">
          <Archive className="h-3.5 w-3.5" /> Archive
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/crm/sales/orders/${id}/activity`}>
            <Activity className="h-3.5 w-3.5" /> Activity
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled
          className="text-zoru-danger-ink"
          title="Delete — use the list page's row action"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </Card>

      {/* Header + totals + right rail ─────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Header
              </h3>
              {order.status ? (
                <SalesOrderInlineStatus id={id} status={order.status} />
              ) : null}
            </div>
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
              <Field label="Quotation ref">
                {order.quotationRef ? (
                  <Link
                    href={`/dashboard/crm/sales/quotations/${order.quotationRef}`}
                    className="text-zoru-primary hover:underline"
                  >
                    {order.quotationRef.slice(-8)}
                  </Link>
                ) : (
                  '—'
                )}
              </Field>
              <Field label="Customer PO #">{order.poNo || '—'}</Field>
              <Field label="Customer PO date">{fmtDate(order.poDate)}</Field>
              <Field label="Delivery method">
                {order.deliveryMethod
                  ? order.deliveryMethod.replace(/_/g, ' ')
                  : '—'}
              </Field>
              <Field label="Payment terms">{order.paymentTerms || '—'}</Field>
              <Field label="Currency">{currency}</Field>
              <Field label="Sales agent">
                {agentId ? (
                  <EntityPickerChip entity="user" id={agentId} />
                ) : (
                  '—'
                )}
              </Field>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Line items
            </h3>
            <SalesOrdersDetailFulfillment items={items} currency={currency} />
          </Card>

          {ship && (ship.line1 || ship.city) ? (
            <Card className="p-6">
              <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Shipping address
              </h3>
              <div className="text-[13px] text-zoru-ink">
                {[ship.line1, ship.line2].filter(Boolean).join(', ')}
                <div className="text-zoru-ink-muted">
                  {[ship.city, ship.state, ship.postalCode].filter(Boolean).join(', ')}
                </div>
                <div className="text-zoru-ink-muted">{ship.country}</div>
              </div>
            </Card>
          ) : null}

          {order.customerNotes || order.internalNotes ? (
            <Card className="p-6">
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
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <Card className="p-6">
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
          </Card>

          <LineageRail
            current={{
              kind: 'salesOrder',
              id,
              no: order.soNo,
              status: order.status,
            }}
            lineage={lineage}
          />

          <RelatedRail
            items={[
              {
                label: 'Delivery challans',
                count: relatedCounts.deliveryChallans,
                icon: <Truck className="h-3.5 w-3.5" />,
                href: `/dashboard/crm/sales/delivery-challans?salesOrderId=${id}`,
              },
              {
                label: 'Invoices',
                count: relatedCounts.invoices,
                icon: <Receipt className="h-3.5 w-3.5" />,
                href: `/dashboard/crm/sales/invoices?salesOrderId=${id}`,
              },
            ]}
          />

          <Card className="p-4 text-[11.5px] text-zoru-ink-muted">
            Created {fmtDate(order.createdAt || order.audit?.createdAt)}
            <br />
            Updated {fmtDate(order.updatedAt || order.audit?.updatedAt)}
          </Card>
        </div>
      </div>

      <EntityAuditTimeline entityKind="salesOrder" entityId={id} />
    </EntityDetailShell>
  );
}
