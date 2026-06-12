'use client';

/**
 * SabCRM Finance — Bill detail client.
 *
 * Composes the doc-surface DocDetailPage with the AP workflow
 * (finance-rollout spec §3.6):
 *
 *   - status transitions per the crate vocabulary (submit, approve,
 *     mark overdue, cancel, reopen) — validated again server-side;
 *   - Record payout → creates a real `crm-payouts` document (applyTo +
 *     lineage) against a REAL picked payment account, then flips the
 *     bill to paid / partially-paid from the cumulative allocations;
 *   - Create debit note → deep-links into the debit-notes surface with
 *     `?fromBill=<id>` (linked bill + vendor + currency prefilled);
 *   - Print → `window.print()` (kit print rules keep only the paper);
 *   - Edit → the same DocForm drawer the list uses, seeded from the
 *     document (items + expense lines + TDS / FX / reverse-charge);
 *   - related rail (PO / GRN parents, payout + debit-note children) and
 *     an activity feed. The paid total / balance shown on the paper are
 *     derived from the payout children — `Bill.amountPaid` is not yet
 *     engine-maintained (Rust gap).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  CheckCircle2,
  FileMinus2,
  FilePenLine,
  Printer,
  Repeat,
  RotateCcw,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';

import {
  Alert,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  SelectField,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import type { CrmBillDoc, CrmBillStatus } from '@/lib/rust-client/crm-bills';
import type { CrmPayoutMode } from '@/lib/rust-client/crm-payouts';
import {
  recordSabcrmBillPayout,
  transitionSabcrmBillStatus,
  updateSabcrmBillFull,
} from '@/app/actions/sabcrm-finance-bills.actions';
import { deleteSabcrmBill } from '@/app/actions/sabcrm-finance.actions';
import { SABCRM_BILL_PAYABLE_STATUSES } from '@/app/actions/sabcrm-finance-bills.actions.types';
import type {
  SabcrmPaymentAccountOption,
  SabcrmRelatedDocRef,
} from '@/app/actions/sabcrm-finance-invoices.actions.types';
import type { DocEntityOption } from '@/app/sabcrm/finance/_components/doc-surface/types';
import {
  isBlankDocLine,
  round2,
  safeNum,
} from '@/lib/sabcrm/finance-doc-math';

import {
  ConvertMenu,
  DocDetailPage,
  DocForm,
  blankDocLine,
  formatDocDate,
  formatDocMoney,
  type ConvertMenuItem,
  type DocActivityEntry,
  type DocDetailLine,
  type DocFormValues,
  type DocLineDraft,
} from '../../_components/doc-surface';
import { BILLS_PATH, BILL_FLOW, BILL_STATUSES } from '../bill-config';
import {
  baseBillFormConfig,
  blankBillExpenseLine,
  readBillExtras,
  toExpenseLineInputs,
  validateBillValues,
  type BillExpenseLineDraft,
} from '../bill-form';

/* ─── Helpers ─────────────────────────────────────────────────── */

