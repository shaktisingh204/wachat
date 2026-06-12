'use client';

/**
 * SabCRM Finance — Payout detail client (spec §3.8).
 *
 * Composes the doc-surface DocDetailPage with the payout workflow:
 *
 *   - status transitions per the crate vocabulary (mark cleared, mark
 *     failed, retry) — validated again server-side;
 *   - Edit → the shared payout DocForm drawer, fully unlocked (the
 *     crate's UpdatePayoutInput patches every field, unlike receipts);
 *   - Print → `window.print()` over the kit's print-friendly paper;
 *   - Delete → HARD delete (payout-style wire, not an archive);
 *   - allocation rail card (resolved bill numbers + amounts) and the
 *     lineage rail (parent bills), plus an activity feed.
 *
 * Money block: subtotal = amount disbursed, adjustment = −TDS withheld,
 * total = net paid to the vendor.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  CheckCircle2,
  FilePenLine,
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
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  toast,
} from '@/components/sabcrm/20ui';

import type {
  CrmPayoutDoc,
  CrmPayoutStatus,
} from '@/lib/rust-client/crm-payouts';
import {
  transitionSabcrmPayoutStatus,
  updateSabcrmPayoutFull,
} from '@/app/actions/sabcrm-finance-payouts.actions';
import { deleteSabcrmPayout } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmPayoutAllocationView,
  SabcrmPayoutRelatedRef,
} from '@/app/actions/sabcrm-finance-payouts.actions.types';
import type { SabcrmPaymentAccountOption } from '@/app/actions/sabcrm-finance-invoices.actions.types';

import {
  ConvertMenu,
  DocDetailPage,
  DocForm,
  formatDocDate,
  formatDocMoney,
  type ConvertMenuItem,
  type DocActivityEntry,
  type DocEntityOption,
} from '../../_components/doc-surface';
import {
  PAYOUTS_PATH,
  PAYOUT_FLOW,
  PAYOUT_STATUSES,
  payoutModeLabel,
} from '../payout-config';
import { buildPayoutFormConfig, payoutDocToFormValues, payoutFormToInput } from '../payout-form';

/* ─── Main client ─────────────────────────────────────────────── */

export interface PayoutDetailClientProps {
  payout: CrmPayoutDoc | null;
  vendor: DocEntityOption | null;
  bankAccountLabel: string | null;
  allocations: SabcrmPayoutAllocationView[];
  related: SabcrmPayoutRelatedRef[];
  paymentAccounts: SabcrmPaymentAccountOption[];
  error: string | null;
}

