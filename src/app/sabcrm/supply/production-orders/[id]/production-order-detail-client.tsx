'use client';

/**
 * SabCRM Supply — Production-order detail client (rollout WI-11).
 *
 * Composes the doc-surface DocDetailPage with the production workflow:
 *
 *   - StatusFlow (planned → in_progress → completed; cancelled
 *     off-path); Start / Complete / Cancel / reopen transitions
 *     validated server-side against SABCRM_PRODUCTION_ORDER_TRANSITIONS;
 *   - the COMPLETE move opens a dialog capturing actualYield + scrap,
 *     PATCHed alongside the status (the shared transition's extras);
 *   - party-less paper; components render as lines (qty × costPerUnit);
 *   - `railExtra` yield-vs-planned + cost rollup card;
 *   - Edit → the bespoke ProductionOrderForm drawer;
 *   - related rail: the source BOM.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  FilePenLine,
  Layers,
  PlayCircle,
  Printer,
  RotateCcw,
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
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  toast,
} from '@/components/sabcrm/20ui';

import type { CrmProductionOrderDoc } from '@/lib/rust-client/sabcrm-supply';
import { transitionSabcrmSupplyProductionOrderStatus } from '@/app/actions/sabcrm-supply-docs.actions';
import { updateSabcrmSupplyProductionOrderFull } from '@/app/actions/sabcrm-supply-production-orders.actions';
import { deleteSabcrmSupplyProductionOrder } from '@/app/actions/sabcrm-supply.actions';
import type { SabcrmProductionOrderStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import { SABCRM_PRODUCTION_ORDER_TRANSITIONS } from '@/app/actions/sabcrm-supply-docs.actions.types';
import type { SabcrmRelatedDocRef } from '@/app/actions/sabcrm-finance-invoices.actions.types';

import {
  ConvertMenu,
  DocDetailPage,
  formatDocDate,
  formatDocMoney,
  type ConvertMenuItem,
  type DocActivityEntry,
  type DocDetailLine,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  PRODUCTION_ORDER_FLOW,
  PRODUCTION_ORDER_STATUSES,
  PRODUCTION_ORDERS_PATH,
} from '../production-order-config';
import {
  ProductionOrderForm,
  productionOrderToFormState,
} from '../production-order-form';

const BOM_PATH = '/sabcrm/supply/bom';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/* ─── Complete dialog ──────────────────────────────────────────── */

interface CompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: CrmProductionOrderDoc;
  onDone: () => void;
}

