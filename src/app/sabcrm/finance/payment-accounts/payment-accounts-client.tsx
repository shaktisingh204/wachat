'use client';

/**
 * SabCRM Finance — Payment accounts client
 * (`/sabcrm/finance/payment-accounts`).
 *
 * Doc-surface adopter (finance-rollout spec §3.9): KPI strip (total
 * opening balance / computed current balance / active accounts), the
 * config-driven DocListPage and a FULL-field 20ui Dialog form — name,
 * type, status, opening balance + date, currency, default flag and the
 * bank-details section (bank name / account number / IFSC / branch /
 * holder, shown for bank-type accounts).
 *
 * No detail route: a row click deep-links to `?edit=<id>` and opens the
 * edit dialog seeded from the row (the rows carry the full editable
 * field set, so no second fetch).
 */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Archive, IndianRupee, Landmark, Plus, Wallet } from 'lucide-react';

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
  Switch,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
} from '../_components/doc-surface';
import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  ACCOUNTS_PATH,
  accountTypeLabel,
  toAccountFilters,
} from './payment-account-config';

import {
  createSabcrmPaymentAccountFull,
  exportSabcrmPaymentAccountRows,
  listSabcrmPaymentAccountsPage,
  updateSabcrmPaymentAccountFull,
} from '@/app/actions/sabcrm-finance-payment-accounts.actions';
import type {
  SabcrmPaymentAccountKpis,
  SabcrmPaymentAccountListRow,
} from '@/app/actions/sabcrm-finance-payment-accounts.actions.types';
import type {
  CrmPaymentAccountStatus,
  CrmPaymentAccountType,
} from '@/lib/rust-client/crm-payment-accounts';
import { safeNum } from '@/lib/sabcrm/finance-doc-math';

/* ─── Columns (full field coverage on the list) ───────────────── */

const COLUMNS: DocListColumn<SabcrmPaymentAccountListRow>[] = [
  {
    key: 'accountName',
    header: 'Account',
    kind: 'text',
    value: (r) => r.accountName,
  },
  {
    key: 'accountType',
    header: 'Type',
    kind: 'badge',
    value: (r) => accountTypeLabel(r.accountType),
    tone: () => 'neutral',
  },
  {
    key: 'openingBalance',
    header: 'Opening balance',
    kind: 'money',
    value: (r) => r.openingBalance,
    currency: (r) => r.currency,
  },
  {
    key: 'openingBalanceDate',
    header: 'As of',
    kind: 'date',
    value: (r) => r.openingBalanceDate,
  },
  {
    key: 'currency',
    header: 'Currency',
    kind: 'text',
    value: (r) => r.currency,
  },
  {
    key: 'isDefault',
    header: 'Default',
    kind: 'badge',
    value: (r) => (r.isDefault ? 'Default' : ''),
    tone: () => 'info',
    csv: (r) => (r.isDefault ? 'yes' : 'no'),
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'status',
    value: (r) => r.status,
  },
];

/* ─── Dialog form ─────────────────────────────────────────────── */

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

interface AccountFormState {
  accountName: string;
  accountType: string | null;
  status: string | null;
  openingBalance: string;
  openingBalanceDate: string;
  currency: string | null;
  isDefault: boolean;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  accountHolder: string;
}

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function emptyForm(): AccountFormState {
  return {
    accountName: '',
    accountType: 'bank',
    status: 'active',
    openingBalance: '',
    openingBalanceDate: todayKey(),
    currency: 'INR',
    isDefault: false,
    bankName: '',
    accountNumber: '',
    ifsc: '',
    branch: '',
    accountHolder: '',
  };
}

function rowToForm(row: SabcrmPaymentAccountListRow): AccountFormState {
  return {
    accountName: row.accountName,
    accountType: row.accountType || 'bank',
    status: row.status,
    openingBalance: String(row.openingBalance ?? ''),
    openingBalanceDate: row.openingBalanceDate.slice(0, 10),
    currency: row.currency || 'INR',
    isDefault: row.isDefault,
    bankName: row.bankDetails?.bankName ?? '',
    accountNumber: row.bankDetails?.accountNumber ?? '',
    ifsc: row.bankDetails?.ifsc ?? '',
    branch: row.bankDetails?.branch ?? '',
    accountHolder: row.bankDetails?.accountHolder ?? '',
  };
}

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null ⇒ create; a row ⇒ edit. */
  editing: SabcrmPaymentAccountListRow | null;
  onDone: () => void;
}

