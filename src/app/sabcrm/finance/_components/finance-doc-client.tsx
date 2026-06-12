'use client';

/**
 * SabCRM Finance — shared document-list client, 20ui.
 *
 * One generic client for the tranche-1 finance document entities
 * (quotations, sales orders, credit notes, debit notes, payment
 * receipts, bills, proforma invoices). Mirrors the proving-vertical
 * `invoices-client.tsx` exactly — list table, "New <thing>" dialog
 * (number, amount, currency, date, status), per-row delete behind an
 * AlertDialog — but parameterised per entity via {@link DOC_CONFIGS}
 * so the seven pages stay thin and can't drift from each other.
 *
 * Data flows down from each server page; after a mutation the action
 * revalidates the entity's path and the client calls `router.refresh()`
 * so the table re-renders from fresh server props.
 *
 * ONLY `@/components/sabcrm/20ui` barrel imports (repo rule); auth /
 * onboarding / RBAC are enforced by the SabCRM layout, and every action
 * re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  FileText,
  Plus,
  Receipt,
  ReceiptIndianRupee,
  ShoppingCart,
  Trash2,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
  EmptyState,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type BadgeTone,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import {
  createSabcrmQuotation,
  createSabcrmSalesOrder,
  createSabcrmCreditNote,
  createSabcrmDebitNote,
  createSabcrmPaymentReceipt,
  createSabcrmBill,
  createSabcrmProformaInvoice,
  createSabcrmExpense,
  createSabcrmPayout,
  deleteSabcrmQuotation,
  deleteSabcrmSalesOrder,
  deleteSabcrmCreditNote,
  deleteSabcrmDebitNote,
  deleteSabcrmPaymentReceipt,
  deleteSabcrmBill,
  deleteSabcrmProformaInvoice,
  deleteSabcrmExpense,
  deleteSabcrmPayout,
} from '@/app/actions/sabcrm-finance.actions';
import type { SabcrmFinanceDocFormInput } from '@/app/actions/sabcrm-finance.actions.types';

import '@/components/sabcrm/20ui/surface-crm-base.css';

// ---------------------------------------------------------------------------
// Types + per-entity configuration
// ---------------------------------------------------------------------------

/** Flat row shape every server page narrows its documents into. */
export interface FinanceDocRow {
  id: string;
  /** Document number (quotationNo / soNo / cnNo / …). */
  number: string;
  /** Counterparty id (24-char hex client/vendor; may be a placeholder). */
  party: string;
  /** Document date (ISO instant). */
  date: string;
  amount: number;
  currency: string;
  status: string;
}

export type FinanceDocKind =
  | 'quotations'
  | 'sales-orders'
  | 'credit-notes'
  | 'debit-notes'
  | 'payment-receipts'
  | 'bills'
  | 'proforma-invoices'
  | 'expenses'
  | 'payouts';

type CreateResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

interface DocConfig {
  /** Page H1. */
  title: string;
  /** Page sub-line. */
  description: string;
  /** Lowercase singular, e.g. "quotation" (dialog + confirm copy). */
  singular: string;
  /** Document-number field label + placeholder. */
  numberLabel: string;
  numberPlaceholder: string;
  /** Party column header ("Customer" or "Vendor"). */
  partyLabel: string;
  emptyIcon: LucideIcon;
  statusTone: Record<string, BadgeTone>;
  statusLabel: Record<string, string>;
  /** Dialog status choices; first entry is the default. */
  statusOptions: SelectOption[];
  create: (input: SabcrmFinanceDocFormInput) => Promise<CreateResult>;
  remove: (id: string) => Promise<CreateResult>;
}

