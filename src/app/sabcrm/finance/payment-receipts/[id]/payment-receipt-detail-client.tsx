'use client';

/**
 * SabCRM Finance — Payment-receipt detail client.
 *
 * Composes the doc-surface DocDetailPage with the receipt's workflow
 * (finance-rollout spec §3.7):
 *
 *   - status transitions per the crate vocabulary (clear, bounce,
 *     reopen) — validated again server-side;
 *   - print-friendly paper: no line items — the money story renders as
 *     meta rows (mode, account, identifiers, FX) + a custom totals
 *     block (amount − TDS − bank charges = net);
 *   - allocation rail card: every `applyTo` invoice resolved to its
 *     number with a link + the applied amount, plus the
 *     excess-as-advance flag;
 *   - Edit → the same DocForm drawer the list uses, seeded from the
 *     document with the G4 financial-identity fields locked.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
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
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  toast,
} from '@/components/sabcrm/20ui';

import type {
  CrmReceiptStatus,
  CrmPaymentReceiptDoc,
} from '@/lib/rust-client/crm-payment-receipts';
import {
  transitionSabcrmPaymentReceiptStatus,
  updateSabcrmPaymentReceiptFull,
} from '@/app/actions/sabcrm-finance-payment-receipts.actions';
import { searchSabcrmFinanceParties } from '@/app/actions/sabcrm-finance-invoices.actions';
import { deleteSabcrmPaymentReceipt } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmPartyContact,
  SabcrmPaymentAccountOption,
  SabcrmRelatedDocRef,
} from '@/app/actions/sabcrm-finance-invoices.actions.types';
import type { SabcrmReceiptAllocationRef } from '@/app/actions/sabcrm-finance-payment-receipts.actions.types';
import { round2, safeNum } from '@/lib/sabcrm/finance-doc-math';

import {
  ConvertMenu,
  DocDetailPage,
  DocForm,
  formatDocDate,
  formatDocMoney,
  type ConvertMenuItem,
  type DocActivityEntry,
  type DocFormValues,
} from '../../_components/doc-surface';
import {
  RECEIPT_FLOW,
  RECEIPT_STATUSES,
  RECEIPTS_PATH,
  partyRecordHref,
  receiptModeLabel,
  type ReceiptFormExtras,
  readReceiptExtras,
} from '../receipt-config';
import { buildReceiptExtraFields } from '../receipt-form-extras';

/* ─── Form seeding ────────────────────────────────────────────── */

