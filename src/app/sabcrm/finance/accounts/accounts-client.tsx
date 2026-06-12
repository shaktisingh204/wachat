'use client';

/**
 * SabCRM Finance — Chart of accounts list client
 * (`/sabcrm/finance/accounts`), doc-surface kit adopter.
 *
 * Full-field surface for ledger heads (spec §3.18):
 *
 *   - KPI strip (total / P&L heads / balance-sheet heads / inactive);
 *   - kit list — name, mono code, per-type badge, GROUP and PARENT
 *     resolved to names (never ObjectIds), opening balance, status;
 *     search + status + date filters plus an account-TYPE Select in
 *     the actions slot (the spec forbids repurposing the status slot);
 *     server pagination, bulk archive/restore, CSV export;
 *   - FULL create/edit Dialog: name, code, type, account group
 *     Select (real groups), parent EntityPicker (hierarchy), opening
 *     balance, currency, active flag, notes.
 *
 * Row click deep-links `?edit=<id>` (deep-linkable edit dialog).
 */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  ArchiveRestore,
  CircleOff,
  FolderTree,
  Landmark,
  Plus,
  Receipt,
  Sigma,
} from 'lucide-react';

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  SelectField,
  Switch,
  Textarea,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  EntityPicker,
  type DocListColumn,
  type DocListPageConfig,
} from '../_components/doc-surface';
import type { DocEntityOption } from '../_components/doc-surface/types';
import {
  ACCOUNTS_PATH,
  ACCOUNT_STATUSES,
  ACCOUNT_TYPE_TONES,
  accountTypeLabel,
  toAccountFilters,
} from './account-config';

import {
  createSabcrmChartOfAccountFull,
  exportSabcrmChartOfAccountRows,
  getSabcrmChartOfAccountRow,
  listSabcrmChartAccountGroupOptions,
  listSabcrmChartOfAccountsPage,
  setSabcrmChartOfAccountStatus,
  updateSabcrmChartOfAccountFull,
} from '@/app/actions/sabcrm-finance-chart-of-accounts.actions';
import { searchSabcrmFinanceLedgerAccounts } from '@/app/actions/sabcrm-finance-pickers.actions';
import {
  SABCRM_ACCOUNT_TYPES,
  type SabcrmChartOfAccountKpis,
  type SabcrmChartOfAccountListRow,
} from '@/app/actions/sabcrm-finance-chart-of-accounts.actions.types';
import type { CrmChartOfAccountType } from '@/lib/rust-client/crm-chart-of-accounts';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmChartOfAccountListRow>[] = [
  { key: 'name', header: 'Account', kind: 'text', value: (r) => r.name },
  { key: 'code', header: 'Code', kind: 'text', value: (r) => r.code },
  {
    key: 'type',
    header: 'Type',
    kind: 'badge',
    value: (r) => (r.accountType ? accountTypeLabel(r.accountType) : ''),
    tone: (r) => ACCOUNT_TYPE_TONES[r.accountType] ?? 'neutral',
    csv: (r) => (r.accountType ? accountTypeLabel(r.accountType) : ''),
  },
  {
    key: 'group',
    header: 'Group',
    kind: 'text',
    value: (r) => r.groupLabel ?? (r.accountGroupId ? 'Unknown group' : ''),
  },
  {
    key: 'parent',
    header: 'Parent',
    kind: 'text',
    value: (r) => r.parentLabel ?? (r.parentId ? 'Unknown account' : ''),
  },
  {
    key: 'openingBalance',
    header: 'Opening',
    kind: 'money',
    value: (r) => r.openingBalance,
    currency: (r) => r.currency,
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Form state ──────────────────────────────────────────────── */

interface AccountFormValues {
  name: string;
  code: string;
  accountType: CrmChartOfAccountType | null;
  accountGroupId: string | null;
  parentId: string | null;
  parentLabel: string | null;
  openingBalance: string;
  currency: string;
  isActive: boolean;
  notes: string;
}

function emptyAccountValues(): AccountFormValues {
  return {
    name: '',
    code: '',
    accountType: null,
    accountGroupId: null,
    parentId: null,
    parentLabel: null,
    openingBalance: '',
    currency: 'INR',
    isActive: true,
    notes: '',
  };
}

function valuesFromRow(row: SabcrmChartOfAccountListRow): AccountFormValues {
  return {
    name: row.name,
    code: row.code,
    accountType: row.accountType || null,
    accountGroupId: row.accountGroupId || null,
    parentId: row.parentId || null,
    parentLabel: row.parentLabel,
    openingBalance: String(row.openingBalance),
    currency: row.currency,
    isActive: row.isActive,
    notes: row.notes,
  };
}

const TYPE_OPTIONS: SelectOption[] = SABCRM_ACCOUNT_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
}));

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface AccountsClientProps {
  initialRows: SabcrmChartOfAccountListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmChartOfAccountKpis | null;
}

