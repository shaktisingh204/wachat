'use client';

/**
 * SabCRM Finance — Sales-order detail client.
 *
 * Composes the doc-surface DocDetailPage with the sales-order workflow
 * (finance-rollout spec §3.2):
 *
 *   - status transitions per the crate vocabulary (partial / fulfilled /
 *     closed / cancelled / reopen) — validated again server-side
 *     against `SABCRM_SALES_ORDER_TRANSITIONS`;
 *   - Convert menu → invoice / proforma (advance request);
 *   - per-line fulfillment card ("Delivered x/y") when the warehouse
 *     quartet is present, internal-notes card and shipping-address card
 *     in the rail;
 *   - Print → `window.print()`;
 *   - Edit → the shared DocForm drawer (number + customer locked — the
 *     Rust update DTO can't change them).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightLeft,
  FilePenLine,
  PackageCheck,
  Printer,
  ReceiptText,
  RotateCcw,
  StickyNote,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  toast,
} from '@/components/sabcrm/20ui';

import type {
  CrmSalesOrderDoc,
  CrmSalesOrderStatus,
} from '@/lib/rust-client/crm-sales-orders';
import {
  convertSabcrmSalesOrderToInvoice,
  convertSabcrmSalesOrderToProforma,
  transitionSabcrmSalesOrderStatus,
  updateSabcrmSalesOrderFull,
} from '@/app/actions/sabcrm-finance-sales-orders.actions';
import { deleteSabcrmSalesOrder } from '@/app/actions/sabcrm-finance.actions';
import {
  SABCRM_SO_DELIVERY_METHODS,
  type SabcrmSalesOrderConvertResult,
} from '@/app/actions/sabcrm-finance-sales-orders.actions.types';
import type {
  SabcrmPartyContact,
  SabcrmRelatedDocRef,
} from '@/app/actions/sabcrm-finance-invoices.actions.types';
import { isBlankDocLine } from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';

import {
  ConvertMenu,
  DocDetailPage,
  DocForm,
  formatDocDate,
  type ConvertMenuItem,
  type DocActivityEntry,
  type DocDetailLine,
} from '../../_components/doc-surface';
import {
  SALES_ORDERS_PATH,
  SALES_ORDER_FLOW,
  SALES_ORDER_STATUSES,
  partyRecordHref,
} from '../sales-order-config';
import {
  buildSalesOrderFormConfig,
  parseDeliveryMethod,
  parseExchangeRate,
  readSalesOrderExtras,
  salesOrderToFormValues,
} from '../sales-order-form';

/* ─── Helpers ─────────────────────────────────────────────────── */

function deliveryMethodLabel(value: string | undefined): string | null {
  if (!value) return null;
  return (
    SABCRM_SO_DELIVERY_METHODS.find((m) => m.value === value)?.label ?? value
  );
}