/** Doc → DocForm seed (extras carry the receipt-specific fields). */
function toFormValues(
  doc: CrmPaymentReceiptDoc,
  contact: SabcrmPartyContact | null,
  allocations: SabcrmReceiptAllocationRef[],
): DocFormValues {
  const extras: ReceiptFormExtras = {
    mode: doc.mode ?? 'upi',
    bankAccountId: doc.bankAccountId || null,
    amount: String(doc.amount ?? ''),
    exchangeRate: doc.exchangeRate !== undefined ? String(doc.exchangeRate) : '',
    chequeNo: doc.chequeNo ?? '',
    chequeDate: (doc.chequeDate ?? '').slice(0, 10),
    txnId: doc.txnId ?? '',
    reference: doc.reference ?? '',
    tdsDeducted: doc.tdsDeducted !== undefined ? String(doc.tdsDeducted) : '',
    bankCharges: doc.bankCharges !== undefined ? String(doc.bankCharges) : '',
    excessAsAdvance: !!doc.excessAsAdvance,
    allocations: (doc.applyTo ?? []).map((row, i) => ({
      rowId: `seed-${i}`,
      docId: row.invoiceId,
      docLabel:
        allocations.find((a) => a.invoiceId === row.invoiceId)?.invoiceNo ??
        'Invoice',
      amount: row.amount,
    })),
  };
  return {
    number: doc.receiptNo,
    partyId: doc.clientId || null,
    partyLabel: contact?.label ?? null,
    currency: doc.currency || 'INR',
    date: (doc.date ?? '').slice(0, 10),
    dueDate: '',
    lines: [],
    paymentTerms: '',
    customerNotes: doc.notes ?? '',
    termsAndConditions: '',
    attachments: (doc.attachments ?? [])
      .map((a) => a as { fileId?: string; name?: string; mimeType?: string; size?: number })
      .filter((a): a is { fileId: string; name?: string; mimeType?: string; size?: number } =>
        Boolean(a && typeof a.fileId === 'string'),
      )
      .map((a) => ({
        fileId: a.fileId,
        name: a.name,
        mimeType: a.mimeType,
        size: a.size,
      })),
    extras: { ...extras },
  };
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface PaymentReceiptDetailClientProps {
  receipt: CrmPaymentReceiptDoc | null;
  contact: SabcrmPartyContact | null;
  related: SabcrmRelatedDocRef[];
  allocations: SabcrmReceiptAllocationRef[];
  accounts: SabcrmPaymentAccountOption[];
  error: string | null;
}

export function PaymentReceiptDetailClient({
  receipt,
  contact,
  related,
  allocations,
  accounts,
  error,
}: PaymentReceiptDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  const editSeed = React.useMemo(
    () => (receipt ? toFormValues(receipt, contact, allocations) : undefined),
    [receipt, contact, allocations],
  );

  if (!receipt) {
    return (
      <DocDetailPage
        backHref={RECEIPTS_PATH}
        backLabel="Payment receipts"
        docNumber="Receipt"
        entitySingular="Payment receipt"
        statuses={RECEIPT_STATUSES}
        flow={RECEIPT_FLOW}
        status="received"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Receipt not found.'}
      />
    );
  }

  const status = (receipt.status ?? 'received') as CrmReceiptStatus;
  const amount = receipt.amount ?? 0;
  const tds = receipt.tdsDeducted ?? 0;
  const charges = receipt.bankCharges ?? 0;
  const deductions = round2(tds + charges);
  const net = round2(amount - deductions);
  const currency = receipt.currency || 'INR';
  const accountLabel =
    accounts.find((a) => a.id === receipt.bankAccountId)?.label ?? null;
  const allocated = round2(
    (receipt.applyTo ?? []).reduce((s, r) => s + (r.amount ?? 0), 0),
  );
  const unallocated = round2(amount - allocated);

  const transition = (next: CrmReceiptStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmPaymentReceiptStatus(
        receipt._id,
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
      const res = await deleteSabcrmPaymentReceipt(receipt._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${receipt.receiptNo} deleted.`);
      router.push(RECEIPTS_PATH);
      router.refresh();
    });
  };

  /* ---- actions bar ---- */
  const menuItems: ConvertMenuItem[] = [];
  if (status === 'received') {
    menuItems.push({
      key: 'bounce',
      label: 'Mark as bounced',
      description: 'The payment failed or the cheque bounced',
      icon: AlertTriangle,
      danger: true,
      onSelect: () =>
        transition('bounced', `${receipt.receiptNo} marked as bounced.`),
    });
  }
  if (status === 'bounced') {
    menuItems.push({
      key: 'reopen',
      label: 'Reopen as received',
      icon: RotateCcw,
      onSelect: () =>
        transition('received', `${receipt.receiptNo} reopened as received.`),
    });
  }
  menuItems.push({
    key: 'delete',
    label: 'Delete receipt',
    icon: Trash2,
    danger: true,
    group: menuItems.length > 0,
    onSelect: () => setConfirmDelete(true),
  });

  const actions = (
    <>
      {status === 'received' ? (
        <Button
          variant="primary"
          iconLeft={CheckCircle2}
          loading={transitioning}
          onClick={() =>
            transition('cleared', `${receipt.receiptNo} marked as cleared.`)
          }
        >
          Mark cleared
        </Button>
      ) : null}
      <Button
        variant="secondary"
        iconLeft={Printer}
        onClick={() => window.print()}
      >
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

  /* ---- paper meta (full field coverage) ---- */
  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Receipt date', value: formatDocDate(receipt.date) },
    { label: 'Mode', value: receiptModeLabel(receipt.mode) },
    {
      label: 'Deposited to',
      value: accountLabel ?? (
        <span className="fdoc-unknown-party">Unknown account</span>
      ),
    },
    { label: 'Currency', value: currency },
    ...(receipt.exchangeRate
      ? [{ label: 'Exchange rate', value: String(receipt.exchangeRate) }]
      : []),
    ...(receipt.chequeNo
      ? [{ label: 'Cheque no.', value: receipt.chequeNo }]
      : []),
    ...(receipt.chequeDate
      ? [{ label: 'Cheque date', value: formatDocDate(receipt.chequeDate) }]
      : []),
    ...(receipt.txnId ? [{ label: 'Transaction id', value: receipt.txnId }] : []),
    ...(receipt.reference
      ? [{ label: 'Reference', value: receipt.reference }]
      : []),
    ...(tds > 0
      ? [{ label: 'TDS deducted', value: formatDocMoney(tds, currency) }]
      : []),
    ...(charges > 0
      ? [{ label: 'Bank charges', value: formatDocMoney(charges, currency) }]
      : []),
    ...(receipt.excessAsAdvance
      ? [
          {
            label: 'Excess handling',
            value: 'Parked as customer advance',
          },
        ]
      : []),
  ];

  /* ---- activity ---- */
  const createdAt = receipt.audit?.createdAt ?? receipt.createdAt;
  const updatedAt = receipt.audit?.updatedAt ?? receipt.updatedAt;
  const activity: DocActivityEntry[] = [];
  if (createdAt) {
    activity.push({
      id: 'created',
      icon: Banknote,
      title: 'Receipt recorded',
      at: createdAt,
    });
  }
  if (updatedAt && updatedAt !== createdAt) {
    activity.push({
      id: 'updated',
      icon: FilePenLine,
      title: 'Receipt updated',
      at: updatedAt,
    });
  }

  /* ---- allocation rail card ---- */
  const railExtra = (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <Banknote size={14} aria-hidden="true" /> Applied to invoices
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody>
        {allocations.length === 0 ? (
          <span className="fdoc-cell-sub">
            Not applied to any invoice — the full amount is unallocated
            {receipt.excessAsAdvance ? ' (parked as advance)' : ''}.
          </span>
        ) : (
          <>
            <ul className="fdoc-rail-list">
              {allocations.map((alloc) => {
                const inner = (
                  <>
                    <span>
                      {alloc.invoiceNo ?? (
                        <span className="fdoc-unknown-party">
                          Missing invoice
                        </span>
                      )}
                      {alloc.status ? (
                        <span className="fdoc-rail-item__kind">
                          {alloc.status.replaceAll('_', ' ')}
                        </span>
                      ) : null}
                    </span>
                    <span className="fdoc-rail-item__amount">
                      {formatDocMoney(alloc.amount, currency)}
                    </span>
                  </>
                );
                return (
                  <li key={alloc.invoiceId}>
                    {alloc.href ? (
                      <Link href={alloc.href} className="fdoc-rail-item">
                        {inner}
                      </Link>
                    ) : (
                      <span className="fdoc-rail-item">{inner}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex items-center justify-between">
              <span className="fdoc-cell-sub">
                {formatDocMoney(allocated, currency)} allocated ·{' '}
                {formatDocMoney(Math.max(unallocated, 0), currency)} unallocated
              </span>
              {receipt.excessAsAdvance && unallocated > 0 ? (
                <Badge tone="info">Excess as advance</Badge>
              ) : null}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );

  return (
    <>
      <DocDetailPage
        backHref={RECEIPTS_PATH}
        backLabel="Payment receipts"
        docNumber={receipt.receiptNo}
        entitySingular="Payment receipt"
        statuses={RECEIPT_STATUSES}
        flow={RECEIPT_FLOW}
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
        currency={currency}
        lines={[]}
        totals={{
          subTotal: amount,
          adjustment: deductions > 0 ? -deductions : undefined,
          total: net,
        }}
        notes={receipt.notes}
        related={related}
        activity={activity}
        railExtra={railExtra}
      />

      <DocForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialValues={editSeed}
        config={{
          entitySingular: 'Receipt',
          numberLabel: 'Receipt number',
          partyLabel: 'Customer',
          partyPlaceholder: 'Search companies & people…',
          dateLabel: 'Receipt date',
          dueDateLabel: 'Due date',
          hideDueDate: true,
          hideLines: true,
          hidePaymentTerms: true,
          notesLabel: 'Notes',
          searchParties: async (q) => {
            const res = await searchSabcrmFinanceParties(q);
            return res.ok ? res.data : [];
          },
          extraFields: buildReceiptExtraFields({ accounts, locked: true }),
        }}
        onSubmit={async (values) => {
          // G4 locks: customer / currency / amount / mode / allocations
          // can't change post-creation — surface a clear error instead
          // of silently ignoring an edit.
          if ((values.partyId ?? '') !== (receipt.clientId ?? '')) {
            return {
              ok: false,
              error:
                "The customer can't be changed on a receipt — delete and recreate it instead.",
            };
          }
          if (values.currency !== (receipt.currency || 'INR')) {
            return {
              ok: false,
              error:
                "The currency can't be changed on a receipt — delete and recreate it instead.",
            };
          }
          const extras = readReceiptExtras(values.extras);
          if (!extras.bankAccountId) {
            return {
              ok: false,
              error: 'Pick the account that received this payment.',
            };
          }
          const res = await updateSabcrmPaymentReceiptFull(receipt._id, {
            receiptNo: values.number,
            date: values.date,
            bankAccountId: extras.bankAccountId,
            chequeNo: extras.chequeNo,
            chequeDate: extras.chequeDate || undefined,
            txnId: extras.txnId,
            reference: extras.reference,
            exchangeRate: extras.exchangeRate
              ? safeNum(extras.exchangeRate)
              : undefined,
            tdsDeducted: extras.tdsDeducted
              ? safeNum(extras.tdsDeducted)
              : undefined,
            bankCharges: extras.bankCharges
              ? safeNum(extras.bankCharges)
              : undefined,
            notes: values.customerNotes,
            attachments: values.attachments,
          });
          if (!res.ok) return res;
          toast.success(`${res.data.receiptNo} updated.`);
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
            <AlertDialogTitle>Delete {receipt.receiptNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the receipt from this workspace.
              Invoice balances already updated by this receipt are NOT rolled
              back. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete receipt
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
