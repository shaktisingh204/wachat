'use client';

/**
 * SabCRM Finance — Debit note detail client.
 *
 * Composes the doc-surface DocDetailPage with the debit-note workflow
 * (finance-rollout spec §3.5) — the vendor-side mirror of the
 * credit-note detail:
 *
 *   - status transitions per the crate vocabulary (issue, mark
 *     refunded, cancel, reopen) — validated again server-side;
 *   - Print → `window.print()` (kit print rules keep only the paper);
 *   - Edit → the same DocForm drawer the list uses, seeded from the
 *     document (incl. the entity-specific `extras` bag);
 *   - related-documents rail (linked bill + lineage parents) and an
 *     activity feed.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  FilePenLine,
  Printer,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
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

import type {
  CrmDebitNoteDoc,
  DebitNoteStatus,
} from '@/lib/rust-client/crm-debit-notes';
import {
  transitionSabcrmDebitNoteStatus,
  updateSabcrmDebitNoteFull,
} from '@/app/actions/sabcrm-finance-debit-notes.actions';
import { deleteSabcrmDebitNote } from '@/app/actions/sabcrm-finance.actions';
import type { SabcrmRelatedDocRef } from '@/app/actions/sabcrm-finance-invoices.actions.types';
import type { DocEntityOption } from '@/app/sabcrm/finance/_components/doc-surface/types';
import { isBlankDocLine } from '@/lib/sabcrm/finance-doc-math';

import {
  ConvertMenu,
  DocDetailPage,
  DocForm,
  blankDocLine,
  formatDocDate,
  type ConvertMenuItem,
  type DocActivityEntry,
  type DocDetailLine,
  type DocFormValues,
  type DocLineDraft,
} from '../../_components/doc-surface';
import {
  DEBIT_NOTES_PATH,
  DEBIT_NOTE_FLOW,
  DEBIT_NOTE_STATUSES,
  debitNoteReasonLabel,
  debitNoteRefundModeLabel,
} from '../debit-note-config';
import {
  baseDebitNoteFormConfig,
  readDebitNoteExtras,
  validateDebitNoteExtras,
} from '../debit-note-form';

/* ─── Doc → DocForm seed ──────────────────────────────────────── */

