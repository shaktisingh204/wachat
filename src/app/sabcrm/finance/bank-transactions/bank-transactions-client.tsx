'use client';

/**
 * SabCRM Finance — Bank transactions client
 * (`/sabcrm/finance/bank-transactions`).
 *
 * Doc-surface adopter (finance-rollout spec §3.10): KPI strip (inflow /
 * outflow / net this month, unreconciled count), config-driven list
 * (resolved ACCOUNT labels — the kit's party filter is repurposed as an
 * account filter — plus native from/to range), bulk Mark cleared /
 * Mark reconciled / Archive, CSV export and a FULL-field 20ui Dialog
 * form: account (REAL picked id — no placeholder minting), date,
 * amount, type, description, reference, balance-after, category,
 * status and the SabFiles statement source (`<SabFileUrlInput>`).
 *
 * No detail route: a row click deep-links to `?edit=<id>` and opens the
 * edit dialog seeded from the row; a linked journal entry renders as a
 * read-only deep link inside the dialog.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  Plus,
  Scale,
} from 'lucide-react';

import {
  Alert,
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
} from '@/components/sabcrm/20ui';
import { SabFileUrlInput } from '@/components/sabfiles';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListFilters,
  type DocListPageConfig,
} from '../_components/doc-surface';
import {
  BANK_TX_PATH,
  BANK_TX_STATUSES,
  BANK_TX_TYPES,
  JOURNAL_ENTRIES_PATH,
  bankTxTypeLabel,
  toBankTxFilters,
} from './bank-transaction-config';

import {
  createSabcrmBankTransactionFull,
  exportSabcrmBankTransactionRows,
  listSabcrmBankTransactionsPage,
  searchSabcrmBankTxAccounts,
  transitionSabcrmBankTransactionStatus,
  updateSabcrmBankTransactionFull,
} from '@/app/actions/sabcrm-finance-bank-transactions.actions';
import { deleteSabcrmBankTransaction } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmBankTransactionKpis,
  SabcrmBankTransactionListRow,
} from '@/app/actions/sabcrm-finance-bank-transactions.actions.types';
import type {
  CrmBankTransactionStatus,
  CrmBankTransactionType,
} from '@/lib/rust-client/crm-bank-transactions';
import type { SabcrmPaymentAccountOption } from '@/app/actions/sabcrm-finance-invoices.actions.types';
import { safeNum } from '@/lib/sabcrm/finance-doc-math';

/* ─── Columns (full field coverage on the list) ───────────────── */

const COLUMNS: DocListColumn<SabcrmBankTransactionListRow>[] = [
  {
    key: 'transactionDate',
    header: 'Date',
    kind: 'date',
    value: (r) => r.transactionDate,
  },
  {
    key: 'account',
    header: 'Account',
    kind: 'party',
    value: (r) => r.accountLabel,
  },
  {
    key: 'type',
    header: 'Type',
    kind: 'badge',
    value: (r) => bankTxTypeLabel(r.type),
    tone: (r) => (r.type === 'credit' ? 'success' : 'danger'),
  },
  {
    key: 'description',
    header: 'Description',
    kind: 'text',
    value: (r) => r.description,
  },
  {
    key: 'referenceNumber',
    header: 'Reference',
    kind: 'text',
    value: (r) => r.referenceNumber,
  },
  {
    key: 'category',
    header: 'Category',
    kind: 'badge',
    value: (r) => r.category,
    tone: () => 'neutral',
  },
  {
    key: 'amount',
    header: 'Amount',
    kind: 'money',
    value: (r) => r.amount,
  },
  {
    key: 'balanceAfter',
    header: 'Balance after',
    kind: 'money',
    value: (r) => r.balanceAfter ?? 0,
    csv: (r) => (r.balanceAfter === null ? '' : r.balanceAfter.toFixed(2)),
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'status',
    value: (r) => r.status,
  },
];

/* ─── Dialog form ─────────────────────────────────────────────── */

interface TxFormState {
  accountId: string | null;
  transactionDate: string;
  amount: string;
  type: string | null;
  description: string;
  referenceNumber: string;
  balanceAfter: string;
  category: string;
  status: string | null;
  sourceFileUrl: string;
}

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function emptyForm(defaultAccountId: string | null): TxFormState {
  return {
    accountId: defaultAccountId,
    transactionDate: todayKey(),
    amount: '',
    type: 'credit',
    description: '',
    referenceNumber: '',
    balanceAfter: '',
    category: '',
    status: 'pending',
    sourceFileUrl: '',
  };
}

function rowToForm(row: SabcrmBankTransactionListRow): TxFormState {
  return {
    accountId: row.accountId || null,
    transactionDate: row.transactionDate.slice(0, 10),
    amount: String(row.amount ?? ''),
    type: row.type,
    description: row.description,
    referenceNumber: row.referenceNumber,
    balanceAfter: row.balanceAfter === null ? '' : String(row.balanceAfter),
    category: row.category,
    status: row.status,
    sourceFileUrl: row.sourceFileUrl,
  };
}

