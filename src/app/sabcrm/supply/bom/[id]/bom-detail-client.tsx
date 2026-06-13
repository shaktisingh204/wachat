'use client';

/**
 * SabCRM Supply — BOM detail client (rollout WI-10).
 *
 * Composes the doc-surface DocDetailPage with the BOM workflow:
 *
 *   - StatusFlow (draft → active; obsolete off-path); Activate / mark
 *     obsolete / reactivate transitions validated server-side against
 *     SABCRM_BOM_TRANSITIONS;
 *   - party-less paper (`party:null`); components render as lines
 *     (qty × costPerUnit);
 *   - `railExtra` cost rollup card (material / labour / overhead / total);
 *   - ConvertMenu "Start production → new production order" routes to the
 *     production-orders form prefilled (`?fromBom=<id>`);
 *   - Edit → the bespoke BomForm drawer.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  CircleSlash,
  Factory,
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

import type { CrmBomDoc } from '@/lib/rust-client/sabcrm-supply';
import { transitionSabcrmSupplyBomStatus } from '@/app/actions/sabcrm-supply-docs.actions';
import { updateSabcrmSupplyBomFull } from '@/app/actions/sabcrm-supply-bom.actions';
import { deleteSabcrmSupplyBom } from '@/app/actions/sabcrm-supply.actions';
import type { SabcrmBomStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import { SABCRM_BOM_TRANSITIONS } from '@/app/actions/sabcrm-supply-docs.actions.types';

import {
  ConvertMenu,
  DocDetailPage,
  formatDocDate,
  formatDocMoney,
  type ConvertMenuItem,
  type DocActivityEntry,
  type DocDetailLine,
} from '@/app/sabcrm/finance/_components/doc-surface';
import { BOM_FLOW, BOM_STATUSES, BOM_PATH } from '../bom-config';
import { BomForm, bomToFormState } from '../bom-form';

const PRODUCTION_PATH = '/sabcrm/supply/production-orders';

export interface BomDetailClientProps {
  bom: CrmBomDoc | null;
  error: string | null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function BomDetailClient({
  bom,
  error,
}: BomDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);
  const editState = React.useMemo(
    () => (bom ? bomToFormState(bom) : undefined),
    [bom],
  );

  if (!bom) {
    return (
      <DocDetailPage
        backHref={BOM_PATH}
        backLabel="Bills of material"
        docNumber="Bill of materials"
        entitySingular="Bill of materials"
        statuses={BOM_STATUSES}
        flow={BOM_FLOW as unknown as string[]}
        status="draft"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Bill of materials not found.'}
      />
    );
  }

  const status = (bom.status ?? 'draft') as SabcrmBomStatus;
  const allowed = SABCRM_BOM_TRANSITIONS[status] ?? [];

  const transition = (next: SabcrmBomStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmSupplyBomStatus(bom._id, next);
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
      const res = await deleteSabcrmSupplyBom(bom._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${bom.bomNo} deleted.`);
      router.push(BOM_PATH);
      router.refresh();
    });
  };

  /* ---- cost rollup ---- */
  const materialCost = round2(
    (bom.components ?? []).reduce(
      (s, c) => s + (c.qty ?? 0) * (c.costPerUnit ?? 0),
      0,
    ),
  );
  const labour = bom.labourCost ?? 0;
  const overhead = bom.overheadCost ?? 0;
  const total = bom.totalCost ?? round2(materialCost + labour + overhead);

  /* ---- lines ---- */
  const lines: DocDetailLine[] = (bom.components ?? []).map((c) => ({
    description: c.itemName + (c.optional ? ' (optional)' : ''),
    qty: c.qty,
    unit: c.unit,
    rate: c.costPerUnit ?? 0,
    total: round2((c.qty ?? 0) * (c.costPerUnit ?? 0)),
  }));

  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Finished good', value: bom.finishedGoodName },
    { label: 'Output', value: `${bom.outputQty} ${bom.unit}`.trim() },
    { label: 'Version', value: `v${bom.version}` },
    ...(bom.effectiveDate
      ? [{ label: 'Effective', value: formatDocDate(bom.effectiveDate) }]
      : []),
  ];

  /* ---- actions ---- */
  const primaryButtons: React.ReactNode[] = [];
  if (allowed.includes('active')) {
    primaryButtons.push(
      <Button
        key="activate"
        variant="primary"
        iconLeft={CheckCircle2}
        loading={transitioning}
        onClick={() => transition('active', `${bom.bomNo} activated.`)}
      >
        {status === 'obsolete' ? 'Reactivate' : 'Activate'}
      </Button>,
    );
  }

  const menuItems: ConvertMenuItem[] = [
    {
      key: 'production',
      label: 'Start production → new order',
      description: 'Open a production order prefilled from this BOM',
      icon: Factory,
      onSelect: () =>
        router.push(`${PRODUCTION_PATH}?fromBom=${encodeURIComponent(bom._id)}`),
    },
  ];
  if (allowed.includes('obsolete')) {
    menuItems.push({
      key: 'obsolete',
      label: 'Mark obsolete',
      icon: CircleSlash,
      group: true,
      onSelect: () => transition('obsolete', `${bom.bomNo} marked obsolete.`),
    });
  }
  if (status === 'obsolete' && allowed.includes('active')) {
    menuItems.push({
      key: 'reactivate',
      label: 'Reactivate',
      icon: RotateCcw,
      group: true,
      onSelect: () => transition('active', `${bom.bomNo} reactivated.`),
    });
  }
  menuItems.push({
    key: 'delete',
    label: 'Delete BOM',
    icon: Trash2,
    danger: true,
    group: true,
    onSelect: () => setConfirmDelete(true),
  });

  const actions = (
    <>
      {primaryButtons}
      <Button variant="secondary" iconLeft={Printer} onClick={() => window.print()}>
        Print
      </Button>
      <Button
        variant="secondary"
        iconLeft={FilePenLine}
        onClick={() => setEditOpen(true)}
      >
        Edit
      </Button>
      <ConvertMenu label="More" items={menuItems} disabled={transitioning} />
    </>
  );

  const railExtra = (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>Cost rollup</CardTitle>
      </CardHeader>
      <CardBody>
        <dl className="fdoc-totals">
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

  const activity: DocActivityEntry[] = [];
  if (bom.createdAt) {
    activity.push({
      id: 'created',
      icon: FilePenLine,
      title: 'BOM created',
      at: bom.createdAt,
    });
  }

  return (
    <>
      <DocDetailPage
        backHref={BOM_PATH}
        backLabel="Bills of material"
        docNumber={bom.bomNo}
        entitySingular="Bill of materials"
        statuses={BOM_STATUSES}
        flow={BOM_FLOW as unknown as string[]}
        status={status}
        actions={actions}
        party={null}
        meta={meta}
        currency="INR"
        lines={lines}
        totals={{ subTotal: materialCost, total }}
        notes={bom.notes}
        related={[]}
        activity={activity}
        railExtra={railExtra}
      />

      <BomForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialState={editState}
        onSubmit={async (input) => {
          const res = await updateSabcrmSupplyBomFull(bom._id, {
            finishedGoodName: input.finishedGoodName,
            finishedGoodId: input.finishedGoodId,
            outputQty: input.outputQty,
            unit: input.unit,
            effectiveDate: input.effectiveDate,
            version: input.version,
            notes: input.notes,
            labourCost: input.labourCost,
            overheadCost: input.overheadCost,
            components: input.components,
          });
          if (!res.ok) return res;
          toast.success(`${res.data.bomNo} updated.`);
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
            <AlertDialogTitle>Delete {bom.bomNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the bill of materials from this
              workspace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete BOM
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