const MODE_OPTIONS: SelectOption[] = [
  { value: 'upi', label: 'UPI' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'imps', label: 'IMPS' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'wallet', label: 'Wallet' },
];

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Doc → DocForm seed (items + expense lines + header extras). */
function toFormValues(
  doc: CrmBillDoc,
  vendor: DocEntityOption | null,
  expenseAccounts: DocEntityOption[],
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
  const accountMap = new Map(expenseAccounts.map((a) => [a.id, a]));
  const expenseLines: BillExpenseLineDraft[] = (doc.expenseLines ?? []).map(
    (line, i) => ({
      rowId: `seed-exp-${i}`,
      accountId: line.accountId ?? null,
      accountLabel: line.accountId
        ? (accountMap.get(line.accountId)?.label ?? null)
        : null,
      description: line.description ?? '',
      amount: String(line.amount ?? ''),
      taxRatePct:
        line.taxRatePct === undefined ? '' : String(line.taxRatePct),
    }),
  );
  return {
    number: doc.billNo ?? '',
    partyId: doc.vendorId || null,
    partyLabel: vendor?.label ?? null,
    currency: doc.currency,
    date: (doc.billDate ?? '').slice(0, 10),
    dueDate: (doc.dueDate ?? '').slice(0, 10),
    lines: lines.length > 0 ? lines : [blankDocLine()],
    paymentTerms: '',
    customerNotes: doc.notes ?? '',
    termsAndConditions: '',
    attachments: [],
    placeOfSupply: doc.placeOfSupply ?? '',
    modifiers: {
      discountOverall: doc.totals?.discountOverall || undefined,
      shippingCharge: doc.totals?.shippingCharge || undefined,
      adjustment: doc.totals?.adjustment || undefined,
      roundOff: !!doc.totals?.roundOff,
    },
    extras: {
      vendorInvoiceNo: doc.vendorInvoiceNo ?? '',
      exchangeRate:
        doc.exchangeRate === undefined ? '' : String(doc.exchangeRate),
      tdsSection: doc.tdsSection ?? '',
      tdsAmount: doc.tdsAmount === undefined ? '' : String(doc.tdsAmount),
      reverseCharge: doc.reverseCharge === true,
      expenseLines:
        expenseLines.length > 0 ? expenseLines : [blankBillExpenseLine()],
    },
  };
}

/* ─── Record-payout dialog ────────────────────────────────────── */

interface PayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: CrmBillDoc;
  /** Outstanding balance derived from payout allocations. */
  balance: number;
  accounts: SabcrmPaymentAccountOption[];
  onDone: () => void;
}