export function PayoutDetailClient({
  payout,
  vendor,
  bankAccountLabel,
  allocations,
  related,
  paymentAccounts,
  error,
}: PayoutDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  // Stable identity so DocForm's open-reset effect doesn't re-fire
  // while the user is typing.
  const editSeed = React.useMemo(() => {
    if (!payout) return undefined;
    const billLabels = new Map<string, string | null>(
      allocations.map((a) => [a.billId, a.billLabel]),
    );
    return payoutDocToFormValues(payout, vendor?.label ?? null, billLabels);
  }, [payout, vendor, allocations]);

  const formConfig = React.useMemo(
    () => buildPayoutFormConfig(paymentAccounts, 'edit'),
    [paymentAccounts],
  );

  if (!payout) {
    return (
      <DocDetailPage
        backHref={PAYOUTS_PATH}
        backLabel="Payouts"
        docNumber="Payout"
        entitySingular="Payout"
        statuses={PAYOUT_STATUSES}
        flow={PAYOUT_FLOW}
        status="sent"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Payout not found.'}
      />
    );
  }

  const status = (payout.status ?? 'sent') as CrmPayoutStatus;
  const amount = payout.amount ?? 0;
  const tds = payout.tdsDeducted ?? 0;
  const netPaid = amount - tds;
  const allocated = allocations.reduce((s, a) => s + a.amount, 0);
  const unallocated = Math.max(0, amount - allocated);

  const transition = (next: CrmPayoutStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmPayoutStatus(payout._id, next);
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
      const res = await deleteSabcrmPayout(payout._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${payout.paymentNo} deleted.`);
      router.push(PAYOUTS_PATH);
      router.refresh();
    });
  };

  /* ---- actions bar ---- */
  const menuItems: ConvertMenuItem[] = [];
  if (status === 'sent') {
    menuItems.push({
      key: 'fail',
      label: 'Mark as failed',
      description: 'Bounced / returned by the bank',
      icon: XCircle,
      danger: true,
      onSelect: () =>
        transition('failed', `${payout.paymentNo} marked failed.`),
    });
  }
  menuItems.push({
    key: 'delete',
    label: 'Delete payout',
    icon: Trash2,
    danger: true,
    group: menuItems.length > 0,
    onSelect: () => setConfirmDelete(true),
  });

  const actions = (
    <>
      {status === 'sent' ? (
        <Button
          variant="primary"
          iconLeft={CheckCircle2}
          loading={transitioning}
          onClick={() =>
            transition('cleared', `${payout.paymentNo} marked cleared.`)
          }
        >
          Mark cleared
        </Button>
      ) : null}
      {status === 'failed' ? (
        <Button
          variant="primary"
          iconLeft={RotateCcw}
          loading={transitioning}
          onClick={() => transition('sent', `${payout.paymentNo} re-sent.`)}
        >
          Retry payout
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

  /* ---- paper meta ---- */
  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Payout date', value: formatDocDate(payout.date) },
    { label: 'Mode', value: payoutModeLabel(payout.mode) },
    {
      label: 'Paid from',
      value: bankAccountLabel ?? (
        <span className="fdoc-unknown-party">Unknown account</span>
      ),
    },
    { label: 'Currency', value: payout.currency || 'INR' },
    ...(payout.exchangeRate
      ? [{ label: 'Exchange rate', value: String(payout.exchangeRate) }]
      : []),
    ...(payout.chequeNo
      ? [{ label: 'Cheque no.', value: payout.chequeNo }]
      : []),
    ...(payout.chequeDate
      ? [{ label: 'Cheque date', value: formatDocDate(payout.chequeDate) }]
      : []),
    ...(payout.txnId ? [{ label: 'Transaction id', value: payout.txnId }] : []),
    ...(payout.reference
      ? [{ label: 'Reference', value: payout.reference }]
      : []),
    ...(payout.excessAsAdvance
      ? [
          {
            label: 'Excess',
            value: `Parked as vendor advance${
              unallocated > 0
                ? ` (${formatDocMoney(unallocated, payout.currency || 'INR')})`
                : ''
            }`,
          },
        ]
      : []),
  ];

  /* ---- activity ---- */
  const createdAt = payout.audit?.createdAt ?? payout.createdAt;
  const activity: DocActivityEntry[] = [];
  if (createdAt) {
    activity.push({
      id: 'created',
      icon: FilePenLine,
      title: 'Payout recorded',
      at: createdAt,
    });
  }
  for (const a of allocations) {
    activity.push({
      id: `alloc-${a.billId}`,
      icon: Banknote,
      title: `Applied ${formatDocMoney(a.amount, payout.currency || 'INR')} to ${a.billLabel ?? 'a bill'}`,
      at: payout.date,
    });
  }

  /* ---- rail: allocations card ---- */
  const railExtra = (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <Banknote size={14} aria-hidden="true" /> Bill allocations
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody>
        {allocations.length === 0 ? (
          <span className="fdoc-cell-sub">
            Not applied to any bills — the full amount is unallocated.
          </span>
        ) : (
          <ul className="fdoc-rail-list">
            {allocations.map((a) => (
              <li key={a.billId} className="fdoc-rail-item">
                <span>
                  {a.billLabel ?? (
                    <span className="fdoc-unknown-party">Unknown bill</span>
                  )}
                  {a.billStatus ? (
                    <span className="fdoc-rail-item__kind">
                      {a.billStatus.replaceAll('_', ' ')}
                    </span>
                  ) : null}
                </span>
                <span className="fdoc-rail-item__amount">
                  {formatDocMoney(a.amount, payout.currency || 'INR')}
                </span>
              </li>
            ))}
            {unallocated > 0 ? (
              <li className="fdoc-rail-item">
                <span className="fdoc-cell-sub">Unallocated</span>
                <span className="fdoc-rail-item__amount">
                  {formatDocMoney(unallocated, payout.currency || 'INR')}
                </span>
              </li>
            ) : null}
          </ul>
        )}
        {payout.excessAsAdvance && unallocated > 0 ? (
          <div className="mt-2">
            <Badge tone="info">Excess parked as advance</Badge>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );

  return (
    <>
      <DocDetailPage
        backHref={PAYOUTS_PATH}
        backLabel="Payouts"
        docNumber={payout.paymentNo}
        entitySingular="Payout"
        statuses={PAYOUT_STATUSES}
        flow={PAYOUT_FLOW}
        status={status}
        actions={actions}
        party={
          vendor
            ? {
                label: vendor.label,
                href: null,
                meta: 'Vendor',
              }
            : null
        }
        meta={meta}
        currency={payout.currency || 'INR'}
        lines={[]}
        totals={{
          subTotal: amount,
          adjustment: tds > 0 ? -tds : undefined,
          total: netPaid,
        }}
        notes={payout.notes}
        related={related}
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
          const mapped = payoutFormToInput(values);
          if (!mapped.ok) return mapped;
          const res = await updateSabcrmPayoutFull(payout._id, mapped.input);
          if (!res.ok) return res;
          toast.success(`${res.data.paymentNo} updated.`);
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
            <AlertDialogTitle>Delete {payout.paymentNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              Payouts are permanently removed (hard delete) — this cannot be
              undone. Bill statuses this payout flipped are not reverted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete payout
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