interface TxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null ⇒ create; a row ⇒ edit. */
  editing: SabcrmBankTransactionListRow | null;
  accounts: SabcrmPaymentAccountOption[];
  onDone: () => void;
}

function TxDialog({
  open,
  onOpenChange,
  editing,
  accounts,
  onDone,
}: TxDialogProps): React.JSX.Element {
  const [form, setForm] = React.useState<TxFormState>(() =>
    emptyForm(accounts[0]?.id ?? null),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setForm(editing ? rowToForm(editing) : emptyForm(accounts[0]?.id ?? null));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const patch = (p: Partial<TxFormState>): void =>
    setForm((f) => ({ ...f, ...p }));

  const submit = (): void => {
    if (!form.accountId) {
      setError(
        accounts.length === 0
          ? 'Create a payment account first (Finance → Payment accounts).'
          : 'Pick the payment account for this transaction.',
      );
      return;
    }
    if (safeNum(form.amount) <= 0) {
      setError('Amount must be greater than zero (direction lives in the type).');
      return;
    }
    if (!form.type) {
      setError('Pick a transaction type.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const payload = {
        accountId: form.accountId as string,
        transactionDate: form.transactionDate,
        amount: safeNum(form.amount),
        type: form.type as CrmBankTransactionType,
        description: form.description || undefined,
        referenceNumber: form.referenceNumber || undefined,
        balanceAfter: form.balanceAfter
          ? safeNum(form.balanceAfter)
          : undefined,
        category: form.category || undefined,
        status: (form.status ?? 'pending') as CrmBankTransactionStatus,
        sourceFileUrl: form.sourceFileUrl || undefined,
      };
      const res = editing
        ? await updateSabcrmBankTransactionFull(editing.id, payload)
        : await createSabcrmBankTransactionFull(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(editing ? 'Transaction updated.' : 'Transaction recorded.');
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="btx-desc">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit bank transaction' : 'New bank transaction'}
          </DialogTitle>
          <DialogDescription id="btx-desc">
            {editing
              ? 'Update the transaction details.'
              : 'Record money moving through one of your payment accounts.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Account" required>
              <SelectField
                value={form.accountId}
                onChange={(v) => patch({ accountId: v })}
                options={accounts.map((a) => ({
                  value: a.id,
                  label: a.label,
                }))}
                placeholder={
                  accounts.length === 0
                    ? 'No payment accounts yet'
                    : 'Pick an account'
                }
                disabled={pending || accounts.length === 0}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" required>
                <Input
                  type="date"
                  value={form.transactionDate}
                  onChange={(e) => patch({ transactionDate: e.target.value })}
                  disabled={pending}
                  aria-label="Transaction date"
                />
              </Field>
              <Field label="Type" required>
                <SelectField
                  value={form.type}
                  onChange={(v) => patch({ type: v })}
                  options={BANK_TX_TYPES.map((t) => ({
                    value: t.value,
                    label: t.label,
                  }))}
                  disabled={pending}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" required help="Always positive.">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => patch({ amount: e.target.value })}
                  placeholder="0.00"
                  disabled={pending}
                />
              </Field>
              <Field label="Balance after" help="Statement running balance.">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.balanceAfter}
                  onChange={(e) => patch({ balanceAfter: e.target.value })}
                  placeholder="Optional"
                  disabled={pending}
                />
              </Field>
            </div>
            <Field label="Description">
              <Input
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="NEFT from Acme Pvt Ltd"
                disabled={pending}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reference number">
                <Input
                  value={form.referenceNumber}
                  onChange={(e) => patch({ referenceNumber: e.target.value })}
                  placeholder="UTR / cheque no."
                  disabled={pending}
                />
              </Field>
              <Field label="Category">
                <Input
                  value={form.category}
                  onChange={(e) => patch({ category: e.target.value })}
                  placeholder="Sales, rent, fees…"
                  disabled={pending}
                />
              </Field>
            </div>
            <Field label="Status">
              <SelectField
                value={form.status}
                onChange={(v) => patch({ status: v })}
                options={BANK_TX_STATUSES.map((s) => ({
                  value: s.value,
                  label: s.label,
                }))}
                disabled={pending}
              />
            </Field>
            <Field
              label="Source statement"
              help="The bank statement this line came from — lives in SabFiles."
            >
              <SabFileUrlInput
                value={form.sourceFileUrl}
                onChange={(value) => patch({ sourceFileUrl: value })}
                accept="all"
                placeholder="No statement attached"
                pickerTitle="Pick the bank statement"
                disabled={pending}
              />
            </Field>
            {editing?.voucherEntryId ? (
              <Alert tone="info">
                Linked to journal entry{' '}
                <Link
                  href={`${JOURNAL_ENTRIES_PATH}?q=${encodeURIComponent(editing.voucherEntryId)}`}
                  className="underline"
                >
                  …{editing.voucherEntryId.slice(-8)}
                </Link>{' '}
                by the matching flow (read-only).
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
            <Button type="submit" variant="primary" loading={pending}>
              {editing ? 'Save changes' : 'Record transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface BankTransactionsClientProps {
  initialRows: SabcrmBankTransactionListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmBankTransactionKpis | null;
  /** Payment-account Select options (REAL ids, resolved server-side). */
  accounts: SabcrmPaymentAccountOption[];
  /** Statements drill-down deep-link seed (parsed from searchParams). */
  initialFilters?: Partial<DocListFilters>;
}

export function BankTransactionsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  accounts,
  initialFilters,
}: BankTransactionsClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] =
    React.useState<SabcrmBankTransactionListRow | null>(null);

  const rowsRef = React.useRef<SabcrmBankTransactionListRow[]>(initialRows);

  const editId = searchParams.get('edit');
  React.useEffect(() => {
    if (!editId) return;
    const row = rowsRef.current.find((r) => r.id === editId);
    if (row) {
      setEditing(row);
      setDialogOpen(true);
    }
    router.replace(pathname, { scroll: false });
  }, [editId, pathname, router]);

  const config = React.useMemo<
    DocListPageConfig<SabcrmBankTransactionListRow>
  >(
    () => ({
      title: 'Bank transactions',
      description:
        'Statement lines across your payment accounts — record, clear, reconcile and export.',
      icon: ArrowLeftRight,
      entity: { singular: 'transaction', plural: 'transactions' },
      columns: COLUMNS,
      statuses: BANK_TX_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmBankTransactionsPage(
          toBankTxFilters(filters),
        );
        if (res.ok) rowsRef.current = res.data.rows;
        return res.ok
          ? {
              ok: true,
              data: { rows: res.data.rows, hasMore: res.data.hasMore },
            }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmBankTransactionRows(toBankTxFilters(filters)),
      csvFileName: 'bank-transactions.csv',
      rowHref: (row) => `${BANK_TX_PATH}?edit=${encodeURIComponent(row.id)}`,
      rowLabel: (row) =>
        `transaction ${row.referenceNumber || row.description || row.id.slice(-8)}`,
      // Kit party filter repurposed as the ACCOUNT filter (spec §3.10).
      partyFilter: {
        placeholder: 'Any account',
        search: async (q) => {
          const res = await searchSabcrmBankTxAccounts(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'mark-cleared',
          label: 'Mark cleared',
          icon: CheckCircle2,
          run: async (rows) => {
            const pending = rows.filter((r) => r.status === 'pending');
            if (pending.length === 0) {
              return {
                ok: false,
                error: 'Only pending transactions can be cleared.',
              };
            }
            for (const row of pending) {
              const res = await transitionSabcrmBankTransactionStatus(
                row.id,
                'cleared',
              );
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'mark-reconciled',
          label: 'Mark reconciled',
          icon: Scale,
          run: async (rows) => {
            const cleared = rows.filter((r) => r.status === 'cleared');
            if (cleared.length === 0) {
              return {
                ok: false,
                error: 'Only cleared transactions can be reconciled.',
              };
            }
            for (const row of cleared) {
              const res = await transitionSabcrmBankTransactionStatus(
                row.id,
                'reconciled',
              );
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'archive',
          label: 'Archive',
          icon: Archive,
          tone: 'danger',
          confirm: {
            title: 'Archive the selected transactions?',
            description:
              'Archived transactions are hidden from the ledger views but keep their history.',
            actionLabel: 'Archive transactions',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmBankTransaction(row.id);
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
      ],
    }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Inflow this month"
        icon={ArrowDownLeft}
        value={formatDocMoney(kpis.inflowThisMonth, kpis.currency)}
        delta="Credits"
        deltaTone={kpis.inflowThisMonth > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Outflow this month"
        icon={ArrowUpRight}
        value={formatDocMoney(kpis.outflowThisMonth, kpis.currency)}
        delta="Debits"
        deltaTone={kpis.outflowThisMonth > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Net flow"
        icon={ArrowLeftRight}
        value={formatDocMoney(kpis.netThisMonth, kpis.currency)}
        delta={kpis.sampled ? `Latest ${kpis.count} transactions` : 'This month'}
        deltaTone={
          kpis.netThisMonth > 0
            ? 'up'
            : kpis.netThisMonth < 0
              ? 'down'
              : 'neutral'
        }
      />
      <KpiCard
        label="Unreconciled"
        icon={Scale}
        value={String(kpis.unreconciledCount)}
        delta="Pending + cleared"
        deltaTone={kpis.unreconciledCount > 0 ? 'down' : 'neutral'}
      />
    </>
  ) : null;

  const handleDone = (): void => {
    setRefreshToken((t) => t + 1);
    router.refresh();
  };

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            New transaction
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
        initialFilters={initialFilters}
      />

      <TxDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        accounts={accounts}
        onDone={handleDone}
      />
    </>
  );
}