function PayoutDialog({
  open,
  onOpenChange,
  bill,
  balance,
  accounts,
  onDone,
}: PayoutDialogProps): React.JSX.Element {
  const [amount, setAmount] = React.useState(String(Math.max(balance, 0) || ''));
  const [date, setDate] = React.useState(todayKey());
  const [mode, setMode] = React.useState<string | null>('neft');
  const [accountId, setAccountId] = React.useState<string | null>(
    accounts[0]?.id ?? null,
  );
  const [reference, setReference] = React.useState('');
  const [tdsWithheld, setTdsWithheld] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setAmount(String(Math.max(balance, 0) || ''));
    setDate(todayKey());
    setMode('neft');
    setAccountId(accounts[0]?.id ?? null);
    setReference('');
    setTdsWithheld('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const accountOptions: SelectOption[] = accounts.map((a) => ({
    value: a.id,
    label: a.label,
  }));

  const billLabel = bill.billNo || bill.vendorInvoiceNo || 'this bill';

  const submit = (): void => {
    const parsed = safeNum(amount);
    if (parsed <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (!accountId) {
      setError('Pick the account this payout left from.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await recordSabcrmBillPayout(bill._id, {
        amount: parsed,
        date,
        mode: (mode ?? 'cash') as CrmPayoutMode,
        bankAccountId: accountId,
        reference: reference || undefined,
        tdsDeducted: tdsWithheld === '' ? undefined : safeNum(tdsWithheld),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        `Payout of ${formatDocMoney(parsed, bill.currency)} recorded.`,
      );
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="payout-desc">
        <DialogHeader>
          <DialogTitle>Record a payout</DialogTitle>
          <DialogDescription id="payout-desc">
            {billLabel} — balance due{' '}
            {formatDocMoney(Math.max(balance, 0), bill.currency)}. A payout is
            created and linked to this bill.
          </DialogDescription>
        </DialogHeader>

        {accounts.length === 0 ? (
          <Alert tone="warning" role="alert">
            No payment accounts yet — create one under{' '}
            <a href="/sabcrm/finance/payment-accounts">
              Finance → Payment accounts
            </a>{' '}
            first, so the payout leaves a real account.
          </Alert>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="flex flex-col gap-3 pb-2 pt-1">
              <Field label="Amount paid" required>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  disabled={pending}
                />
              </Field>
              <Field label="Payout date" required>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={pending}
                />
              </Field>
              <Field label="Mode" required>
                <SelectField
                  value={mode}
                  onChange={setMode}
                  options={MODE_OPTIONS}
                  disabled={pending}
                />
              </Field>
              <Field label="Paid from" required>
                <SelectField
                  value={accountId}
                  onChange={setAccountId}
                  options={accountOptions}
                  disabled={pending}
                />
              </Field>
              <Field label="Reference" help="UTR / transaction id (optional).">
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={pending}
                />
              </Field>
              <Field
                label="TDS withheld"
                help="Withholding deducted from this payout (optional)."
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={tdsWithheld}
                  onChange={(e) => setTdsWithheld(e.target.value)}
                  disabled={pending}
                />
              </Field>
              {error ? (
                <Alert tone="danger" role="alert">
                  {error}
                </Alert>
              ) : null}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" variant="primary" loading={pending}>
                Record payout
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface BillDetailClientProps {
  bill: CrmBillDoc | null;
  /** Resolved chart-of-accounts labels for the expense lines. */
  expenseAccounts: DocEntityOption[];
  /** Resolved vendor (label + meta) — never a raw ObjectId. */
  vendor: DocEntityOption | null;
  related: SabcrmRelatedDocRef[];
  paymentAccounts: SabcrmPaymentAccountOption[];
  error: string | null;
}

export function BillDetailClient({
  bill,
  expenseAccounts,
  vendor,
  related,
  paymentAccounts,
  error,
}: BillDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [payOpen, setPayOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  // Stable identity so DocForm's open-reset effect doesn't re-fire
  // while the user is typing.
  const editSeed = React.useMemo(
    () => (bill ? toFormValues(bill, vendor, expenseAccounts) : undefined),
    [bill, vendor, expenseAccounts],
  );

  if (!bill) {
    return (
      <DocDetailPage
        backHref={BILLS_PATH}
        backLabel="Bills"
        docNumber="Bill"
        entitySingular="Bill"
        statuses={BILL_STATUSES}
        flow={BILL_FLOW}
        status="draft"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Bill not found.'}
      />
    );
  }

  const status = (bill.status ?? 'draft') as CrmBillStatus;
  const billLabel = bill.billNo || bill.vendorInvoiceNo || 'Bill';
  const total = bill.totals?.total ?? 0;
  const subTotal = bill.totals?.subTotal ?? total;

  // Paid total derived from non-failed payout allocations (the engine
  // doesn't maintain Bill.amountPaid yet — Rust gap).
  const amountPaid = round2(
    related
      .filter((r) => r.kind === 'payout' && r.status !== 'failed')
      .reduce((s, r) => s + (r.amount ?? 0), 0),
  );
  const balance = status === 'paid' ? 0 : round2(Math.max(0, total - amountPaid));

  // Tax shown = Σ line totals + Σ expense (amount + tax) − subTotal.
  const lineTotalSum = (bill.items ?? []).reduce(
    (s, item) => s + (item.total ?? 0),
    0,
  );
  const expenseTotalSum = (bill.expenseLines ?? []).reduce((s, line) => {
    const tax = line.taxRatePct ? (line.amount * line.taxRatePct) / 100 : 0;
    return s + line.amount + tax;
  }, 0);
  const taxTotal = Math.max(
    0,
    round2(lineTotalSum + expenseTotalSum - subTotal),
  );

  const transition = (next: CrmBillStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmBillStatus(bill._id, next);
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
      const res = await deleteSabcrmBill(bill._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${billLabel} deleted.`);
      router.push(BILLS_PATH);
      router.refresh();
    });
  };

  /* ---- actions bar ---- */
  const canPay = (
    SABCRM_BILL_PAYABLE_STATUSES as readonly CrmBillStatus[]
  ).includes(status);
  const canEdit = status !== 'paid' && status !== 'cancelled';

  const menuItems: ConvertMenuItem[] = [
    {
      key: 'debit-note',
      label: 'Create debit note',
      description: 'Returns / adjustments against this bill',
      icon: FileMinus2,
      onSelect: () =>
        router.push(
          `/sabcrm/finance/debit-notes?fromBill=${encodeURIComponent(bill._id)}`,
        ),
    },
  ];
  if (status === 'approved') {
    menuItems.push({
      key: 'overdue',
      label: 'Mark as overdue',
      icon: XCircle,
      group: true,
      onSelect: () => transition('overdue', `${billLabel} marked overdue.`),
    });
  }
  if (status === 'cancelled') {
    menuItems.push({
      key: 'reopen',
      label: 'Reopen as draft',
      icon: RotateCcw,
      group: true,
      onSelect: () => transition('draft', `${billLabel} reopened as draft.`),
    });
  }
  if (status !== 'cancelled' && status !== 'paid') {
    menuItems.push({
      key: 'cancel',
      label: 'Cancel bill',
      icon: XCircle,
      danger: true,
      group: true,
      onSelect: () => transition('cancelled', `${billLabel} cancelled.`),
    });
  }
  menuItems.push({
    key: 'delete',
    label: 'Delete bill',
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
          onClick={() =>
            transition('submitted', `${billLabel} submitted for approval.`)
          }
        >
          Submit
        </Button>
      ) : null}
      {status === 'submitted' ? (
        <Button
          variant="primary"
          iconLeft={CheckCircle2}
          loading={transitioning}
          onClick={() => transition('approved', `${billLabel} approved.`)}
        >
          Approve
        </Button>
      ) : null}
      {canPay ? (
        <Button
          variant="primary"
          iconLeft={Banknote}
          onClick={() => setPayOpen(true)}
        >
          Record payout
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

  /* ---- paper data: item lines + expense lines in one table ---- */
  const accountMap = new Map(expenseAccounts.map((a) => [a.id, a]));
  const lines: DocDetailLine[] = [
    ...(bill.items ?? []).map((item) => ({
      description: item.description ?? '',
      hsnSac: item.hsnSac,
      qty: item.qty,
      unit: item.unit,
      rate: item.rate,
      discountPct: item.discountPct,
      taxRatePct: item.taxRatePct,
      total: item.total,
    })),
    ...(bill.expenseLines ?? []).map((line) => {
      const account = line.accountId
        ? accountMap.get(line.accountId)
        : undefined;
      const tax = line.taxRatePct ? (line.amount * line.taxRatePct) / 100 : 0;
      return {
        description: line.description || account?.label || 'Expense',
        itemLabel: account ? `Ledger · ${account.label}` : 'Expense line',
        qty: 1,
        rate: line.amount,
        taxRatePct: line.taxRatePct,
        total: round2(line.amount + tax),
      };
    }),
  ];

  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Bill date', value: formatDocDate(bill.billDate) },
    ...(bill.dueDate
      ? [{ label: 'Due date', value: formatDocDate(bill.dueDate) }]
      : []),
    ...(bill.vendorInvoiceNo
      ? [{ label: 'Vendor invoice', value: bill.vendorInvoiceNo }]
      : []),
    { label: 'Currency', value: bill.currency },
    ...(bill.exchangeRate
      ? [{ label: 'Exchange rate', value: String(bill.exchangeRate) }]
      : []),
    ...(bill.placeOfSupply
      ? [{ label: 'Place of supply', value: bill.placeOfSupply }]
      : []),
    ...(bill.reverseCharge
      ? [{ label: 'Reverse charge', value: 'Yes' }]
      : []),
    ...(bill.tdsSection || bill.tdsAmount
      ? [
          {
            label: 'TDS',
            value: [
              bill.tdsSection,
              bill.tdsAmount !== undefined
                ? formatDocMoney(bill.tdsAmount, bill.currency)
                : null,
            ]
              .filter(Boolean)
              .join(' · '),
          },
        ]
      : []),
    ...(bill.recurring
      ? [
          {
            label: 'Recurring',
            value: (
              <Badge tone="info">
                <Repeat size={11} aria-hidden="true" />{' '}
                {bill.recurring.frequency}
              </Badge>
            ),
          },
        ]
      : []),
  ];

  /* ---- activity ---- */
  const createdAt = bill.audit?.createdAt ?? bill.createdAt;
  const activity: DocActivityEntry[] = [];
  if (createdAt) {
    activity.push({
      id: 'created',
      icon: FilePenLine,
      title: 'Bill created',
      at: createdAt,
    });
  }
  for (const ref of related.filter((r) => r.kind === 'payout')) {
    activity.push({
      id: `payout-${ref.id}`,
      icon: Banknote,
      title: `Payout ${ref.label}${
        ref.amount !== undefined
          ? ` — ${formatDocMoney(ref.amount, ref.currency ?? bill.currency)}`
          : ''
      }`,
      meta: ref.status,
      at: ref.date,
    });
  }
  for (const ref of related.filter((r) => r.kind === 'debitNote')) {
    activity.push({
      id: `dn-${ref.id}`,
      icon: FileMinus2,
      title: `Debit note ${ref.label}${
        ref.amount !== undefined
          ? ` — ${formatDocMoney(ref.amount, ref.currency ?? bill.currency)}`
          : ''
      }`,
      meta: ref.status,
      at: ref.date,
    });
  }
  activity.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));

  return (
    <>
      <DocDetailPage
        backHref={BILLS_PATH}
        backLabel="Bills"
        docNumber={billLabel}
        entitySingular="Bill"
        statuses={BILL_STATUSES}
        flow={BILL_FLOW}
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
        currency={bill.currency}
        lines={lines}
        totals={{
          subTotal,
          taxTotal,
          discountOverall: bill.totals?.discountOverall,
          shippingCharge: bill.totals?.shippingCharge,
          adjustment: bill.totals?.adjustment,
          roundOff: bill.totals?.roundOff,
          total,
          amountPaid,
          balance,
        }}
        notes={bill.notes}
        related={related}
        activity={activity}
      />

      <PayoutDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        bill={bill}
        balance={balance}
        accounts={paymentAccounts}
        onDone={refresh}
      />

      <DocForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialValues={editSeed}
        config={baseBillFormConfig('edit')}
        onSubmit={async (values) => {
          // billNo is immutable at the crate layer (stable AP doc
          // numbers) — reject edits instead of silently ignoring them.
          if (values.number.trim() !== (bill.billNo ?? '').trim()) {
            return {
              ok: false,
              error:
                'Bill numbers are immutable once created — cancel this bill and raise a new one instead.',
            };
          }
          const problem = validateBillValues(values);
          if (problem) return { ok: false, error: problem };
          const extras = readBillExtras(values.extras);
          const res = await updateSabcrmBillFull(bill._id, {
            vendorInvoiceNo: extras.vendorInvoiceNo,
            vendorId: values.partyId ?? undefined,
            currency: values.currency,
            exchangeRate:
              extras.exchangeRate === ''
                ? undefined
                : safeNum(extras.exchangeRate),
            billDate: values.date,
            dueDate: values.dueDate,
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            totalsModifiers: values.modifiers ?? {},
            expenseLines: toExpenseLineInputs(extras.expenseLines),
            tdsSection: extras.tdsSection,
            tdsAmount:
              extras.tdsAmount === '' ? undefined : safeNum(extras.tdsAmount),
            reverseCharge: extras.reverseCharge,
            placeOfSupply: values.placeOfSupply ?? '',
            notes: values.customerNotes,
          });
          if (!res.ok) return res;
          toast.success(`${billLabel} updated.`);
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
            <AlertDialogTitle>Delete {billLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the bill from this workspace. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete bill
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