const DOC_CONFIGS: Record<FinanceDocKind, DocConfig> = {
  quotations: {
    title: 'Quotations',
    description:
      'Price quotes for this workspace — part of the SabCRM Finance suite.',
    singular: 'quotation',
    numberLabel: 'Quotation number',
    numberPlaceholder: 'QT-2026-0001',
    partyLabel: 'Customer',
    emptyIcon: FileText,
    statusTone: {
      draft: 'neutral',
      sent: 'info',
      accepted: 'success',
      rejected: 'danger',
      expired: 'warning',
      converted: 'success',
    },
    statusLabel: {
      draft: 'Draft',
      sent: 'Sent',
      accepted: 'Accepted',
      rejected: 'Rejected',
      expired: 'Expired',
      converted: 'Converted',
    },
    statusOptions: [
      { value: 'draft', label: 'Draft' },
      { value: 'sent', label: 'Sent' },
      { value: 'accepted', label: 'Accepted' },
    ],
    create: createSabcrmQuotation,
    remove: deleteSabcrmQuotation,
  },
  'sales-orders': {
    title: 'Sales orders',
    description:
      'Confirmed customer orders for this workspace — part of the SabCRM Finance suite.',
    singular: 'sales order',
    numberLabel: 'Order number',
    numberPlaceholder: 'SO-2026-0001',
    partyLabel: 'Customer',
    emptyIcon: ShoppingCart,
    statusTone: {
      open: 'info',
      partial: 'warning',
      fulfilled: 'success',
      closed: 'neutral',
      cancelled: 'neutral',
    },
    statusLabel: {
      open: 'Open',
      partial: 'Partial',
      fulfilled: 'Fulfilled',
      closed: 'Closed',
      cancelled: 'Cancelled',
    },
    statusOptions: [
      { value: 'open', label: 'Open' },
      { value: 'fulfilled', label: 'Fulfilled' },
      { value: 'closed', label: 'Closed' },
    ],
    create: createSabcrmSalesOrder,
    remove: deleteSabcrmSalesOrder,
  },
  'credit-notes': {
    title: 'Credit notes',
    description:
      'Customer credits and refunds for this workspace — part of the SabCRM Finance suite.',
    singular: 'credit note',
    numberLabel: 'Credit note number',
    numberPlaceholder: 'CN-2026-0001',
    partyLabel: 'Customer',
    emptyIcon: ArrowDownLeft,
    statusTone: {
      draft: 'neutral',
      issued: 'info',
      refunded: 'success',
      cancelled: 'neutral',
    },
    statusLabel: {
      draft: 'Draft',
      issued: 'Issued',
      refunded: 'Refunded',
      cancelled: 'Cancelled',
    },
    statusOptions: [
      { value: 'draft', label: 'Draft' },
      { value: 'issued', label: 'Issued' },
    ],
    create: createSabcrmCreditNote,
    remove: deleteSabcrmCreditNote,
  },
  'debit-notes': {
    title: 'Debit notes',
    description:
      'Vendor-side debits and returns for this workspace — part of the SabCRM Finance suite.',
    singular: 'debit note',
    numberLabel: 'Debit note number',
    numberPlaceholder: 'DN-2026-0001',
    partyLabel: 'Vendor',
    emptyIcon: ArrowUpRight,
    statusTone: {
      draft: 'neutral',
      issued: 'info',
      refunded: 'success',
      cancelled: 'neutral',
    },
    statusLabel: {
      draft: 'Draft',
      issued: 'Issued',
      refunded: 'Refunded',
      cancelled: 'Cancelled',
    },
    statusOptions: [
      { value: 'draft', label: 'Draft' },
      { value: 'issued', label: 'Issued' },
    ],
    create: createSabcrmDebitNote,
    remove: deleteSabcrmDebitNote,
  },
  'payment-receipts': {
    title: 'Payment receipts',
    description:
      'Money received against invoices in this workspace — part of the SabCRM Finance suite.',
    singular: 'payment receipt',
    numberLabel: 'Receipt number',
    numberPlaceholder: 'RCPT-2026-0001',
    partyLabel: 'Customer',
    emptyIcon: Receipt,
    statusTone: {
      received: 'info',
      cleared: 'success',
      bounced: 'danger',
    },
    statusLabel: {
      received: 'Received',
      cleared: 'Cleared',
      bounced: 'Bounced',
    },
    statusOptions: [
      { value: 'received', label: 'Received' },
      { value: 'cleared', label: 'Cleared' },
    ],
    create: createSabcrmPaymentReceipt,
    remove: deleteSabcrmPaymentReceipt,
  },
  bills: {
    title: 'Bills',
    description:
      'Vendor bills payable from this workspace — part of the SabCRM Finance suite.',
    singular: 'bill',
    numberLabel: 'Bill number',
    numberPlaceholder: 'BILL-2026-0001',
    partyLabel: 'Vendor',
    emptyIcon: ReceiptIndianRupee,
    statusTone: {
      draft: 'neutral',
      submitted: 'info',
      approved: 'info',
      paid: 'success',
      partially_paid: 'warning',
      overdue: 'danger',
      cancelled: 'neutral',
    },
    statusLabel: {
      draft: 'Draft',
      submitted: 'Submitted',
      approved: 'Approved',
      paid: 'Paid',
      partially_paid: 'Partially paid',
      overdue: 'Overdue',
      cancelled: 'Cancelled',
    },
    statusOptions: [
      { value: 'draft', label: 'Draft' },
      { value: 'submitted', label: 'Submitted' },
      { value: 'paid', label: 'Paid' },
    ],
    create: createSabcrmBill,
    remove: deleteSabcrmBill,
  },
  'proforma-invoices': {
    title: 'Proforma invoices',
    description:
      'Pre-invoice estimates for this workspace — part of the SabCRM Finance suite.',
    singular: 'proforma invoice',
    numberLabel: 'Proforma number',
    numberPlaceholder: 'PI-2026-0001',
    partyLabel: 'Customer',
    emptyIcon: Wallet,
    // NB: this crate's status vocabulary is TitleCase on the wire.
    statusTone: {
      Draft: 'neutral',
      Issued: 'info',
      Converted: 'success',
      Cancelled: 'neutral',
      archived: 'neutral',
    },
    statusLabel: {
      Draft: 'Draft',
      Issued: 'Issued',
      Converted: 'Converted',
      Cancelled: 'Cancelled',
      archived: 'Archived',
    },
    statusOptions: [
      { value: 'Draft', label: 'Draft' },
      { value: 'Issued', label: 'Issued' },
    ],
    create: createSabcrmProformaInvoice,
    remove: deleteSabcrmProformaInvoice,
  },
  // Finance tranche 2 — claim/payout entities that fit the generic
  // number/party/date/amount/status mould.
  expenses: {
    title: 'Expenses',
    description:
      'Employee expense claims for this workspace — part of the SabCRM Finance suite.',
    singular: 'expense',
    numberLabel: 'Claim number',
    numberPlaceholder: 'EC-202606-0001',
    partyLabel: 'Employee',
    emptyIcon: Wallet,
    statusTone: {
      draft: 'neutral',
      submitted: 'info',
      approved: 'success',
      rejected: 'danger',
      reimbursed: 'success',
      cancelled: 'neutral',
      archived: 'neutral',
    },
    statusLabel: {
      draft: 'Draft',
      submitted: 'Submitted',
      approved: 'Approved',
      rejected: 'Rejected',
      reimbursed: 'Reimbursed',
      cancelled: 'Cancelled',
      archived: 'Archived',
    },
    statusOptions: [
      { value: 'submitted', label: 'Submitted' },
      { value: 'draft', label: 'Draft' },
      { value: 'approved', label: 'Approved' },
    ],
    create: createSabcrmExpense,
    remove: deleteSabcrmExpense,
  },
  payouts: {
    title: 'Payouts',
    description:
      'Vendor payouts from this workspace — money out against bills, part of the SabCRM Finance suite.',
    singular: 'payout',
    numberLabel: 'Payout number',
    numberPlaceholder: 'PAY-2026-0001',
    partyLabel: 'Vendor',
    emptyIcon: Banknote,
    statusTone: {
      sent: 'info',
      cleared: 'success',
      failed: 'danger',
    },
    statusLabel: {
      sent: 'Sent',
      cleared: 'Cleared',
      failed: 'Failed',
    },
    statusOptions: [
      { value: 'sent', label: 'Sent' },
      { value: 'cleared', label: 'Cleared' },
    ],
    create: createSabcrmPayout,
    remove: deleteSabcrmPayout,
  },
};