export function AccountsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: AccountsClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [refreshToken, setRefreshToken] = React.useState(0);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] =
    React.useState<SabcrmChartOfAccountListRow | null>(null);
  const [values, setValues] = React.useState<AccountFormValues>(
    emptyAccountValues,
  );
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [groupOptions, setGroupOptions] = React.useState<DocEntityOption[]>([]);

  // Account-type toolbar filter (outside the kit; read via ref).
  const [typeFilter, setTypeFilter] = React.useState<string | null>('');
  const typeRef = React.useRef<CrmChartOfAccountType | ''>('');
  typeRef.current = (typeFilter ?? '') as CrmChartOfAccountType | '';

  // Display-row cache so `?edit=` opens instantly from listed rows.
  const rowsRef = React.useRef(
    new Map<string, SabcrmChartOfAccountListRow>(),
  );
  if (rowsRef.current.size === 0 && initialRows.length > 0) {
    for (const row of initialRows) rowsRef.current.set(row.id, row);
  }

  // Account groups for the dialog's Select.
  React.useEffect(() => {
    let cancelled = false;
    void listSabcrmChartAccountGroupOptions().then((res) => {
      if (!cancelled && res.ok) setGroupOptions(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = (p: Partial<AccountFormValues>): void =>
    setValues((v) => ({ ...v, ...p }));

  const openCreate = (): void => {
    setEditing(null);
    setValues(emptyAccountValues());
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = React.useCallback(
    (row: SabcrmChartOfAccountListRow): void => {
      setEditing(row);
      setValues(valuesFromRow(row));
      setFormError(null);
      setFormOpen(true);
    },
    [],
  );

  const closeDialog = (): void => {
    if (busy) return;
    setFormOpen(false);
    setEditing(null);
    if (editId) router.replace(pathname, { scroll: false });
  };

  // `?edit=<id>` deep link → open the edit dialog (cache, then fetch).
  React.useEffect(() => {
    if (!editId) return;
    const cached = rowsRef.current.get(editId);
    if (cached) {
      openEdit(cached);
      return;
    }
    let cancelled = false;
    void getSabcrmChartOfAccountRow(editId).then((res) => {
      if (cancelled) return;
      if (res.ok) openEdit(res.data);
      else toast.error(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [editId, openEdit]);

  const refresh = (): void => {
    setRefreshToken((t) => t + 1);
    router.refresh();
  };

  const submit = async (): Promise<void> => {
    setBusy(true);
    setFormError(null);
    try {
      const input = {
        name: values.name,
        code: values.code || undefined,
        accountType: values.accountType ?? undefined,
        accountGroupId: values.accountGroupId ?? undefined,
        parentId: values.parentId ?? undefined,
        openingBalance:
          values.openingBalance === ''
            ? undefined
            : Number(values.openingBalance),
        currency: values.currency || undefined,
        isActive: values.isActive,
        notes: values.notes || undefined,
      };
      const res = editing
        ? await updateSabcrmChartOfAccountFull(editing.id, input)
        : await createSabcrmChartOfAccountFull(input);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(
        editing ? `${res.data.name} updated.` : `${res.data.name} created.`,
      );
      setFormOpen(false);
      setEditing(null);
      if (editId) router.replace(pathname, { scroll: false });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleArchive = async (): Promise<void> => {
    if (!editing) return;
    setBusy(true);
    try {
      const next = editing.status === 'archived' ? 'active' : 'archived';
      const res = await setSabcrmChartOfAccountStatus(editing.id, next);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(
        next === 'archived'
          ? `${editing.name} archived.`
          : `${editing.name} restored.`,
      );
      setFormOpen(false);
      setEditing(null);
      if (editId) router.replace(pathname, { scroll: false });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const config = React.useMemo<
    DocListPageConfig<SabcrmChartOfAccountListRow>
  >(
    () => ({
      title: 'Chart of accounts',
      description:
        'Ledger heads behind every journal, bill and statement — grouped, coded and typed.',
      icon: Landmark,
      entity: { singular: 'account', plural: 'accounts' },
      columns: COLUMNS,
      statuses: ACCOUNT_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmChartOfAccountsPage(
          toAccountFilters(filters, typeRef.current),
        );
        if (!res.ok) return res;
        for (const row of res.data.rows) rowsRef.current.set(row.id, row);
        return {
          ok: true,
          data: { rows: res.data.rows, hasMore: res.data.hasMore },
        };
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmChartOfAccountRows(
          toAccountFilters(filters, typeRef.current),
        ),
      csvFileName: 'chart-of-accounts.csv',
      rowHref: (row) => `${ACCOUNTS_PATH}?edit=${encodeURIComponent(row.id)}`,
      rowLabel: (row) => `account ${row.name}`,
      bulkActions: [
        {
          key: 'archive',
          label: 'Archive',
          icon: Archive,
          tone: 'danger',
          confirm: {
            title: 'Archive the selected accounts?',
            description:
              'Archived accounts stop appearing in pickers; postings are kept.',
            actionLabel: 'Archive accounts',
          },
          run: async (rows) => {
            for (const row of rows.filter((r) => r.status !== 'archived')) {
              const res = await setSabcrmChartOfAccountStatus(
                row.id,
                'archived',
              );
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'restore',
          label: 'Restore',
          icon: ArchiveRestore,
          run: async (rows) => {
            const archived = rows.filter((r) => r.status === 'archived');
            if (archived.length === 0) {
              return {
                ok: false,
                error: 'Only archived accounts can be restored.',
              };
            }
            for (const row of archived) {
              const res = await setSabcrmChartOfAccountStatus(row.id, 'active');
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
      ],
    }),
    [],
  );

  const pnlCount = kpis
    ? (kpis.byType.income ?? 0) + (kpis.byType.expense ?? 0)
    : 0;
  const bsCount = kpis
    ? (kpis.byType.asset ?? 0) +
      (kpis.byType.liability ?? 0) +
      (kpis.byType.equity ?? 0)
    : 0;

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Accounts"
        icon={Sigma}
        value={String(kpis.count)}
        delta={
          kpis.sampled
            ? 'Across the latest 500 accounts'
            : `${kpis.activeCount} active`
        }
      />
      <KpiCard
        label="P&L heads"
        icon={Receipt}
        value={String(pnlCount)}
        delta={`${kpis.byType.income ?? 0} income · ${kpis.byType.expense ?? 0} expense`}
      />
      <KpiCard
        label="Balance-sheet heads"
        icon={FolderTree}
        value={String(bsCount)}
        delta={`${kpis.byType.asset ?? 0} asset · ${kpis.byType.liability ?? 0} liability · ${kpis.byType.equity ?? 0} equity`}
      />
      <KpiCard
        label="Inactive"
        icon={CircleOff}
        value={String(kpis.inactiveCount)}
        delta="archived or switched off"
        deltaTone={kpis.inactiveCount > 0 ? 'down' : 'neutral'}
      />
    </>
  ) : null;

  const editingArchived = editing?.status === 'archived';

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <>
            <div className="w-40">
              <SelectField
                value={typeFilter}
                onChange={(v) => {
                  setTypeFilter(v);
                  setRefreshToken((t) => t + 1);
                }}
                options={[{ value: '', label: 'All types' }, ...TYPE_OPTIONS]}
                aria-label="Filter by account type"
              />
            </div>
            <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
              New account
            </Button>
          </>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <Dialog open={formOpen} onOpenChange={(next) => !next && closeDialog()}>
        <DialogContent aria-describedby="account-form-desc">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.name}` : 'New account'}
            </DialogTitle>
            <DialogDescription id="account-form-desc">
              {editing
                ? 'Update the ledger head. Existing postings keep their account.'
                : 'Add a ledger head to the chart of accounts.'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="grid grid-cols-2 gap-3 px-1 py-2">
              <Field label="Name" required>
                <Input
                  value={values.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Bank charges"
                  disabled={busy}
                />
              </Field>
              <Field label="Code">
                <Input
                  value={values.code}
                  onChange={(e) => patch({ code: e.target.value })}
                  placeholder="5102"
                  disabled={busy}
                />
              </Field>
              <Field label="Type">
                <SelectField
                  value={values.accountType}
                  onChange={(v) =>
                    patch({
                      accountType: (v as CrmChartOfAccountType) || null,
                    })
                  }
                  options={TYPE_OPTIONS}
                  placeholder="Pick a type"
                  disabled={busy}
                />
              </Field>
              <Field label="Account group">
                <SelectField
                  value={values.accountGroupId}
                  onChange={(v) => patch({ accountGroupId: v })}
                  options={groupOptions.map((g) => ({
                    value: g.id,
                    label: g.meta ? `${g.label} (${g.meta})` : g.label,
                  }))}
                  placeholder={
                    groupOptions.length > 0 ? 'Pick a group' : 'No groups yet'
                  }
                  disabled={busy || groupOptions.length === 0}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Parent account" help="Builds the hierarchy.">
                  <EntityPicker
                    value={values.parentId}
                    valueLabel={values.parentLabel}
                    search={async (q) => {
                      const res = await searchSabcrmFinanceLedgerAccounts(q);
                      if (!res.ok) return [];
                      // An account can't be its own parent.
                      return editing
                        ? res.data.filter((o) => o.id !== editing.id)
                        : res.data;
                    }}
                    placeholder="Search accounts…"
                    disabled={busy}
                    onChange={(opt) =>
                      patch({
                        parentId: opt?.id ?? null,
                        parentLabel: opt?.label ?? null,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Opening balance">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={values.openingBalance}
                  onChange={(e) => patch({ openingBalance: e.target.value })}
                  placeholder="0.00"
                  disabled={busy}
                />
              </Field>
              <Field label="Currency">
                <SelectField
                  value={values.currency}
                  onChange={(v) => patch({ currency: v ?? 'INR' })}
                  options={CURRENCY_OPTIONS}
                  disabled={busy}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Notes">
                  <Textarea
                    value={values.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                    rows={2}
                    placeholder="What posts here…"
                    disabled={busy}
                  />
                </Field>
              </div>
              <Switch
                checked={values.isActive}
                onCheckedChange={(isActive) => patch({ isActive })}
                label="Active"
                disabled={busy}
              />
            </div>

            {formError ? (
              <div className="px-1 pb-2">
                <Alert tone="danger" role="alert">
                  {formError}
                </Alert>
              </div>
            ) : null}

            <DialogFooter>
              {editing ? (
                <Button
                  type="button"
                  variant="secondary"
                  iconLeft={editingArchived ? ArchiveRestore : Archive}
                  disabled={busy}
                  onClick={() => void toggleArchive()}
                >
                  {editingArchived ? 'Restore' : 'Archive'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={closeDialog}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" variant="primary" loading={busy}>
                {editing ? 'Save changes' : 'Create account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
