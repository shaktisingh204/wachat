'use client';

/**
 * SabCRM Finance — Credit note detail client.
 *
 * Composes the doc-surface DocDetailPage with the credit-note workflow
 * (finance-rollout spec §3.4):
 *
 *   - status transitions per the crate vocabulary (issue, mark
 *     refunded, cancel, reopen) — validated again server-side;
 *   - Print → `window.print()`; the kit's `@media print` rules keep
 *     only the paper region;
 *   - Edit → the same DocForm drawer the list uses, seeded from the
 *     document (incl. the entity-specific `extras` bag);
 *   - related-documents rail (linked invoice + lineage parents) and an
 *     activity feed (created / refund reference).
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
  CreditNoteStatus,
  CrmCreditNoteDoc,
} from '@/lib/rust-client/crm-credit-notes';
import {
  transitionSabcrmCreditNoteStatus,
  updateSabcrmCreditNoteFull,
} from '@/app/actions/sabcrm-finance-credit-notes.actions';
import { deleteSabcrmCreditNote } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmPartyContact,
  SabcrmRelatedDocRef,
} from '@/app/actions/sabcrm-finance-invoices.actions.types';
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
  CREDIT_NOTES_PATH,
  CREDIT_NOTE_FLOW,
  CREDIT_NOTE_STATUSES,
  creditNoteReasonLabel,
  creditNoteRefundModeLabel,
  partyRecordHref,
} from '../credit-note-config';
import {
  baseCreditNoteFormConfig,
  readCreditNoteExtras,
  validateCreditNoteExtras,
} from '../credit-note-form';

/* ─── Doc → DocForm seed ──────────────────────────────────────── */

function toFormValues(
  doc: CrmCreditNoteDoc,
  contact: SabcrmPartyContact | null,
  linkedInvoiceLabel: string | null,
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
    number: doc.cnNo,
    partyId: doc.clientId || null,
    partyLabel: contact?.label ?? null,
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
      linkedInvoiceId: doc.linkedInvoiceId ?? null,
      linkedInvoiceLabel,
      reason: doc.reason,
      refundMode: doc.refundMode,
      refundTxnId: doc.refundTxnId ?? '',
      taxRecalc: doc.taxRecalc === true,
      autoApply: doc.autoApply === true,
    },
  };
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface CreditNoteDetailClientProps {
  note: CrmCreditNoteDoc | null;
  contact: SabcrmPartyContact | null;
  related: SabcrmRelatedDocRef[];
  error: string | null;
}

export function CreditNoteDetailClient({
  note,
  contact,
  related,
  error,
}: CreditNoteDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  const linkedInvoiceRef =
    related.find(
      (r) => r.kind === 'invoice' && r.id === note?.linkedInvoiceId,
    ) ?? null;

  // Stable identity so DocForm's open-reset effect doesn't re-fire
  // while the user is typing.
  const editSeed = React.useMemo(
    () =>
      note
        ? toFormValues(note, contact, linkedInvoiceRef?.label ?? null)
        : undefined,
    [note, contact, linkedInvoiceRef],
  );

  if (!note) {
    return (
      <DocDetailPage
        backHref={CREDIT_NOTES_PATH}
        backLabel="Credit notes"
        docNumber="Credit note"
        entitySingular="Credit note"
        statuses={CREDIT_NOTE_STATUSES}
        flow={CREDIT_NOTE_FLOW}
        status="draft"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Credit note not found.'}
      />
    );
  }

  const status = (note.status ?? 'draft') as CreditNoteStatus;
  const total = note.totals?.total ?? 0;
  const subTotal = note.totals?.subTotal ?? total;
  // Σ line totals − subTotal = Σ per-line tax (each line.total is
  // taxable + tax while subTotal is Σ taxable).
  const lineTotalSum = (note.items ?? []).reduce(
    (s, item) => s + (item.total ?? 0),
    0,
  );
  const taxTotal = Math.max(0, lineTotalSum - subTotal);

  const transition = (next: CreditNoteStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmCreditNoteStatus(note._id, next);
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
      const res = await deleteSabcrmCreditNote(note._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${note.cnNo} deleted.`);
      router.push(CREDIT_NOTES_PATH);
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
      onSelect: () => transition('draft', `${note.cnNo} reopened as draft.`),
    });
  }
  if (status === 'draft' || status === 'issued') {
    menuItems.push({
      key: 'cancel',
      label: 'Cancel credit note',
      icon: XCircle,
      danger: true,
      group: menuItems.length > 0,
      onSelect: () => transition('cancelled', `${note.cnNo} cancelled.`),
    });
  }
  menuItems.push({
    key: 'delete',
    label: 'Delete credit note',
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
          onClick={() => transition('issued', `${note.cnNo} issued.`)}
        >
          Issue credit note
        </Button>
      ) : null}
      {status === 'issued' ? (
        <Button
          variant="primary"
          iconLeft={Undo2}
          loading={transitioning}
          onClick={() =>
            transition('refunded', `${note.cnNo} marked as refunded.`)
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
    { label: 'Credit note date', value: formatDocDate(note.date) },
    { label: 'Reason', value: creditNoteReasonLabel(note.reason) },
    { label: 'Refund mode', value: creditNoteRefundModeLabel(note.refundMode) },
    ...(note.refundTxnId
      ? [{ label: 'Refund txn', value: note.refundTxnId }]
      : []),
    { label: 'Currency', value: note.currency },
    ...(note.exchangeRate
      ? [{ label: 'Exchange rate', value: String(note.exchangeRate) }]
      : []),
    ...(note.taxRecalc ? [{ label: 'Tax recalc', value: 'Yes' }] : []),
    ...(note.autoApply
      ? [{ label: 'Auto-apply', value: 'Next invoice' }]
      : []),
  ];

  /* ---- activity ---- */
  const createdAt = note.audit?.createdAt ?? note.createdAt;
  const activity: DocActivityEntry[] = [];
  if (createdAt) {
    activity.push({
      id: 'created',
      icon: FilePenLine,
      title: 'Credit note created',
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
        backHref={CREDIT_NOTES_PATH}
        backLabel="Credit notes"
        docNumber={note.cnNo}
        entitySingular="Credit note"
        statuses={CREDIT_NOTE_STATUSES}
        flow={CREDIT_NOTE_FLOW}
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
        config={baseCreditNoteFormConfig()}
        onSubmit={async (values) => {
          const extras = readCreditNoteExtras(values.extras);
          const problem = validateCreditNoteExtras(extras);
          if (problem) return { ok: false, error: problem };
          const res = await updateSabcrmCreditNoteFull(note._id, {
            cnNo: values.number,
            clientId: values.partyId ?? undefined,
            currency: values.currency,
            date: values.date,
            reason: extras.reason!,
            refundMode: extras.refundMode!,
            refundTxnId: extras.refundTxnId,
            taxRecalc: extras.taxRecalc,
            autoApply: extras.autoApply,
            linkedInvoiceId: extras.linkedInvoiceId ?? '',
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            totalsModifiers: values.modifiers ?? {},
            notes: values.customerNotes,
          });
          if (!res.ok) return res;
          toast.success(`${res.data.cnNo} updated.`);
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
            <AlertDialogTitle>Delete {note.cnNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the credit note from this workspace.
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
              Delete credit note
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
