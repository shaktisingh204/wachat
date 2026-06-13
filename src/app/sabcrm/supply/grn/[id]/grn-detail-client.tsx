'use client';

/**
 * SabCRM Supply — GRN detail client (rollout WI-6).
 *
 * Composes the doc-surface DocDetailPage with the GRN workflow:
 *
 *   - StatusFlow over the 8-status vocabulary; transitions (receive /
 *     inspect / post / close / reject / QC-fail) validated again
 *     server-side against SABCRM_GRN_TRANSITIONS;
 *   - the paper's line table stays simple (item + accepted qty) — the
 *     full ordered/received/accepted/rejected QUARTET (+ batch / expiry /
 *     serials) lives in a `railExtra` card since DocDetailLine can't show
 *     four quantity columns;
 *   - Edit → the same DocForm + bespoke GrnLinesEditor the list uses;
 *   - related rail: the parent purchase order;
 *   - Print → window.print().
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ClipboardCheck,
  FilePenLine,
  PackageCheck,
  Printer,
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
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  toast,
} from '@/components/sabcrm/20ui';

import type { CrmGrnDoc } from '@/lib/rust-client/sabcrm-supply';
import { transitionSabcrmSupplyGrnStatus } from '@/app/actions/sabcrm-supply-docs.actions';
import { updateSabcrmSupplyGrnFull } from '@/app/actions/sabcrm-supply-grn.actions';
import { deleteSabcrmSupplyGrn } from '@/app/actions/sabcrm-supply.actions';
import type { SabcrmGrnStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import { SABCRM_GRN_TRANSITIONS } from '@/app/actions/sabcrm-supply-docs.actions.types';
import type { SabcrmGrnDetailLine } from '@/app/actions/sabcrm-supply-grn.actions.types';
import type { SabcrmRelatedDocRef } from '@/app/actions/sabcrm-finance-invoices.actions.types';

import {
  ConvertMenu,
  DocDetailPage,
  DocForm,
  formatDocDate,
  type ConvertMenuItem,
  type DocActivityEntry,
  type DocDetailLine,
} from '@/app/sabcrm/finance/_components/doc-surface';
import { GRN_FLOW, GRN_STATUSES, GRN_PATH } from '../grn-config';
import { buildGrnFormConfig, grnToFormValues, readGrnExtras } from '../grn-form';

const PO_PATH = '/sabcrm/supply/purchase-orders';

export interface GrnDetailClientProps {
  grn: CrmGrnDoc | null;
  vendorLabel: string | null;
  warehouseLabel: string | null;
  poLabel: string | null;
  inspectorLabel: string | null;
  detailLines: SabcrmGrnDetailLine[];
  error: string | null;
}

export function GrnDetailClient({
  grn,
  vendorLabel,
  warehouseLabel,
  poLabel,
  inspectorLabel,
  detailLines,
  error,
}: GrnDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  const itemLabels = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const l of detailLines) {
      if (l.itemId && l.itemLabel) map.set(l.itemId, l.itemLabel);
    }
    return map;
  }, [detailLines]);

  const editSeed = React.useMemo(
    () =>
      grn
        ? grnToFormValues(grn, {
            vendorLabel,
            warehouseLabel,
            poLabel,
            inspectorLabel,
            itemLabels,
          })
        : undefined,
    [grn, vendorLabel, warehouseLabel, poLabel, inspectorLabel, itemLabels],
  );
  const editConfig = React.useMemo(() => buildGrnFormConfig(), []);

  if (!grn) {
    return (
      <DocDetailPage
        backHref={GRN_PATH}
        backLabel="Goods receipts"
        docNumber="Goods receipt"
        entitySingular="Goods receipt"
        statuses={GRN_STATUSES}
        flow={GRN_FLOW as unknown as string[]}
        status="draft"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Goods receipt not found.'}
      />
    );
  }

  const status = (grn.status ?? 'draft') as SabcrmGrnStatus;
  const allowed = SABCRM_GRN_TRANSITIONS[status] ?? [];

  const transition = (next: SabcrmGrnStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmSupplyGrnStatus(grn._id, next);
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
      const res = await deleteSabcrmSupplyGrn(grn._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${grn.grnNo} deleted.`);
      router.push(GRN_PATH);
      router.refresh();
    });
  };

  /* ---- primary actions (status-aware) ---- */
  const canEdit = status === 'draft' || status === 'received' || status === 'partial';

  const primaryButtons: React.ReactNode[] = [];
  if (status === 'draft') {
    primaryButtons.push(
      <Button
        key="receive"
        variant="primary"
        iconLeft={PackageCheck}
        loading={transitioning}
        onClick={() => transition('received', `${grn.grnNo} marked received.`)}
      >
        Mark received
      </Button>,
    );
  } else if (status === 'received' || status === 'partial') {
    primaryButtons.push(
      <Button
        key="inspect"
        variant="primary"
        iconLeft={ClipboardCheck}
        loading={transitioning}
        onClick={() => transition('inspected', `${grn.grnNo} inspected.`)}
      >
        Mark inspected
      </Button>,
    );
  } else if (status === 'inspected') {
    primaryButtons.push(
      <Button
        key="post"
        variant="primary"
        iconLeft={CheckCircle2}
        loading={transitioning}
        onClick={() => transition('posted', `${grn.grnNo} posted to stock.`)}
      >
        Post to stock
      </Button>,
    );
  }

  /* ---- More menu ---- */
  const menuItems: ConvertMenuItem[] = [];
  if (allowed.includes('closed')) {
    menuItems.push({
      key: 'close',
      label: 'Close goods receipt',
      icon: CheckCircle2,
      onSelect: () => transition('closed', `${grn.grnNo} closed.`),
    });
  }
  if (status === 'inspected' && allowed.includes('qc_failed')) {
    menuItems.push({
      key: 'qc_failed',
      label: 'Flag QC failed',
      icon: XCircle,
      danger: true,
      group: menuItems.length > 0,
      onSelect: () => transition('qc_failed', `${grn.grnNo} flagged QC failed.`),
    });
  }
  if (allowed.includes('rejected')) {
    menuItems.push({
      key: 'rejected',
      label: 'Reject receipt',
      icon: XCircle,
      danger: true,
      group: menuItems.length > 0,
      onSelect: () => transition('rejected', `${grn.grnNo} rejected.`),
    });
  }
  menuItems.push({
    key: 'delete',
    label: 'Delete goods receipt',
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

  /* ---- paper: simple lines (item + accepted qty) ---- */
  const lines: DocDetailLine[] = detailLines.map((l) => ({
    description: l.itemLabel ?? 'Catalog item',
    qty: l.acceptedQty,
    rate: 0,
    total: 0,
  }));

  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Receipt date', value: formatDocDate(grn.date) },
    ...(poLabel
      ? [
          {
            label: 'Purchase order',
            value: grn.poId ? (
              <a href={`${PO_PATH}/${encodeURIComponent(grn.poId)}`}>{poLabel}</a>
            ) : (
              poLabel
            ),
          },
        ]
      : []),
    ...(warehouseLabel
      ? [{ label: 'Warehouse', value: warehouseLabel }]
      : []),
    ...(inspectorLabel
      ? [{ label: 'Inspector', value: inspectorLabel }]
      : []),
  ];

  /* ---- railExtra: the ordered/received/accepted/rejected quartet ---- */
  const totalOrdered = detailLines.reduce((s, l) => s + (l.orderedQty ?? 0), 0);
  const totalReceived = detailLines.reduce((s, l) => s + (l.receivedQty ?? 0), 0);
  const totalAccepted = detailLines.reduce((s, l) => s + (l.acceptedQty ?? 0), 0);
  const totalRejected = detailLines.reduce((s, l) => s + (l.rejectedQty ?? 0), 0);

  const railExtra = (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>Receipt lines</CardTitle>
      </CardHeader>
      <CardBody>
        {detailLines.length === 0 ? (
          <span className="fdoc-cell-sub">No lines on this receipt.</span>
        ) : (
          <table className="fdoc-paper-lines">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col" className="is-num">Ord</th>
                <th scope="col" className="is-num">Rec</th>
                <th scope="col" className="is-num">Acc</th>
                <th scope="col" className="is-num">Rej</th>
              </tr>
            </thead>
            <tbody>
              {detailLines.map((l, i) => (
                <tr key={i}>
                  <td>
                    {l.itemLabel ?? 'Catalog item'}
                    {l.batch ? (
                      <span className="fdoc-cell-sub">Batch {l.batch}</span>
                    ) : null}
                    {l.expiry ? (
                      <span className="fdoc-cell-sub">
                        Exp {formatDocDate(l.expiry)}
                      </span>
                    ) : null}
                    {l.serialNos?.length ? (
                      <span className="fdoc-cell-sub">
                        {l.serialNos.length} serial
                        {l.serialNos.length === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </td>
                  <td className="is-num">{l.orderedQty}</td>
                  <td className="is-num">{l.receivedQty}</td>
                  <td className="is-num">{l.acceptedQty}</td>
                  <td className="is-num">
                    {l.rejectedQty > 0 ? (
                      <Badge tone="danger">{l.rejectedQty}</Badge>
                    ) : (
                      l.rejectedQty
                    )}
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td className="is-num">{totalOrdered}</td>
                <td className="is-num">{totalReceived}</td>
                <td className="is-num">{totalAccepted}</td>
                <td className="is-num">{totalRejected}</td>
              </tr>
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  );

  /* ---- related rail: parent PO ---- */
  const related: SabcrmRelatedDocRef[] = [];
  if (grn.poId && poLabel) {
    related.push({
      kind: 'purchaseOrder',
      id: grn.poId,
      label: poLabel,
      href: `${PO_PATH}/${encodeURIComponent(grn.poId)}`,
      direction: 'parent',
    });
  }

  /* ---- activity ---- */
  const createdAt = grn.audit?.createdAt ?? grn.createdAt;
  const activity: DocActivityEntry[] = [];
  if (createdAt) {
    activity.push({
      id: 'created',
      icon: FilePenLine,
      title: 'Goods receipt created',
      at: createdAt,
    });
  }

  return (
    <>
      <DocDetailPage
        backHref={GRN_PATH}
        backLabel="Goods receipts"
        docNumber={grn.grnNo}
        entitySingular="Goods receipt"
        statuses={GRN_STATUSES}
        flow={GRN_FLOW as unknown as string[]}
        status={status}
        actions={actions}
        party={
          vendorLabel
            ? { label: vendorLabel, href: null, meta: 'Vendor' }
            : null
        }
        meta={meta}
        currency="INR"
        lines={lines}
        totals={{ subTotal: 0, total: 0 }}
        related={related}
        attachments={(grn.attachments ?? []).map((a) => ({
          fileId: a.url,
          name: a.name,
        }))}
        activity={activity}
        railExtra={railExtra}
      />

      <DocForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialValues={editSeed}
        config={editConfig}
        onSubmit={async (values) => {
          const extras = readGrnExtras(values);
          const res = await updateSabcrmSupplyGrnFull(grn._id, {
            date: values.date,
            vendorId: values.partyId ?? undefined,
            warehouseId: extras.warehouseId,
            inspectorId: extras.inspectorId || undefined,
            items: extras.grnLines.map((l) => ({
              itemId: l.itemId,
              orderedQty: l.orderedQty,
              receivedQty: l.receivedQty,
              acceptedQty: l.acceptedQty,
              rejectedQty: l.rejectedQty,
              batch: l.batch || undefined,
              expiry: l.expiry || undefined,
              serialNos: l.serialNos,
            })),
            attachments: values.attachments,
          });
          if (!res.ok) return res;
          toast.success(`${res.data.grnNo} updated.`);
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
            <AlertDialogTitle>Delete {grn.grnNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the goods receipt from this workspace.
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
              Delete goods receipt
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