// ---------------------------------------------------------------------------
// Display helpers (identical to invoices-client.tsx)
// ---------------------------------------------------------------------------

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

/** `2026-06-12T00:00:00Z` → `12 Jun 2026` (deterministic, no TZ drift). */
function formatDate(iso: string): string {
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split('-');
  if (!y || !m || !d) return day || '—';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = months[Number(m) - 1] ?? m;
  return `${Number(d)} ${month} ${y}`;
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Shorten a 24-char hex party id for display (`…a1b2c3d4`). */
function shortParty(id: string): string {
  if (!id) return '—';
  return `…${id.slice(-8)}`;
}

/** Today as `YYYY-MM-DD` for the date input default. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// New-document dialog
// ---------------------------------------------------------------------------

interface NewDocDialogProps {
  config: DocConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function NewDocDialog({
  config,
  open,
  onOpenChange,
  onCreated,
}: NewDocDialogProps): React.JSX.Element {
  const defaultStatus = config.statusOptions[0]?.value ?? null;
  const [number, setNumber] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [currency, setCurrency] = React.useState<string | null>('INR');
  const [date, setDate] = React.useState(today());
  const [status, setStatus] = React.useState<string | null>(defaultStatus);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const reset = React.useCallback(() => {
    setNumber('');
    setAmount('');
    setCurrency('INR');
    setDate(today());
    setStatus(defaultStatus);
    setError(null);
  }, [defaultStatus]);

  const handleOpenChange = (next: boolean): void => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = (): void => {
    const parsedAmount = Number(amount);
    if (!number.trim()) {
      setError(`A ${config.singular} number is required.`);
      return;
    }
    if (!amount.trim() || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError('Amount must be a non-negative number.');
      return;
    }
    if (!currency) {
      setError('Pick a currency.');
      return;
    }
    if (!date) {
      setError('Pick a date.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await config.create({
        number: number.trim(),
        amount: parsedAmount,
        currency,
        date,
        status: status ?? undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      reset();
      onOpenChange(false);
      onCreated();
    });
  };

  const descId = `new-${config.singular.replace(/\s+/g, '-')}-desc`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby={descId}>
        <DialogHeader>
          <DialogTitle>New {config.singular}</DialogTitle>
          <DialogDescription id={descId}>
            Create a {config.singular} in this workspace. You can refine
            line items and party details after it&apos;s created.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label={config.numberLabel} required>
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder={config.numberPlaceholder}
                autoFocus
                disabled={pending}
              />
            </Field>

            <Field label="Amount" required>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={pending}
              />
            </Field>

            <Field label="Currency" required>
              <SelectField
                value={currency}
                onChange={setCurrency}
                options={CURRENCY_OPTIONS}
                disabled={pending}
              />
            </Field>

            <Field label="Date" required>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={pending}
              />
            </Field>

            <Field label="Status">
              <SelectField
                value={status}
                onChange={setStatus}
                options={config.statusOptions}
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
              Create {config.singular}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page client
// ---------------------------------------------------------------------------

export interface FinanceDocClientProps {
  kind: FinanceDocKind;
  initialRows: FinanceDocRow[];
  /** Non-null when the list fetch failed (e.g. the Rust engine is down). */
  initialError: string | null;
}

