'use client';

/**
 * SabCRM Finance — journal entries client, 20ui.
 *
 * Dedicated client (not {@link FinanceLedgerClient}) because the create
 * dialog is a balanced 2-line debit/credit form whose account selects
 * are fed by the project's chart of accounts — the config-driven ledger
 * client only supports static select options. The list mirrors the
 * ledger client's table conventions (date / amount / badge cells,
 * archive behind an AlertDialog).
 *
 * The server action expands the simple form into the line-based Rust
 * DTO (`crm-voucher-entries`) and finds-or-creates the project's
 * default Journal voucher book; the Rust side re-validates that debits
 * balance credits.
 *
 * ONLY `@/components/sabcrm/20ui` barrel imports (repo rule); every
 * action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { NotebookPen, Plus, Trash2 } from 'lucide-react';

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
  Textarea,
  type BadgeTone,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import {
  createSabcrmJournalEntry,
  deleteSabcrmJournalEntry,
} from '@/app/actions/sabcrm-finance.actions';

import '@/components/sabcrm/20ui/surface-crm-base.css';

// ---------------------------------------------------------------------------
// Row/props types
// ---------------------------------------------------------------------------

/** Flat row the server page narrows journal-entry docs into. */
export interface JournalRow {
  id: string;
  voucherNumber: string;
  date: string;
  narration: string;
  /** "Debit account → credit account" summary when 2-line; line counts otherwise. */
  linesSummary: string;
  totalDebit: number;
  totalCredit: number;
  status: string;
}

/** Chart-of-account option for the debit/credit selects. */
export interface JournalAccountOption {
  id: string;
  name: string;
  accountType?: string;
}

export interface FinanceJournalClientProps {
  initialRows: JournalRow[];
  accounts: JournalAccountOption[];
  /** Non-null when the list fetch failed (e.g. the Rust engine is down). */
  initialError: string | null;
}

// ---------------------------------------------------------------------------
// Display helpers (same conventions as finance-ledger-client)
// ---------------------------------------------------------------------------

const STATUS_TONE: Record<string, BadgeTone> = {
  posted: 'success',
  draft: 'warning',
  archived: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  posted: 'Posted',
  draft: 'Draft',
  archived: 'Archived',
};

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

function formatAmount(amount: number): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `INR ${amount.toFixed(2)}`;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// New-entry dialog (2-line balanced debit/credit)
// ---------------------------------------------------------------------------

interface NewEntryDialogProps {
  accounts: JournalAccountOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function NewEntryDialog({
  accounts,
  open,
  onOpenChange,
  onCreated,
}: NewEntryDialogProps): React.JSX.Element {
  const accountOptions: SelectOption[] = React.useMemo(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: a.accountType ? `${a.name} (${a.accountType})` : a.name,
      })),
    [accounts],
  );

  const [debitAccountId, setDebitAccountId] = React.useState<string | null>(
    null,
  );
  const [creditAccountId, setCreditAccountId] = React.useState<string | null>(
    null,
  );
  const [amount, setAmount] = React.useState('');
  const [date, setDate] = React.useState(today());
  const [narration, setNarration] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const reset = React.useCallback(() => {
    setDebitAccountId(null);
    setCreditAccountId(null);
    setAmount('');
    setDate(today());
    setNarration('');
    setError(null);
  }, []);

  const handleOpenChange = (next: boolean): void => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = (): void => {
    if (!debitAccountId) {
      setError('Pick the debit account.');
      return;
    }
    if (!creditAccountId) {
      setError('Pick the credit account.');
      return;
    }
    if (debitAccountId === creditAccountId) {
      setError('Debit and credit accounts must be different.');
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Amount must be a positive number.');
      return;
    }
    if (!date) {
      setError('Pick the entry date.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await createSabcrmJournalEntry({
        debitAccountId,
        creditAccountId,
        amount: amt,
        date,
        narration: narration || undefined,
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
      <DialogContent aria-describedby="new-journal-entry-desc">
        <DialogHeader>
          <DialogTitle>New journal entry</DialogTitle>
          <DialogDescription id="new-journal-entry-desc">
            A balanced two-line entry: the amount is debited to one
            account and credited to another.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Debit account" required>
              <SelectField
                value={debitAccountId}
                onChange={setDebitAccountId}
                options={accountOptions}
                placeholder="Account to debit"
                disabled={pending}
              />
            </Field>
            <Field label="Credit account" required>
              <SelectField
                value={creditAccountId}
                onChange={setCreditAccountId}
                options={accountOptions}
                placeholder="Account to credit"
                disabled={pending}
              />
            </Field>
            <Field label="Amount" required>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
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
            <Field label="Narration">
              <Textarea
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Being monthly office rent accrued…"
                rows={2}
                disabled={pending}
              />
            </Field>

            {accountOptions.length === 0 ? (
              <Alert tone="warning" role="status">
                No ledger accounts yet — create accounts in Chart of
                accounts first.
              </Alert>
            ) : null}

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
            <Button
              type="submit"
              variant="primary"
              loading={pending}
              disabled={accountOptions.length === 0}
            >
              Post entry
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

export function FinanceJournalClient({
  initialRows,
  accounts,
  initialError,
}: FinanceJournalClientProps): React.JSX.Element {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<JournalRow | null>(
    null,
  );
  const [rowError, setRowError] = React.useState<string | null>(null);
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const handleDelete = (): void => {
    const target = confirmDelete;
    if (!target) return;
    setRowError(null);
    startDelete(async () => {
      const res = await deleteSabcrmJournalEntry(target.id);
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      setConfirmDelete(null);
      refresh();
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1120px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Journal entries</PageTitle>
          <PageDescription>
            Double-entry postings (debits = credits) against this
            workspace&apos;s chart of accounts — part of the SabCRM
            Finance suite.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => setDialogOpen(true)}
          >
            New journal entry
          </Button>
        </PageActions>
      </PageHeader>

      {initialError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load journal entries: {initialError}
          </Alert>
        </div>
      ) : null}

      {rowError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            {rowError}
          </Alert>
        </div>
      ) : null}

      {!initialError && initialRows.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={NotebookPen}
            title="No journal entries yet"
            description="Post your first balanced debit/credit entry to start the ledger for this workspace."
            action={
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => setDialogOpen(true)}
              >
                New journal entry
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
                <Th>Voucher no.</Th>
                <Th>Date</Th>
                <Th>Narration</Th>
                <Th>Lines</Th>
                <Th align="right">Debit</Th>
                <Th align="right">Credit</Th>
                <Th>Status</Th>
                <Th align="right" width={64}>
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {initialRows.map((row) => (
                <Tr key={row.id}>
                  <Td>{row.voucherNumber || '—'}</Td>
                  <Td>{row.date ? formatDate(row.date) : '—'}</Td>
                  <Td>{row.narration || '—'}</Td>
                  <Td>{row.linesSummary || '—'}</Td>
                  <Td align="right">{formatAmount(row.totalDebit)}</Td>
                  <Td align="right">{formatAmount(row.totalCredit)}</Td>
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
                      aria-label={`Archive journal entry ${row.voucherNumber}`}
                      onClick={() => {
                        setRowError(null);
                        setConfirmDelete(row);
                      }}
                    >
                      Archive
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      ) : null}

      <NewEntryDialog
        accounts={accounts}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={refresh}
      />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setConfirmDelete(null);
            setRowError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive {confirmDelete?.voucherNumber ?? 'this entry'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The journal entry is hidden from lists and excluded from
              statements. Its history is preserved and an admin can
              restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rowError ? (
            <Alert tone="danger" role="alert">
              {rowError}
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Archive entry
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
