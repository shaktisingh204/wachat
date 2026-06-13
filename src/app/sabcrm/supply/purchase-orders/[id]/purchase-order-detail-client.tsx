'use client';

/**
 * SabCRM Supply — Purchase order detail client (rollout WI-5 flagship).
 *
 * Composes the doc-surface DocDetailPage with the PO's workflow:
 *
 *   - StatusFlow rail over the 8-status vocabulary; transitions
 *     (request approval / approve / send / receive / close / cancel /
 *     reopen) validated again server-side against SABCRM_PO_TRANSITIONS;
 *   - ConvertMenu lineage — "Receive → GRN" routes to the GRN form
 *     prefilled (`?fromPo=<id>`) so receiving stays a reviewed form,
 *     and "Create bill" composes a finance vendor bill server-side;
 *   - Edit → the same DocForm drawer the list uses, seeded from the doc;
 *   - Print → window.print() (kit `@media print` keeps the paper only);
 *   - related-documents rail (RFQ/bid parents + GRN/bill children) and
 *     an activity feed (created / received).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ClipboardCheck,
  FilePenLine,
  FileText,
  PackageCheck,
  Printer,
  RotateCcw,
  Send,
  Trash2,
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
  toast,
} from '@/components/sabcrm/20ui';

import type { CrmPurchaseOrderDoc } from '@/lib/rust-client/sabcrm-supply';
import {
  convertSabcrmSupplyPurchaseOrderToBill,
  updateSabcrmSupplyPurchaseOrderFull,
} from '@/app/actions/sabcrm-supply-purchase-orders.actions';
import { transitionSabcrmSupplyPurchaseOrderStatus } from '@/app/actions/sabcrm-supply-docs.actions';
import { deleteSabcrmSupplyPurchaseOrder } from '@/app/actions/sabcrm-supply.actions';
import type { SabcrmPoStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import {
  SABCRM_PO_TRANSITIONS,
} from '@/app/actions/sabcrm-supply-docs.actions.types';
import type { SabcrmRelatedDocRef } from '@/app/actions/sabcrm-finance-invoices.actions.types';
import { isBlankDocLine } from '@/lib/sabcrm/finance-doc-math';

import {
  ConvertMenu,
  DocDetailPage,
  DocForm,
  formatDocDate,
  type ConvertMenuItem,
  type DocActivityEntry,
  type DocDetailLine,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  PO_FLOW,
  PO_STATUSES,
  PURCHASE_ORDERS_PATH,
} from '../purchase-order-config';
import {
  buildPurchaseOrderFormConfig,
  purchaseOrderToFormValues,
  readPoExtras,
} from '../purchase-order-form';

const GRN_PATH = '/sabcrm/supply/grn';

export interface PurchaseOrderDetailClientProps {
  po: CrmPurchaseOrderDoc | null;
  vendorLabel: string | null;
  warehouseLabel: string | null;
  related: SabcrmRelatedDocRef[];
  error: string | null;
}

export function PurchaseOrderDetailClient({
  po,
  vendorLabel,
  warehouseLabel,
  related,
  error,
}: PurchaseOrderDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();
  const [converting, startConvert] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  const editSeed = React.useMemo(
    () =>
      po ? purchaseOrderToFormValues(po, vendorLabel, warehouseLabel) : undefined,
    [po, vendorLabel, warehouseLabel],
  );
  const editConfig = React.useMemo(
    () => buildPurchaseOrderFormConfig({ withIssue: false }),
    [],
  );

  if (!po) {
    return (
      <DocDetailPage
        backHref={PURCHASE_ORDERS_PATH}
        backLabel="Purchase orders"
        docNumber="Purchase order"
        entitySingular="Purchase order"
        statuses={PO_STATUSES}
        flow={PO_FLOW as unknown as string[]}
        status="draft"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Purchase order not found.'}
      />
    );
  }

  const status = (po.status ?? 'draft') as SabcrmPoStatus;
  const allowed = SABCRM_PO_TRANSITIONS[status] ?? [];
  const currency = po.currency || 'INR';

  const transition = (next: SabcrmPoStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmSupplyPurchaseOrderStatus(po._id, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(success);
      refresh();
    });
  };

  const handleDelete = (): void => {
    startDelete(async () => {
      const res = await deleteSabcrmSupplyPurchaseOrder(po._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${po.poNo} deleted.`);
      router.push(PURCHASE_ORDERS_PATH);
      router.refresh();
    });
  };

  const handleConvertToBill = (): void => {
    startConvert(async () => {
      const res = await convertSabcrmSupplyPurchaseOrderToBill(po._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Bill ${res.data.number} created.`);
      router.push(res.data.href);
    });
  };

  /* ---- primary actions (status-aware) ---- */
  const canEdit = status === 'draft' || status === 'awaiting_approval';

  const primaryButtons: React.ReactNode[] = [];
  if (status === 'draft') {
    primaryButtons.push(
      <Button
        key="request"
        variant="secondary"
        iconLeft={ClipboardCheck}
        loading={transitioning}
        onClick={() =>
          transition('awaiting_approval', `${po.poNo} sent for approval.`)
        }
      >
        Request approval
      </Button>,
      <Button
        key="send"
        variant="primary"
        iconLeft={Send}
        loading={transitioning}
        onClick={() => transition('sent', `${po.poNo} sent to the vendor.`)}
      >
        Send to vendor
      </Button>,
    );
  } else if (status === 'awaiting_approval') {
    primaryButtons.push(
      <Button
        key="approve"
        variant="primary"
        iconLeft={CheckCircle2}
        loading={transitioning}
        onClick={() => transition('approved', `${po.poNo} approved.`)}
      >
        Approve
      </Button>,
    );
  } else if (status === 'approved') {
    primaryButtons.push(
      <Button
        key="send"
        variant="primary"
        iconLeft={Send}
        loading={transitioning}
        onClick={() => transition('sent', `${po.poNo} sent to the vendor.`)}
      >
        Send to vendor
      </Button>,
    );
  } else if (status === 'sent' || status === 'partial') {
    primaryButtons.push(
      <Button
        key="receive"
        variant="primary"
        iconLeft={PackageCheck}
        loading={transitioning}
        onClick={() => transition('received', `${po.poNo} marked received.`)}
      >
        Mark received
      </Button>,
    );
  }

  /* ---- More menu (convert + lifecycle) ---- */
  const menuItems: ConvertMenuItem[] = [];
  if (status !== 'cancelled') {
    menuItems.push({
      key: 'grn',
      label: 'Receive → new GRN',
      description: 'Open a goods receipt prefilled from this PO',
      icon: PackageCheck,
      onSelect: () =>
        router.push(`${GRN_PATH}?fromPo=${encodeURIComponent(po._id)}`),
    });
    menuItems.push({
      key: 'bill',
      label: 'Create bill',
      description: 'Bill this purchase order in Finance',
      icon: FileText,
      disabled: converting,
      onSelect: handleConvertToBill,
    });
  }
  if (allowed.includes('closed')) {
    menuItems.push({
      key: 'close',
      label: 'Close purchase order',
      icon: CheckCircle2,
      group: menuItems.length > 0,
      onSelect: () => transition('closed', `${po.poNo} closed.`),
    });
  }
  if (status === 'cancelled' && allowed.includes('draft')) {
    menuItems.push({
      key: 'reopen',
      label: 'Reopen as draft',
      icon: RotateCcw,
      group: menuItems.length > 0,
      onSelect: () => transition('draft', `${po.poNo} reopened as draft.`),
    });
  }
  if (allowed.includes('cancelled')) {
    menuItems.push({
      key: 'cancel',
      label: 'Cancel purchase order',
      icon: XCircle,
      danger: true,
      group: menuItems.length > 0,
      onSelect: () => transition('cancelled', `${po.poNo} cancelled.`),
    });
  }
  menuItems.push({
    key: 'delete',
    label: 'Delete purchase order',
    icon: Trash2,
    danger: true,
    group: menuItems.length > 0,
    onSelect: () => setConfirmDelete(true),
  });

  const actions = (
    <>
      {primaryButtons}
      <Button variant="secondary" iconLeft={Printer} onClick={() => window.print()}>
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
      <ConvertMenu
        label="More"
        items={menuItems}
        disabled={transitioning || converting}
      />
    </>
  );

  /* ---- paper data ---- */
  const lines: DocDetailLine[] = (po.items ?? []).map((item) => ({
    description: item.description ?? '',
    hsnSac: item.hsnSac,
    qty: item.qty,
    unit: item.unit,
    rate: item.rate,
    discountPct: item.discountPct,
    taxRatePct: item.taxRatePct,
    total: item.total,
  }));

  const subTotal = po.totals?.subTotal ?? 0;
  const total = po.totals?.total ?? 0;
  const lineTotalSum = (po.items ?? []).reduce(
    (s, item) => s + (item.total ?? 0),
    0,
  );
  const taxTotal = Math.max(0, lineTotalSum - subTotal);

  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Order date', value: formatDocDate(po.date) },
    ...(po.expectedDelivery
      ? [{ label: 'Expected delivery', value: formatDocDate(po.expectedDelivery) }]
      : []),
    ...(po.paymentTerms
      ? [{ label: 'Payment terms', value: po.paymentTerms }]
      : []),
    { label: 'Currency', value: currency },
    ...(warehouseLabel
      ? [{ label: 'Ship-to warehouse', value: warehouseLabel }]
      : []),
    ...(po.billingBranchId
      ? [{ label: 'Billing branch', value: po.billingBranchId }]
      : []),
  ];

  /* ---- activity ---- */
  const createdAt = po.audit?.createdAt ?? po.createdAt;
  const activity: DocActivityEntry[] = [];
  if (createdAt) {
    activity.push({
      id: 'created',
      icon: FilePenLine,
      title: 'Purchase order created',
      at: createdAt,
    });
  }
  for (const ref of related.filter((r) => r.kind === 'grn')) {
    activity.push({
      id: `grn-${ref.id}`,
      icon: PackageCheck,
      title: `Goods receipt ${ref.label}`,
      meta: ref.status,
      at: ref.date,
    });
  }
  activity.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));

  return (
    <>
      <DocDetailPage
        backHref={PURCHASE_ORDERS_PATH}
        backLabel="Purchase orders"
        docNumber={po.poNo}
        entitySingular="Purchase order"
        statuses={PO_STATUSES}
        flow={PO_FLOW as unknown as string[]}
        status={status}
        actions={actions}
        party={
          vendorLabel
            ? { label: vendorLabel, href: null, meta: 'Vendor' }
            : null
        }
        meta={meta}
        currency={currency}
        lines={lines}
        totals={{
          subTotal,
          taxTotal,
          discountOverall: po.totals?.discountOverall,
          shippingCharge: po.totals?.shippingCharge,
          adjustment: po.totals?.adjustment,
          roundOff: po.totals?.roundOff,
          total,
        }}
        notes={po.notes}
        terms={po.termsAndConditions}
        related={related}
        activity={activity}
      />

      <DocForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialValues={editSeed}
        config={editConfig}
        onSubmit={async (values) => {
          const extras = readPoExtras(values);
          const res = await updateSabcrmSupplyPurchaseOrderFull(po._id, {
            vendorId: values.partyId ?? undefined,
            currency: values.currency,
            date: values.date,
            expectedDelivery: values.dueDate,
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            totalsModifiers: values.modifiers ?? {},
            shipToWarehouseId: extras.shipToWarehouseId,
            paymentTerms: values.paymentTerms,
            notes: values.customerNotes,
            termsAndConditions: values.termsAndConditions,
          });
          if (!res.ok) return res;
          toast.success(`${res.data.poNo} updated.`);
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
            <AlertDialogTitle>Delete {po.poNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the purchase order from this workspace.
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
              Delete purchase order
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
