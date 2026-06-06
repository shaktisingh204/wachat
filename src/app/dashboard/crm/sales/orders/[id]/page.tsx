import { Button, Card } from '@/components/sabcrm/20ui';
import { notFound } from 'next/navigation';
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
  ArrowLeft,
} from 'lucide-react';

import Link from 'next/link';
import { Suspense } from 'react';
import * as React from 'react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { LineageRail } from '@/components/crm/lineage-rail';
import { RelatedRail } from '@/components/crm/RelatedRail';
import { SplitBackorderedButton } from '../_components/split-backordered-button';

import {
  getCrmSalesOrderRelatedCounts,
  getSalesOrder,
} from '@/app/actions/crm/sales-orders.actions';
import { SalesOrdersDetailFulfillment } from '../_components/sales-orders-detail-fulfillment';
import { SalesOrderInlineStatus } from '../_components/sales-orders-detail-status';
import type { LineageRef } from '@/lib/definitions';
import { fmtINR, fmtDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Asynchronous Sub-components for Suspense Blocks
 * ──────────────────────────────────────────────────────────────────── */

async function RelatedRailSection({ id }: { id: string }) {
  const relatedCounts = await getCrmSalesOrderRelatedCounts(id);
  return (
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
          <p className="text-[14px] text-[var(--st-text)]">
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
        <span className="mx-1 h-4 w-px bg-[var(--st-border)]" />
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
          className="text-[var(--st-danger)]"
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
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
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
                    className="text-[var(--st-text)] hover:underline"
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
            <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              Line items
            </h3>
            <SalesOrdersDetailFulfillment items={items} currency={currency} />
          </Card>

          {ship && (ship.line1 || ship.city) ? (
            <Card className="p-6">
              <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Shipping address
              </h3>
              <div className="text-[13px] text-[var(--st-text)]">
                {[ship.line1, ship.line2].filter(Boolean).join(', ')}
                <div className="text-[var(--st-text-secondary)]">
                  {[ship.city, ship.state, ship.postalCode].filter(Boolean).join(', ')}
                </div>
                <div className="text-[var(--st-text-secondary)]">{ship.country}</div>
              </div>
            </Card>
          ) : null}

          {order.customerNotes || order.internalNotes ? (
            <Card className="p-6">
              <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
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
            <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              Totals
            </h3>
            <div className="flex flex-col gap-3 text-[13px]">
              <div className="flex justify-between text-[var(--st-text-secondary)]">
                <span>Sub-total</span>
                <span className="tabular-nums text-[var(--st-text)] font-mono">
                  {fmtINR(order.totals?.subTotal, currency)}
                </span>
              </div>
              {order.totals?.shippingCharge != null ? (
                <div className="flex justify-between text-[var(--st-text-secondary)]">
                  <span>Shipping</span>
                  <span className="tabular-nums text-[var(--st-text)] font-mono">
                    {fmtINR(order.totals.shippingCharge, currency)}
                  </span>
                </div>
              ) : null}
              {order.totals?.discountOverall != null ? (
                <div className="flex justify-between text-[var(--st-text-secondary)]">
                  <span>Discount</span>
                  <span className="tabular-nums text-[var(--st-text)] font-mono">
                    − {fmtINR(order.totals.discountOverall, currency)}
                  </span>
                </div>
              ) : null}
              {order.totals?.adjustment != null ? (
                <div className="flex justify-between text-[var(--st-text-secondary)]">
                  <span>Adjustment</span>
                  <span className="tabular-nums text-[var(--st-text)] font-mono">
                    {fmtINR(order.totals.adjustment, currency)}
                  </span>
                </div>
              ) : null}
              <div className="mt-2 flex justify-between border-t border-[var(--st-border)] pt-2 text-[14px] font-semibold text-[var(--st-text)]">
                <span>Total ({currency})</span>
                <span className="tabular-nums font-mono">
                  {fmtINR(order.totals?.total, currency)}
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

          <Suspense fallback={
            <div className="animate-pulse space-y-4">
              <div className="h-32 bg-[var(--st-bg-muted)] rounded-lg dark:bg-[var(--st-text)]/40"></div>
            </div>
          }>
            <RelatedRailSection id={id} />
          </Suspense>

          <Card className="p-4 text-[11.5px] text-[var(--st-text-secondary)]">
            Created {fmtDate(order.createdAt || order.audit?.createdAt)}
            <br />
            Updated {fmtDate(order.updatedAt || order.audit?.updatedAt)}
          </Card>
        </div>
      </div>

      <Suspense fallback={
        <div className="animate-pulse mt-8 space-y-4">
          <div className="h-6 bg-[var(--st-bg-muted)] rounded w-1/4 dark:bg-[var(--st-text)]/40"></div>
          <div className="space-y-3">
            <div className="h-4 bg-[var(--st-bg-muted)] rounded dark:bg-[var(--st-text)]/40"></div>
            <div className="h-4 bg-[var(--st-bg-muted)] rounded w-5/6 dark:bg-[var(--st-text)]/40"></div>
          </div>
        </div>
      }>
        <EntityAuditTimeline entityKind="salesOrder" entityId={id} />
      </Suspense>
    </EntityDetailShell>
  );
}
