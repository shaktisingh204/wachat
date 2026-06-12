'use client';

/**
 * SabCRM Finance — Invoices list client (`/sabcrm/finance/invoices`), 20ui.
 *
 * Renders the project's invoices as a 20ui table with:
 *   - "New invoice" dialog (number, amount, currency, date, status) →
 *     `createSabcrmInvoice`.
 *   - Per-row delete behind an AlertDialog confirm → `deleteSabcrmInvoice`.
 *   - Empty state for first-run, inline Alert when the Rust engine is down.
 *
 * Data flows down from the server page (`page.tsx`); after a mutation the
 * action revalidates `/sabcrm/finance/invoices` and the client calls
 * `router.refresh()` so the table re-renders from fresh server props —
 * no client-side copy of the list to drift.
 *
 * ONLY `@/components/sabcrm/20ui` barrel imports (repo rule); auth /
 * onboarding / RBAC are enforced by the SabCRM layout, and every action
 * re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ReceiptText, Trash2 } from 'lucide-react';

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
  createSabcrmInvoice,
  deleteSabcrmInvoice,
} from '@/app/actions/sabcrm-finance.actions';

import '@/components/sabcrm/20ui/surface-crm-base.css';

// ---------------------------------------------------------------------------
// Types + display helpers
// ---------------------------------------------------------------------------

/** Flat row shape the server page narrows invoice documents into. */
export interface InvoiceRow {
  id: string;
  invoiceNo: string;
  /** Buyer account id (24-char hex); may be a placeholder. */
  customer: string;
  /** Invoice date (ISO instant). */
  date: string;
  amount: number;
  currency: string;
  status: string;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'neutral',
  sent: 'info',
  paid: 'success',
  partially_paid: 'warning',
  overdue: 'danger',
  cancelled: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  partially_paid: 'Partially paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
];

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

/** `2026-06-11T00:00:00Z` → `11 Jun 2026` (deterministic, no TZ drift). */
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

/** Shorten a 24-char hex buyer id for display (`…a1b2c3d4`). */
function shortCustomer(id: string): string {
  if (!id) return '—';
  return `…${id.slice(-8)}`;
}

/** Today as `YYYY-MM-DD` for the date input default. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// New-invoice dialog
// ---------------------------------------------------------------------------

interface NewInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function NewInvoiceDialog({
  open,
  onOpenChange,
  onCreated,
}: NewInvoiceDialogProps): React.JSX.Element {
  const [invoiceNo, setInvoiceNo] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [currency, setCurrency] = React.useState<string | null>('INR');
  const [date, setDate] = React.useState(today());
  const [status, setStatus] = React.useState<string | null>('draft');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const reset = React.useCallback(() => {
    setInvoiceNo('');
    setAmount('');
    setCurrency('INR');
    setDate(today());
    setStatus('draft');
    setError(null);
  }, []);

  const handleOpenChange = (next: boolean): void => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = (): void => {
    const parsedAmount = Number(amount);
    if (!invoiceNo.trim()) {
      setError('An invoice number is required.');
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
      setError('Pick an invoice date.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await createSabcrmInvoice({
        invoiceNo: invoiceNo.trim(),
        amount: parsedAmount,
        currency,
        date,
        status: (status ?? 'draft') as 'draft' | 'sent' | 'paid',
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby="new-invoice-desc">
        <DialogHeader>
          <DialogTitle>New invoice</DialogTitle>
          <DialogDescription id="new-invoice-desc">
            Create an invoice in this workspace. You can refine line items
            and customer details after it&apos;s created.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Invoice number" required>
              <Input
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="INV-2026-0001"
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

            <Field label="Invoice date" required>
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
                options={STATUS_OPTIONS}
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
              Create invoice
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

export interface InvoicesClientProps {
  initialRows: InvoiceRow[];
  /** Non-null when the list fetch failed (e.g. the Rust engine is down). */
  initialError: string | null;
}

export function InvoicesClient({
  initialRows,
  initialError,
}: InvoicesClientProps): React.JSX.Element {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<InvoiceRow | null>(
    null,
  );
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
      const res = await deleteSabcrmInvoice(target.id);
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
          <PageTitle>Invoices</PageTitle>
          <PageDescription>
            Billing documents for this workspace — part of the SabCRM
            Finance suite.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => setDialogOpen(true)}
          >
            New invoice
          </Button>
        </PageActions>
      </PageHeader>

      {initialError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load invoices: {initialError}
          </Alert>
        </div>
      ) : null}

      {!initialError && initialRows.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={ReceiptText}
            title="No invoices yet"
            description="Create your first invoice to start tracking billing in this workspace."
            action={
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => setDialogOpen(true)}
              >
                New invoice
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
                <Th>Customer</Th>
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
                  <Td>{row.invoiceNo}</Td>
                  <Td truncate title={row.customer || undefined}>
                    {shortCustomer(row.customer)}
                  </Td>
                  <Td>{formatDate(row.date)}</Td>
                  <Td align="right">{formatAmount(row.amount, row.currency)}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[row.status] ?? 'neutral'} dot>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={Trash2}
                      aria-label={`Delete invoice ${row.invoiceNo}`}
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

      <NewInvoiceDialog
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
              Delete {confirmDelete?.invoiceNo ?? 'this invoice'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the invoice from this workspace. This
              action cannot be undone.
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
              Delete invoice
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
