'use client';

/**
 * SabCRM Supply — Stock-adjustment detail client (rollout WI-4).
 *
 * Composes the doc-surface DocDetailPage with the adjustment workflow:
 *
 *   - StatusFlow header (draft → approved) + Approve / Cancel / Reopen
 *     transitions (validated again server-side against the UI vocab);
 *   - print-friendly paper: warehouse, product, signed quantity,
 *     reason, reference, cost-per-unit and approval audit as meta rows,
 *     plus a single computed line (delta × cost) and totals;
 *   - Edit → the same DocForm drawer the list uses, seeded from the doc;
 *   - approval rail card (approved-by / at / notes).
 *
 * The adjustment has no finance party; the kit's party card hard-labels
 * "Customer", so we leave `party={null}` and surface the warehouse +
 * product fully in the meta rows to avoid a misleading heading.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Ban,
  CheckCircle2,
  ClipboardCheck,
  FilePenLine,
  Printer,
  RotateCcw,
  Trash2,
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

import {
  ConvertMenu,
  DocDetailPage,
  DocForm,
  formatDocDate,
  type ConvertMenuItem,
  type DocActivityEntry,
} from '../../../finance/_components/doc-surface';

import {
  ADJUSTMENT_FLOW,
  ADJUSTMENT_STATUSES,
  ADJUSTMENTS_PATH,
  signedQty,
} from '../stock-adjustment-config';
import {
  buildAdjustmentFormConfig,
  adjustmentDocToFormValues,
  adjustmentFormToInput,
} from '../stock-adjustment-form';
import { transitionSabcrmSupplyStockAdjustmentStatus } from '@/app/actions/sabcrm-supply-docs.actions';
import { updateSabcrmSupplyStockAdjustmentFull } from '@/app/actions/sabcrm-supply-stock-adjustments.actions';
import { deleteSabcrmSupplyStockAdjustment } from '@/app/actions/sabcrm-supply.actions';
import type { SabcrmStockAdjustmentStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import type { CrmStockAdjustmentDoc } from '@/lib/rust-client/crm-stock-adjustments';

export interface StockAdjustmentDetailClientProps {
  adjustment: CrmStockAdjustmentDoc | null;
  warehouseLabel: string | null;
  productLabel: string | null;
  error: string | null;
}

export function StockAdjustmentDetailClient({
  adjustment,
  warehouseLabel,
  productLabel,
  error,
}: StockAdjustmentDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  const editSeed = React.useMemo(
    () =>
      adjustment
        ? adjustmentDocToFormValues(adjustment, warehouseLabel, productLabel)
        : undefined,
    [adjustment, warehouseLabel, productLabel],
  );

  if (!adjustment) {
    return (
      <DocDetailPage
        backHref={ADJUSTMENTS_PATH}
        backLabel="Stock adjustments"
        docNumber="Adjustment"
        entitySingular="Stock adjustment"
        statuses={ADJUSTMENT_STATUSES}
        flow={[...ADJUSTMENT_FLOW]}
        status="draft"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Adjustment not found.'}
      />
    );
  }

  const status = (adjustment.status ?? 'draft') as SabcrmStockAdjustmentStatus;
  const currency = 'INR';
  const qty = adjustment.quantity ?? 0;
  const cost = adjustment.costPerUnit ?? 0;
  const lineTotal = qty * cost;
  const docNumber =
    adjustment.adjustmentNumber || `Adjustment ${adjustment._id.slice(-6)}`;

  const transition = (
    next: SabcrmStockAdjustmentStatus,
    success: string,
  ): void => {
    startTransition(async () => {
      const res = await transitionSabcrmSupplyStockAdjustmentStatus(
        adjustment._id,
        next,
      );
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
      const res = await deleteSabcrmSupplyStockAdjustment(adjustment._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${docNumber} deleted.`);
      router.push(ADJUSTMENTS_PATH);
      router.refresh();
    });
  };

  /* ---- actions bar ---- */
  const menuItems: ConvertMenuItem[] = [];
  if (status === 'draft') {
    menuItems.push({
      key: 'cancel',
      label: 'Cancel adjustment',
      description: 'Discard this draft without applying it',
      icon: Ban,
      danger: true,
      onSelect: () => transition('cancelled', `${docNumber} cancelled.`),
    });
  }
  if (status === 'cancelled') {
    menuItems.push({
      key: 'reopen',
      label: 'Reopen as draft',
      icon: RotateCcw,
      onSelect: () => transition('draft', `${docNumber} reopened as draft.`),
    });
  }
  menuItems.push({
    key: 'delete',
    label: 'Delete adjustment',
    icon: Trash2,
    danger: true,
    group: menuItems.length > 0,
    onSelect: () => setConfirmDelete(true),
  });

  const actions = (
    <>
      {status === 'draft' ? (
        <Button
          variant="primary"
          iconLeft={CheckCircle2}
          loading={transitioning}
          onClick={() => transition('approved', `${docNumber} approved.`)}
        >
          Approve
        </Button>
      ) : null}
      <Button variant="secondary" iconLeft={Printer} onClick={() => window.print()}>
        Print
      </Button>
      {status === 'draft' ? (
        <Button
          variant="secondary"
          iconLeft={FilePenLine}
          onClick={() => setEditOpen(true)}
        >
          Edit
        </Button>
      ) : null}
      <ConvertMenu label="More" items={menuItems} disabled={transitioning} />
    </>
  );

  /* ---- paper meta (full field coverage) ---- */
  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Date', value: formatDocDate(adjustment.date) },
    {
      label: 'Warehouse',
      value: warehouseLabel ?? (
        <span className="fdoc-unknown-party">Unknown warehouse</span>
      ),
    },
    {
      label: 'Product',
      value: productLabel ?? (
        <span className="fdoc-unknown-party">Unknown item</span>
      ),
    },
    { label: 'Quantity', value: signedQty(qty) },
    { label: 'Reason', value: adjustment.reason || '—' },
    ...(adjustment.referenceNumber
      ? [{ label: 'Reference #', value: adjustment.referenceNumber }]
      : []),
    ...(adjustment.costPerUnit !== undefined &&
    adjustment.costPerUnit !== null
      ? [{ label: 'Cost per unit', value: String(adjustment.costPerUnit) }]
      : []),
  ];

  /* ---- approval rail card ---- */
  const railExtra =
    adjustment.approvedByName || adjustment.approvedAt || adjustment.approvalNotes ? (
      <Card variant="outlined">
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-1.5">
              <ClipboardCheck size={14} aria-hidden="true" /> Approval
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody>
          {adjustment.approvedByName ? (
            <div className="text-sm font-medium">
              {adjustment.approvedByName}
            </div>
          ) : null}
          {adjustment.approvedAt ? (
            <span className="fdoc-cell-sub">
              {formatDocDate(adjustment.approvedAt)}
            </span>
          ) : null}
          {adjustment.approvalNotes ? (
            <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
              {adjustment.approvalNotes}
            </p>
          ) : null}
        </CardBody>
      </Card>
    ) : null;

  /* ---- activity ---- */
  const activity: DocActivityEntry[] = [];
  if (adjustment.createdAt) {
    activity.push({
      id: 'created',
      icon: ClipboardCheck,
      title: 'Adjustment recorded',
      at: adjustment.createdAt,
    });
  }
  if (adjustment.approvedAt) {
    activity.push({
      id: 'approved',
      icon: CheckCircle2,
      title: 'Adjustment approved',
      at: adjustment.approvedAt,
    });
  }
  if (
    adjustment.updatedAt &&
    adjustment.updatedAt !== adjustment.createdAt &&
    adjustment.updatedAt !== adjustment.approvedAt
  ) {
    activity.push({
      id: 'updated',
      icon: FilePenLine,
      title: 'Adjustment updated',
      at: adjustment.updatedAt,
    });
  }

  return (
    <>
      <DocDetailPage
        backHref={ADJUSTMENTS_PATH}
        backLabel="Stock adjustments"
        docNumber={docNumber}
        entitySingular="Stock adjustment"
        statuses={ADJUSTMENT_STATUSES}
        flow={[...ADJUSTMENT_FLOW]}
        status={status}
        actions={actions}
        party={null}
        meta={meta}
        currency={currency}
        lines={[
          {
            description: productLabel ?? 'Adjusted item',
            qty,
            rate: cost,
            total: lineTotal,
          },
        ]}
        totals={{ subTotal: lineTotal, total: lineTotal }}
        notes={adjustment.notes}
        related={[]}
        activity={activity}
        railExtra={railExtra}
      />

      <DocForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialValues={editSeed}
        config={buildAdjustmentFormConfig({ mode: 'edit' })}
        onSubmit={async (values) => {
          const mapped = adjustmentFormToInput(values);
          if (!mapped.ok) return mapped;
          const res = await updateSabcrmSupplyStockAdjustmentFull(
            adjustment._id,
            mapped.input,
          );
          if (!res.ok) return res;
          toast.success(`${docNumber} updated.`);
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
            <AlertDialogTitle>Delete {docNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the adjustment from this workspace.
              Stock levels already changed by an approved adjustment are NOT
              rolled back. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete adjustment
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