function CompleteDialog({
  open,
  onOpenChange,
  order,
  onDone,
}: CompleteDialogProps): React.JSX.Element {
  const [actualYield, setActualYield] = React.useState(
    String(order.actualYield || order.plannedQty || ''),
  );
  const [scrap, setScrap] = React.useState(String(order.scrap || ''));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setActualYield(String(order.actualYield || order.plannedQty || ''));
    setScrap(String(order.scrap || ''));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (): void => {
    const yieldNum = Number(actualYield);
    if (!Number.isFinite(yieldNum) || yieldNum < 0) {
      setError('Enter a valid actual yield.');
      return;
    }
    const scrapNum = scrap.trim() === '' ? 0 : Number(scrap);
    if (!Number.isFinite(scrapNum) || scrapNum < 0) {
      setError('Enter a valid scrap quantity.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await transitionSabcrmSupplyProductionOrderStatus(
        order._id,
        'completed',
        { actualYield: yieldNum, scrap: scrapNum },
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`${order.orderNo} completed.`);
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(n) => !pending && onOpenChange(n)}>
      <DialogContent aria-describedby="mo-complete-desc">
        <DialogHeader>
          <DialogTitle>Complete {order.orderNo}</DialogTitle>
          <DialogDescription id="mo-complete-desc">
            Record the actual yield and scrap for this run. Planned:{' '}
            {order.plannedQty} {order.unit}.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label={`Actual yield (${order.unit})`} required>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={actualYield}
                onChange={(e) => setActualYield(e.target.value)}
                autoFocus
                disabled={pending}
              />
            </Field>
            <Field label={`Scrap (${order.unit})`}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={scrap}
                onChange={(e) => setScrap(e.target.value)}
                placeholder="0"
                disabled={pending}
              />
            </Field>
            {error ? (
              <div role="alert" className="text-sm text-[var(--st-danger,#dc2626)]">
                {error}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>
              Complete order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main client ──────────────────────────────────────────────── */

export interface ProductionOrderDetailClientProps {
  order: CrmProductionOrderDoc | null;
  bomLabel: string | null;
  error: string | null;
}

export function ProductionOrderDetailClient({
  order,
  bomLabel,
  error,
}: ProductionOrderDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);
  const editState = React.useMemo(
    () => (order ? productionOrderToFormState(order) : undefined),
    [order],
  );

  if (!order) {
    return (
      <DocDetailPage
        backHref={PRODUCTION_ORDERS_PATH}
        backLabel="Production orders"
        docNumber="Production order"
        entitySingular="Production order"
        statuses={PRODUCTION_ORDER_STATUSES}
        flow={PRODUCTION_ORDER_FLOW as unknown as string[]}
        status="planned"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Production order not found.'}
      />
    );
  }

  // Normalise the crate's snake_case "complete" onto the UI "completed".
  const rawStatus = order.status ?? 'planned';
  const status = (
    rawStatus === 'complete' ? 'completed' : rawStatus
  ) as SabcrmProductionOrderStatus;
  const allowed = SABCRM_PRODUCTION_ORDER_TRANSITIONS[status] ?? [];

  const transition = (
    next: SabcrmProductionOrderStatus,
    success: string,
  ): void => {
    startTransition(async () => {
      const res = await transitionSabcrmSupplyProductionOrderStatus(
        order._id,
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
      const res = await deleteSabcrmSupplyProductionOrder(order._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${order.orderNo} deleted.`);
      router.push(PRODUCTION_ORDERS_PATH);
      router.refresh();
    });
  };

  /* ---- cost rollup ---- */
  const materialCost =
    order.materialCost ??
    round2(
      (order.components ?? []).reduce(
        (s, c) => s + (c.qty ?? 0) * (c.costPerUnit ?? 0),
        0,
      ),
    );
  const labour = order.labourCost ?? 0;
  const overhead = order.overheadCost ?? 0;
  const total = order.totalCost ?? round2(materialCost + labour + overhead);

  /* ---- lines ---- */
  const lines: DocDetailLine[] = (order.components ?? []).map((c) => ({
    description: c.itemName,
    qty: c.qty,
    unit: c.unit,
    rate: c.costPerUnit ?? 0,
    total: round2((c.qty ?? 0) * (c.costPerUnit ?? 0)),
  }));

  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Finished good', value: order.finishedGoodName },
    {
      label: 'Planned quantity',
      value: `${order.plannedQty} ${order.unit}`.trim(),
    },
    ...(bomLabel
      ? [
          {
            label: 'Bill of materials',
            value: order.bomId ? (
              <a href={`${BOM_PATH}/${encodeURIComponent(order.bomId)}`}>
                {bomLabel}
              </a>
            ) : (
              bomLabel
            ),
          },
        ]
      : []),
    ...(order.plannedStart
      ? [{ label: 'Planned start', value: formatDocDate(order.plannedStart) }]
      : []),
    ...(order.plannedEnd
      ? [{ label: 'Planned end', value: formatDocDate(order.plannedEnd) }]
      : []),
    ...(order.machineId ? [{ label: 'Machine', value: order.machineId }] : []),
    ...(order.machineOperator
      ? [{ label: 'Operator', value: order.machineOperator }]
      : []),
  ];

  /* ---- actions ---- */
  const canEdit = status === 'planned' || status === 'in_progress';
  const primaryButtons: React.ReactNode[] = [];
  if (status === 'planned' && allowed.includes('in_progress')) {
    primaryButtons.push(
      <Button
        key="start"
        variant="primary"
        iconLeft={PlayCircle}
        loading={transitioning}
        onClick={() => transition('in_progress', `${order.orderNo} started.`)}
      >
        Start production
      </Button>,
    );
  }
  if (status === 'in_progress' && allowed.includes('completed')) {
    primaryButtons.push(
      <Button
        key="complete"
        variant="primary"
        iconLeft={CheckCircle2}
        onClick={() => setCompleteOpen(true)}
      >
        Complete with yield
      </Button>,
    );
  }

  const menuItems: ConvertMenuItem[] = [];
  if (order.bomId) {
    menuItems.push({
      key: 'bom',
      label: 'View source BOM',
      icon: Layers,
      onSelect: () =>
        router.push(`${BOM_PATH}/${encodeURIComponent(order.bomId as string)}`),
    });
  }
  if (allowed.includes('cancelled')) {
    menuItems.push({
      key: 'cancel',
      label: 'Cancel order',
      icon: XCircle,
      danger: true,
      group: menuItems.length > 0,
      onSelect: () => transition('cancelled', `${order.orderNo} cancelled.`),
    });
  }
  if (status === 'cancelled' && allowed.includes('planned')) {
    menuItems.push({
      key: 'reopen',
      label: 'Reopen as planned',
      icon: RotateCcw,
      group: menuItems.length > 0,
      onSelect: () => transition('planned', `${order.orderNo} reopened.`),
    });
  }
  menuItems.push({
    key: 'delete',
    label: 'Delete production order',
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
      <ConvertMenu label="More" items={menuItems} disabled={transitioning} />
    </>
  );

  /* ---- railExtra: yield + cost ---- */
  const yieldPct =
    order.plannedQty > 0
      ? Math.round(((order.actualYield ?? 0) / order.plannedQty) * 100)
      : 0;

  const railExtra = (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>Yield &amp; cost</CardTitle>
      </CardHeader>
      <CardBody>
        <dl className="fdoc-totals">
          <dt className="fdoc-totals__label">Planned</dt>
          <dd className="fdoc-totals__value">
            {order.plannedQty} {order.unit}
          </dd>
          <dt className="fdoc-totals__label">Actual yield</dt>
          <dd className="fdoc-totals__value">
            {order.actualYield ?? 0} {order.unit}
            {status === 'completed' ? ` · ${yieldPct}%` : ''}
          </dd>
          {order.scrap ? (
            <>
              <dt className="fdoc-totals__label">Scrap</dt>
              <dd className="fdoc-totals__value">
                {order.scrap} {order.unit}
              </dd>
            </>
          ) : null}
          <dt className="fdoc-totals__label">Material</dt>
          <dd className="fdoc-totals__value">
            {formatDocMoney(materialCost, 'INR')}
          </dd>
          {labour ? (
            <>
              <dt className="fdoc-totals__label">Labour</dt>
              <dd className="fdoc-totals__value">
                {formatDocMoney(labour, 'INR')}
              </dd>
            </>
          ) : null}
          {overhead ? (
            <>
              <dt className="fdoc-totals__label">Overhead</dt>
              <dd className="fdoc-totals__value">
                {formatDocMoney(overhead, 'INR')}
              </dd>
            </>
          ) : null}
          <div className="fdoc-totals__grand">
            <dt className="fdoc-totals__label">Total cost</dt>
            <dd className="fdoc-totals__value">{formatDocMoney(total, 'INR')}</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );

  /* ---- related: source BOM ---- */
  const related: SabcrmRelatedDocRef[] = [];
  if (order.bomId && bomLabel) {
    related.push({
      kind: 'bom',
      id: order.bomId,
      label: bomLabel,
      href: `${BOM_PATH}/${encodeURIComponent(order.bomId)}`,
      direction: 'parent',
    });
  }

  const activity: DocActivityEntry[] = [];
  if (order.createdAt) {
    activity.push({
      id: 'created',
      icon: FilePenLine,
      title: 'Production order created',
      at: order.createdAt,
    });
  }

  return (
    <>
      <DocDetailPage
        backHref={PRODUCTION_ORDERS_PATH}
        backLabel="Production orders"
        docNumber={order.orderNo}
        entitySingular="Production order"
        statuses={PRODUCTION_ORDER_STATUSES}
        flow={PRODUCTION_ORDER_FLOW as unknown as string[]}
        status={status}
        actions={actions}
        party={null}
        meta={meta}
        currency="INR"
        lines={lines}
        totals={{ subTotal: materialCost, total }}
        notes={order.notes}
        related={related}
        activity={activity}
        railExtra={railExtra}
      />

      <CompleteDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        order={order}
        onDone={refresh}
      />

      <ProductionOrderForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialState={editState}
        onSubmit={async (input) => {
          const res = await updateSabcrmSupplyProductionOrderFull(order._id, {
            bomId: input.bomId,
            bomRef: input.bomRef,
            finishedGoodId: input.finishedGoodId,
            finishedGoodName: input.finishedGoodName,
            plannedQty: input.plannedQty,
            unit: input.unit,
            plannedStart: input.plannedStart,
            plannedEnd: input.plannedEnd,
            machineId: input.machineId,
            machineOperator: input.machineOperator,
            machineOperatorId: input.machineOperatorId,
            notes: input.notes,
            labourCost: input.labourCost,
            overheadCost: input.overheadCost,
            components: input.components,
          });
          if (!res.ok) return res;
          toast.success(`${res.data.orderNo} updated.`);
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
            <AlertDialogTitle>Delete {order.orderNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the production order from this workspace.
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
              Delete production order
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