function toFormValues(
  doc: CrmDebitNoteDoc,
  vendor: DocEntityOption | null,
  linkedBillLabel: string | null,
): DocFormValues {
  const lines: DocLineDraft[] = (doc.items ?? []).map((item, i) => ({
    rowId: `seed-${i}`,
    itemId: item.itemId,
    itemLabel: item.itemId ? (item.description ?? 'Catalog item') : null,
    description: item.description ?? '',
    hsnSac: item.hsnSac,
    qty: item.qty,
    unit: item.unit,
    rate: item.rate,
    discountPct: item.discountPct,
    taxRatePct: item.taxRatePct,
  }));
  return {
    number: doc.dnNo,
    partyId: doc.vendorId || null,
    partyLabel: vendor?.label ?? null,
    currency: doc.currency,
    date: (doc.date ?? '').slice(0, 10),
    dueDate: '',
    lines: lines.length > 0 ? lines : [blankDocLine()],
    paymentTerms: '',
    customerNotes: doc.notes ?? '',
    termsAndConditions: '',
    attachments: [],
    modifiers: {
      discountOverall: doc.totals?.discountOverall || undefined,
      shippingCharge: doc.totals?.shippingCharge || undefined,
      adjustment: doc.totals?.adjustment || undefined,
      roundOff: !!doc.totals?.roundOff,
    },
    extras: {
      linkedBillId: doc.linkedBillId ?? null,
      linkedBillLabel,
      reason: doc.reason,
      refundMode: doc.refundMode,
      refundTxnId: doc.refundTxnId ?? '',
    },
  };
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface DebitNoteDetailClientProps {
  note: CrmDebitNoteDoc | null;
  /** Resolved vendor (label + meta) — never a raw ObjectId. */
  vendor: DocEntityOption | null;
  related: SabcrmRelatedDocRef[];
  error: string | null;
}

export function DebitNoteDetailClient({
  note,
  vendor,
  related,
  error,
}: DebitNoteDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  const linkedBillRef =
    related.find((r) => r.kind === 'bill' && r.id === note?.linkedBillId) ??
    null;

  // Stable identity so DocForm's open-reset effect doesn't re-fire
  // while the user is typing.
  const editSeed = React.useMemo(
    () =>
      note ? toFormValues(note, vendor, linkedBillRef?.label ?? null) : undefined,
    [note, vendor, linkedBillRef],
  );

  if (!note) {
    return (
      <DocDetailPage
        backHref={DEBIT_NOTES_PATH}
        backLabel="Debit notes"
        docNumber="Debit note"
        entitySingular="Debit note"
        statuses={DEBIT_NOTE_STATUSES}
        flow={DEBIT_NOTE_FLOW}
        status="draft"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Debit note not found.'}
      />
    );
  }

  const status = (note.status ?? 'draft') as DebitNoteStatus;
  const total = note.totals?.total ?? 0;
  const subTotal = note.totals?.subTotal ?? total;
  const lineTotalSum = (note.items ?? []).reduce(
    (s, item) => s + (item.total ?? 0),
    0,
  );
  const taxTotal = Math.max(0, lineTotalSum - subTotal);

  const transition = (next: DebitNoteStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmDebitNoteStatus(note._id, next);
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
      const res = await deleteSabcrmDebitNote(note._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${note.dnNo} deleted.`);
      router.push(DEBIT_NOTES_PATH);
      router.refresh();
    });
  };

  /* ---- actions bar ---- */
  const canEdit = status === 'draft' || status === 'issued';

  const menuItems: ConvertMenuItem[] = [];
  if (status === 'cancelled') {
    menuItems.push({
      key: 'reopen',
      label: 'Reopen as draft',
      icon: RotateCcw,
      onSelect: () => transition('draft', `${note.dnNo} reopened as draft.`),
    });
  }
  if (status === 'draft' || status === 'issued') {
    menuItems.push({
      key: 'cancel',
      label: 'Cancel debit note',
      icon: XCircle,
      danger: true,
      group: menuItems.length > 0,
      onSelect: () => transition('cancelled', `${note.dnNo} cancelled.`),
    });
  }
  menuItems.push({
    key: 'delete',
    label: 'Delete debit note',
    icon: Trash2,
    danger: true,
    group: true,
    onSelect: () => setConfirmDelete(true),
  });

  const actions = (
    <>
      {status === 'draft' ? (
        <Button
          variant="primary"
          iconLeft={Send}
          loading={transitioning}
          onClick={() => transition('issued', `${note.dnNo} issued.`)}
        >
          Issue debit note
        </Button>
      ) : null}
      {status === 'issued' ? (
        <Button
          variant="primary"
          iconLeft={Undo2}
          loading={transitioning}
          onClick={() =>
            transition('refunded', `${note.dnNo} marked as refunded.`)
          }
        >
          Mark refunded
        </Button>
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
      <ConvertMenu label="More" items={menuItems} disabled={transitioning} />
    </>
  );

  /* ---- paper data ---- */
  const lines: DocDetailLine[] = (note.items ?? []).map((item) => ({
    description: item.description ?? '',
    hsnSac: item.hsnSac,
    qty: item.qty,
    unit: item.unit,
    rate: item.rate,
    discountPct: item.discountPct,
    taxRatePct: item.taxRatePct,
    total: item.total,
  }));

  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Debit note date', value: formatDocDate(note.date) },
    { label: 'Reason', value: debitNoteReasonLabel(note.reason) },
    {
      label: 'Refund mode',
      value: debitNoteRefundModeLabel(note.refundMode),
    },
    ...(note.refundTxnId
      ? [{ label: 'Refund txn', value: note.refundTxnId }]
      : []),
    { label: 'Currency', value: note.currency },
    ...(note.exchangeRate
      ? [{ label: 'Exchange rate', value: String(note.exchangeRate) }]
      : []),
  ];

  /* ---- activity ---- */
  const createdAt = note.audit?.createdAt ?? note.createdAt;
  const activity: DocActivityEntry[] = [];
  if (createdAt) {
    activity.push({
      id: 'created',
      icon: FilePenLine,
      title: 'Debit note created',
      at: createdAt,
    });
  }
  if (note.refundTxnId) {
    activity.push({
      id: 'refund-ref',
      icon: Undo2,
      title: `Refund reference ${note.refundTxnId}`,
      at: note.audit?.updatedAt ?? note.updatedAt,
    });
  }

  return (
    <>
      <DocDetailPage
        backHref={DEBIT_NOTES_PATH}
        backLabel="Debit notes"
        docNumber={note.dnNo}
        entitySingular="Debit note"
        statuses={DEBIT_NOTE_STATUSES}
        flow={DEBIT_NOTE_FLOW}
        status={status}
        actions={actions}
        party={
          vendor
            ? {
                label: vendor.label,
                href: null,
                meta: vendor.meta ?? 'Vendor',
              }
            : null
        }
        meta={meta}
        currency={note.currency}
        lines={lines}
        totals={{
          subTotal,
          taxTotal,
          discountOverall: note.totals?.discountOverall,
          shippingCharge: note.totals?.shippingCharge,
          adjustment: note.totals?.adjustment,
          roundOff: note.totals?.roundOff,
          total,
        }}
        notes={note.notes}
        related={related}
        attachments={
          (note.attachments ?? []).filter(
            (a): a is { fileId: string; name?: string } =>
              !!a &&
              typeof a === 'object' &&
              typeof (a as { fileId?: unknown }).fileId === 'string',
          )
        }
        activity={activity}
      />

      <DocForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialValues={editSeed}
        config={baseDebitNoteFormConfig()}
        onSubmit={async (values) => {
          const extras = readDebitNoteExtras(values.extras);
          const problem = validateDebitNoteExtras(extras);
          if (problem) return { ok: false, error: problem };
          const res = await updateSabcrmDebitNoteFull(note._id, {
            dnNo: values.number,
            vendorId: values.partyId ?? undefined,
            currency: values.currency,
            date: values.date,
            reason: extras.reason!,
            refundMode: extras.refundMode!,
            refundTxnId: extras.refundTxnId,
            linkedBillId: extras.linkedBillId ?? '',
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            totalsModifiers: values.modifiers ?? {},
            notes: values.customerNotes,
          });
          if (!res.ok) return res;
          toast.success(`${res.data.dnNo} updated.`);
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
            <AlertDialogTitle>Delete {note.dnNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the debit note from this workspace.
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
              Delete debit note
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