export function FinanceDocClient({
  kind,
  initialRows,
  initialError,
}: FinanceDocClientProps): React.JSX.Element {
  const config = DOC_CONFIGS[kind];
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] =
    React.useState<FinanceDocRow | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const handleDelete = (): void => {
    const target = confirmDelete;
    if (!target) return;
    setDeleteError(null);
    startDelete(async () => {
      const res = await config.remove(target.id);
      if (!res.ok) {
        setDeleteError(res.error);
        return;
      }
      setConfirmDelete(null);
      refresh();
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1040px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{config.title}</PageTitle>
          <PageDescription>{config.description}</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => setDialogOpen(true)}
          >
            New {config.singular}
          </Button>
        </PageActions>
      </PageHeader>

      {initialError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load {config.title.toLowerCase()}: {initialError}
          </Alert>
        </div>
      ) : null}

      {!initialError && initialRows.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={config.emptyIcon}
            title={`No ${config.title.toLowerCase()} yet`}
            description={`Create your first ${config.singular} to start tracking it in this workspace.`}
            action={
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => setDialogOpen(true)}
              >
                New {config.singular}
              </Button>
            }
          />
        </div>
      ) : null}

      {initialRows.length > 0 ? (
        <div className="mt-4">
          <Table hover>
            <THead>
              <Tr>
                <Th>Number</Th>
                <Th>{config.partyLabel}</Th>
                <Th>Date</Th>
                <Th align="right">Amount</Th>
                <Th>Status</Th>
                <Th align="right" width={64}>
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {initialRows.map((row) => (
                <Tr key={row.id}>
                  <Td>{row.number}</Td>
                  <Td truncate title={row.party || undefined}>
                    {shortParty(row.party)}
                  </Td>
                  <Td>{formatDate(row.date)}</Td>
                  <Td align="right">
                    {formatAmount(row.amount, row.currency)}
                  </Td>
                  <Td>
                    <Badge
                      tone={config.statusTone[row.status] ?? 'neutral'}
                      dot
                    >
                      {config.statusLabel[row.status] ?? row.status}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={Trash2}
                      aria-label={`Delete ${config.singular} ${row.number}`}
                      onClick={() => {
                        setDeleteError(null);
                        setConfirmDelete(row);
                      }}
                    >
                      Delete
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      ) : null}

      <NewDocDialog
        config={config}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={refresh}
      />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setConfirmDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {confirmDelete?.number ?? `this ${config.singular}`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the {config.singular} from this
              workspace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <Alert tone="danger" role="alert">
              {deleteError}
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete {config.singular}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