function AccountDialog({
  open,
  onOpenChange,
  editing,
  onDone,
}: AccountDialogProps): React.JSX.Element {
  const [form, setForm] = React.useState<AccountFormState>(emptyForm());
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setForm(editing ? rowToForm(editing) : emptyForm());
    setError(null);
  }, [open, editing]);

  const patch = (p: Partial<AccountFormState>): void =>
    setForm((f) => ({ ...f, ...p }));

  const submit = (): void => {
    if (!form.accountName.trim()) {
      setError('An account name is required.');
      return;
    }
    if (!form.accountType) {
      setError('Pick an account type.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const bankDetails =
        form.accountType === 'bank'
          ? {
              bankName: form.bankName || undefined,
              accountNumber: form.accountNumber || undefined,
              ifsc: form.ifsc || undefined,
              branch: form.branch || undefined,
              accountHolder: form.accountHolder || undefined,
            }
          : undefined;
      const payload = {
        accountName: form.accountName,
        accountType: form.accountType as CrmPaymentAccountType,
        openingBalance: form.openingBalance
          ? safeNum(form.openingBalance)
          : undefined,
        openingBalanceDate: form.openingBalanceDate || undefined,
        currency: form.currency ?? 'INR',
        isDefault: form.isDefault,
        bankDetails,
      };
      const res = editing
        ? await updateSabcrmPaymentAccountFull(editing.id, {
            ...payload,
            status: (form.status ?? 'active') as CrmPaymentAccountStatus,
          })
        : await createSabcrmPaymentAccountFull(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        editing
          ? `${res.data.accountName} updated.`
          : `${res.data.accountName} created.`,
      );
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="pacct-desc">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${editing.accountName}` : 'New payment account'}
          </DialogTitle>
          <DialogDescription id="pacct-desc">
            {editing
              ? 'Update the account details. Receipts and payouts keep pointing at this account.'
              : 'Accounts are where receipts land and payouts leave from.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Account name" required>
              <Input
                value={form.accountName}
                onChange={(e) => patch({ accountName: e.target.value })}
                placeholder="HDFC Current A/C"
                autoFocus
                disabled={pending}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type" required>
                <SelectField
                  value={form.accountType}
                  onChange={(v) => patch({ accountType: v })}
                  options={ACCOUNT_TYPES.map((t) => ({
                    value: t.value,
                    label: t.label,
                  }))}
                  disabled={pending}
                />
              </Field>
              <Field label="Currency">
                <SelectField
                  value={form.currency}
                  onChange={(v) => patch({ currency: v })}
                  options={CURRENCY_OPTIONS}
                  disabled={pending}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Opening balance">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.openingBalance}
                  onChange={(e) => patch({ openingBalance: e.target.value })}
                  placeholder="0.00"
                  disabled={pending}
                />
              </Field>
              <Field label="As of">
                <Input
                  type="date"
                  value={form.openingBalanceDate}
                  onChange={(e) =>
                    patch({ openingBalanceDate: e.target.value })
                  }
                  disabled={pending}
                  aria-label="Opening balance date"
                />
              </Field>
            </div>
            {editing ? (
              <Field label="Status">
                <SelectField
                  value={form.status}
                  onChange={(v) => patch({ status: v })}
                  options={ACCOUNT_STATUSES.map((s) => ({
                    value: s.value,
                    label: s.label,
                  }))}
                  disabled={pending}
                />
              </Field>
            ) : null}
            <Switch
              checked={form.isDefault}
              onCheckedChange={(checked) => patch({ isDefault: checked })}
              disabled={pending}
              label="Default account for new receipts and payouts"
            />
            {form.accountType === 'bank' ? (
              <fieldset className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
                <legend className="px-1 text-xs font-medium text-[var(--st-text-secondary)]">
                  Bank details
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Bank name">
                    <Input
                      value={form.bankName}
                      onChange={(e) => patch({ bankName: e.target.value })}
                      placeholder="HDFC Bank"
                      disabled={pending}
                    />
                  </Field>
                  <Field label="Branch">
                    <Input
                      value={form.branch}
                      onChange={(e) => patch({ branch: e.target.value })}
                      placeholder="Fort, Mumbai"
                      disabled={pending}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Account number">
                    <Input
                      value={form.accountNumber}
                      onChange={(e) =>
                        patch({ accountNumber: e.target.value })
                      }
                      placeholder="50100123456789"
                      disabled={pending}
                    />
                  </Field>
                  <Field label="IFSC">
                    <Input
                      value={form.ifsc}
                      onChange={(e) => patch({ ifsc: e.target.value })}
                      placeholder="HDFC0000001"
                      disabled={pending}
                    />
                  </Field>
                </div>
                <Field label="Account holder">
                  <Input
                    value={form.accountHolder}
                    onChange={(e) => patch({ accountHolder: e.target.value })}
                    placeholder="Acme Pvt Ltd"
                    disabled={pending}
                  />
                </Field>
              </fieldset>
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
              {editing ? 'Save changes' : 'Create account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface PaymentAccountsClientProps {
  initialRows: SabcrmPaymentAccountListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmPaymentAccountKpis | null;
}

export function PaymentAccountsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: PaymentAccountsClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] =
    React.useState<SabcrmPaymentAccountListRow | null>(null);

  // Latest loaded rows — the `?edit=<id>` deep link resolves against them.
  const rowsRef = React.useRef<SabcrmPaymentAccountListRow[]>(initialRows);

  const editId = searchParams.get('edit');
  React.useEffect(() => {
    if (!editId) return;
    const row = rowsRef.current.find((r) => r.id === editId);
    if (row) {
      setEditing(row);
      setDialogOpen(true);
    }
    // Strip the param either way so closing doesn't re-trigger.
    router.replace(pathname, { scroll: false });
  }, [editId, pathname, router]);

  const config = React.useMemo<DocListPageConfig<SabcrmPaymentAccountListRow>>(
    () => ({
      title: 'Payment accounts',
      description:
        'Bank, cash, UPI and wallet accounts — where receipts land and payouts leave from.',
      icon: Landmark,
      entity: { singular: 'account', plural: 'accounts' },
      columns: COLUMNS,
      statuses: ACCOUNT_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmPaymentAccountsPage(
          toAccountFilters(filters),
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
        exportSabcrmPaymentAccountRows(toAccountFilters(filters)),
      csvFileName: 'payment-accounts.csv',
      // Row click opens the edit dialog via a shareable deep link.
      rowHref: (row) => `${ACCOUNTS_PATH}?edit=${encodeURIComponent(row.id)}`,
      rowLabel: (row) => `account ${row.accountName}`,
      bulkActions: [
        {
          key: 'archive',
          label: 'Archive',
          icon: Archive,
          tone: 'danger',
          confirm: {
            title: 'Archive the selected accounts?',
            description:
              'Archived accounts are hidden from pickers; existing receipts and payouts keep their history.',
            actionLabel: 'Archive accounts',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await updateSabcrmPaymentAccountFull(row.id, {
                status: 'archived',
              });
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
        label="Opening balance"
        icon={IndianRupee}
        value={formatDocMoney(kpis.totalOpeningBalance, kpis.currency)}
        delta={`Across ${kpis.count} ${kpis.count === 1 ? 'account' : 'accounts'}`}
      />
      <KpiCard
        label="Current balance"
        icon={Wallet}
        value={formatDocMoney(kpis.currentBalance, kpis.currency)}
        delta={
          kpis.sampled
            ? 'Computed from the latest transactions (sampled)'
            : 'Opening + recorded transactions'
        }
      />
      <KpiCard
        label="Active accounts"
        icon={Landmark}
        value={String(kpis.activeCount)}
        delta={`of ${kpis.count} total`}
      />
      <KpiCard
        label="Default account"
        icon={Landmark}
        value={kpis.defaultAccountName ?? '—'}
        delta={
          kpis.defaultAccountName ? 'Used for new receipts' : 'None flagged'
        }
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
            New account
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onDone={handleDone}
      />
    </>
  );
}