/** Address → display lines (shipping card). */
function addressLines(
  addr: CrmSalesOrderDoc['shippingAddress'],
): string[] {
  if (!addr) return [];
  const cityLine = [addr.city, addr.state, addr.pincode]
    .filter(Boolean)
    .join(', ');
  return [addr.label, addr.line1, addr.line2, cityLine, addr.country].filter(
    (s): s is string => !!s && s.trim() !== '',
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface SalesOrderDetailClientProps {
  order: CrmSalesOrderDoc | null;
  contact: SabcrmPartyContact | null;
  related: SabcrmRelatedDocRef[];
  error: string | null;
}

export function SalesOrderDetailClient({
  order,
  contact,
  related,
  error,
}: SalesOrderDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  const quotationLabel = React.useMemo(() => {
    const parent = related.find(
      (r) => r.kind === 'quotation' && r.direction === 'parent',
    );
    return parent?.label ?? null;
  }, [related]);

  // Stable identity so DocForm's open-reset effect doesn't re-fire while
  // the user is typing.
  const editSeed = React.useMemo(
    () =>
      order ? salesOrderToFormValues(order, contact, quotationLabel) : undefined,
    [order, contact, quotationLabel],
  );
  const formConfig = React.useMemo(
    () => buildSalesOrderFormConfig({ mode: 'edit' }),
    [],
  );

  if (!order) {
    return (
      <DocDetailPage
        backHref={SALES_ORDERS_PATH}
        backLabel="Sales orders"
        docNumber="Sales order"
        entitySingular="Sales order"
        statuses={SALES_ORDER_STATUSES}
        flow={SALES_ORDER_FLOW}
        status="open"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Sales order not found.'}
      />
    );
  }

  const status = (order.status ?? 'open') as CrmSalesOrderStatus;
  const total = order.totals?.total ?? 0;
  const subTotal = order.totals?.subTotal ?? total;
  const lineTotalSum = (order.items ?? []).reduce(
    (s, item) => s + (item.total ?? 0),
    0,
  );
  const taxTotal = Math.max(0, lineTotalSum - subTotal);

  const transition = (next: CrmSalesOrderStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmSalesOrderStatus(order._id, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(success);
      refresh();
    });
  };

  const runConvert = (
    label: string,
    action: (
      id: string,
    ) => Promise<ActionResult<SabcrmSalesOrderConvertResult>>,
  ): void => {
    startTransition(async () => {
      const res = await action(order._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${label} ${res.data.number} created.`);
      router.push(res.data.href);
      router.refresh();
    });
  };

  const handleDelete = (): void => {
    startDelete(async () => {
      const res = await deleteSabcrmSalesOrder(order._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${order.soNo} deleted.`);
      router.push(SALES_ORDERS_PATH);
      router.refresh();
    });
  };

  /* ---- actions bar ---- */
  const active = status === 'open' || status === 'partial';
  const canConvert = status !== 'cancelled' && status !== 'closed';
  const canEdit = active;

  const convertItems: ConvertMenuItem[] = [
    {
      key: 'to-invoice',
      label: 'Convert to invoice',
      description: 'Bills the customer for these items',
      icon: ReceiptText,
      onSelect: () => runConvert('Invoice', convertSabcrmSalesOrderToInvoice),
    },
    {
      key: 'to-proforma',
      label: 'Create proforma (advance)',
      description: 'Advance-payment request against this order',
      icon: ArrowRightLeft,
      onSelect: () =>
        runConvert('Proforma', convertSabcrmSalesOrderToProforma),
    },
  ];

  const moreItems: ConvertMenuItem[] = [];
  if (status === 'open') {
    moreItems.push({
      key: 'partial',
      label: 'Mark partially fulfilled',
      icon: Truck,
      onSelect: () =>
        transition('partial', `${order.soNo} marked partially fulfilled.`),
    });
  }
  if (active || status === 'fulfilled') {
    moreItems.push({
      key: 'close',
      label: 'Close order',
      icon: XCircle,
      onSelect: () => transition('closed', `${order.soNo} closed.`),
    });
  }
  if (status === 'cancelled') {
    moreItems.push({
      key: 'reopen',
      label: 'Reopen order',
      icon: RotateCcw,
      onSelect: () => transition('open', `${order.soNo} reopened.`),
    });
  }
  if (status === 'open') {
    moreItems.push({
      key: 'cancel',
      label: 'Cancel order',
      icon: XCircle,
      danger: true,
      group: moreItems.length > 0,
      onSelect: () => transition('cancelled', `${order.soNo} cancelled.`),
    });
  }
  moreItems.push({
    key: 'delete',
    label: 'Delete sales order',
    icon: Trash2,
    danger: true,
    group: true,
    onSelect: () => setConfirmDelete(true),
  });

  const actions = (
    <>
      {active ? (
        <Button
          variant="primary"
          iconLeft={PackageCheck}
          loading={transitioning}
          onClick={() =>
            transition('fulfilled', `${order.soNo} marked fulfilled.`)
          }
        >
          Mark fulfilled
        </Button>
      ) : null}
      {canConvert ? (
        <ConvertMenu
          label="Convert"
          heading="Create from this order"
          items={convertItems}
          disabled={transitioning}
        />
      ) : null}
      <Button
        variant="secondary"
        iconLeft={Printer}
        onClick={() => window.print()}
      >
        Print
      </Button>
      {canEdit ? (
        <Button
          variant="secondary"
          iconLeft={FilePenLine}
          onClick={() => setEditOpen(true)}
        >
          Edit
        </Button>
      ) : null}
      <ConvertMenu label="More" items={moreItems} disabled={transitioning} />
    </>
  );

  /* ---- paper data ---- */
  const lines: DocDetailLine[] = (order.items ?? []).map((item) => ({
    description: item.description ?? '',
    hsnSac: item.hsnSac,
    qty: item.qty,
    unit: item.unit,
    rate: item.rate,
    discountPct: item.discountPct,
    taxRatePct: item.taxRatePct,
    total: item.total,
  }));

  const methodLabel = deliveryMethodLabel(order.deliveryMethod);
  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Order date', value: formatDocDate(order.date) },
    ...(order.poNo ? [{ label: 'Customer PO', value: order.poNo }] : []),
    ...(order.poDate
      ? [{ label: 'PO date', value: formatDocDate(order.poDate) }]
      : []),
    ...(order.expectedShipmentDate
      ? [
          {
            label: 'Expected shipment',
            value: formatDocDate(order.expectedShipmentDate),
          },
        ]
      : []),
    ...(methodLabel ? [{ label: 'Delivery method', value: methodLabel }] : []),
    ...(order.paymentTerms
      ? [{ label: 'Payment terms', value: order.paymentTerms }]
      : []),
    { label: 'Currency', value: order.currency },
    ...(order.exchangeRate
      ? [{ label: 'Exchange rate', value: String(order.exchangeRate) }]
      : []),
  ];

  /* ---- rail extras ---- */
  const fulfillmentLines = (order.items ?? []).filter(
    (item) =>
      item.qtyPending !== undefined ||
      item.qtyDelivered !== undefined ||
      item.qtyInvoiced !== undefined,
  );
  const shipLines = addressLines(order.shippingAddress);

  const railExtra = (
    <>
      {fulfillmentLines.length > 0 ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-1.5">
                <Truck size={14} aria-hidden="true" /> Fulfillment
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="fdoc-rail-list">
              {fulfillmentLines.map((item, i) => (
                <li key={i} className="fdoc-rail-item">
                  <span>
                    {item.description || 'Line item'}
                    <span className="fdoc-rail-item__kind">
                      Delivered {item.qtyDelivered ?? 0}/{item.qty}
                      {item.qtyInvoiced !== undefined
                        ? ` · invoiced ${item.qtyInvoiced}`
                        : ''}
                      {item.qtyPending !== undefined
                        ? ` · pending ${item.qtyPending}`
                        : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
      {order.internalNotes ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-1.5">
                <StickyNote size={14} aria-hidden="true" /> Internal notes
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <span className="fdoc-cell-sub">{order.internalNotes}</span>
          </CardBody>
        </Card>
      ) : null}
      {shipLines.length > 0 ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>Shipping address</CardTitle>
          </CardHeader>
          <CardBody>
            {shipLines.map((line, i) => (
              <span key={i} className="fdoc-cell-sub">
                {line}
              </span>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </>
  );

  /* ---- activity ---- */
  const createdAt = order.audit?.createdAt ?? order.createdAt;
  const activity: DocActivityEntry[] = [];
  if (createdAt) {
    activity.push({
      id: 'created',
      icon: FilePenLine,
      title: 'Sales order created',
      at: createdAt,
    });
  }
  for (const ref of related.filter(
    (r) => r.kind === 'invoice' && r.direction === 'child',
  )) {
    activity.push({
      id: `invoice-${ref.id}`,
      icon: ReceiptText,
      title: `Invoiced as ${ref.label}`,
      meta: ref.status,
      at: ref.date,
    });
  }
  activity.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));

  return (
    <>
      <DocDetailPage
        backHref={SALES_ORDERS_PATH}
        backLabel="Sales orders"
        docNumber={order.soNo}
        entitySingular="Sales order"
        statuses={SALES_ORDER_STATUSES}
        flow={SALES_ORDER_FLOW}
        status={status}
        actions={actions}
        party={
          contact
            ? {
                label: contact.label,
                href: partyRecordHref(contact.objectSlug, contact.id),
                meta: contact.email,
                addressLines: contact.addressLines,
              }
            : null
        }
        meta={meta}
        currency={order.currency}
        lines={lines}
        totals={{
          subTotal,
          taxTotal,
          discountOverall: order.totals?.discountOverall,
          shippingCharge: order.totals?.shippingCharge,
          adjustment: order.totals?.adjustment,
          roundOff: order.totals?.roundOff,
          total,
        }}
        notes={order.customerNotes}
        related={related}
        attachments={order.attachments}
        activity={activity}
        railExtra={railExtra}
      />

      <DocForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialValues={editSeed}
        config={formConfig}
        onSubmit={async (values) => {
          // The Rust update DTO can't change number/customer — refuse
          // loudly instead of silently reverting (kit has no field lock).
          if (values.number.trim() !== order.soNo) {
            return {
              ok: false,
              error:
                'The order number is locked after creation — change it back to save.',
            };
          }
          if ((values.partyId ?? '') !== order.clientId) {
            return {
              ok: false,
              error:
                'The customer is locked after creation — change it back to save.',
            };
          }
          if (values.termsAndConditions.trim()) {
            return {
              ok: false,
              error:
                "Sales orders don't store terms & conditions yet — clear that field (use Customer notes instead).",
            };
          }
          if (values.attachments.length > 0) {
            return {
              ok: false,
              error:
                "Sales orders don't store attachments yet — remove them to save.",
            };
          }
          const extras = readSalesOrderExtras(values);
          const res = await updateSabcrmSalesOrderFull(order._id, {
            date: values.date,
            quotationRef: extras.quotationRef || undefined,
            poNo: extras.poNo,
            poDate: extras.poDate || undefined,
            expectedShipmentDate: extras.expectedShipmentDate || undefined,
            deliveryMethod: parseDeliveryMethod(extras.deliveryMethod),
            paymentTerms: values.paymentTerms,
            currency: values.currency,
            exchangeRate: parseExchangeRate(extras.exchangeRate),
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            totalsModifiers: values.modifiers ?? {},
            customerNotes: values.customerNotes,
            internalNotes: extras.internalNotes,
          });
          if (!res.ok) return res;
          toast.success(`${res.data.soNo} updated.`);
          refresh();
          return { ok: true };
        }}
      />

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(next) => {
          if (!next && !deleting) setConfirmDelete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {order.soNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the sales order from this workspace.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete sales order
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
