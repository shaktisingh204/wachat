'use client';

/**
 * SabCRM Finance — Reconciliation list client
 * (`/sabcrm/finance/reconciliation`), doc-surface kit adopter.
 *
 * Full-field surface for bank-reconciliation runs (spec §3.17):
 *
 *   - KPI strip (in-progress / last completed / unmatched / latest
 *     difference vs bank transactions);
 *   - kit list — the run's ACCOUNT resolved to its name (never an
 *     ObjectId), the kit's party slot repurposed as the account
 *     filter, search + status + date filters, server pagination, bulk
 *     "Complete runs", CSV export;
 *   - FULL create/edit Dialog: REAL picked payment account (the
 *     legacy dialog minted placeholder ids — this one refuses to),
 *     period range, opening/closing balances, notes; the edit dialog
 *     shows the StatusFlow rail, the system-managed matched/unmatched
 *     counters and a "Complete run" action (stamps `finalizedAt`).
 *
 * Row click deep-links `?edit=<id>`. The statement-line matching
 * engine stays in the legacy flow (deliberately not wired here).
 */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  CircleDollarSign,
  History,
  Plus,
  Scale,
  SearchX,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Textarea,
  toast,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  EntityPicker,
  StatusFlow,
  formatDocDate,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
} from '../_components/doc-surface';
import {
  RECONCILIATION_FLOW,
  RECONCILIATION_PATH,
  RECONCILIATION_STATUSES,
  toReconciliationFilters,
} from './reconciliation-config';

import {
  completeSabcrmReconciliationRun,
  createSabcrmReconciliationFull,
  exportSabcrmReconciliationRows,
  getSabcrmReconciliationRow,
  listSabcrmReconciliationsPage,
  searchSabcrmReconciliationAccounts,
  updateSabcrmReconciliationFull,
} from '@/app/actions/sabcrm-finance-reconciliation.actions';
import type {
  SabcrmReconciliationKpis,
  SabcrmReconciliationListRow,
} from '@/app/actions/sabcrm-finance-reconciliation.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmReconciliationListRow>[] = [
  {
    key: 'account',
    header: 'Account',
    kind: 'party',
    value: (r) => r.accountLabel,
  },
  {
    key: 'periodStart',
    header: 'From',
    kind: 'date',
    value: (r) => r.periodStart,
  },
  { key: 'periodEnd', header: 'To', kind: 'date', value: (r) => r.periodEnd },
  {
    key: 'openingBalance',
    header: 'Opening',
    kind: 'money',
    value: (r) => r.openingBalance,
    currency: (r) => r.currency,
  },
  {
    key: 'closingBalance',
    header: 'Closing',
    kind: 'money',
    value: (r) => r.closingBalance,
    currency: (r) => r.currency,
  },
  {
    key: 'matched',
    header: 'Matched',
    kind: 'text',
    value: (r) => String(r.matchedCount),
    align: 'right',
  },
  {
    key: 'unmatched',
    header: 'Unmatched',
    kind: 'badge',
    value: (r) => (r.unmatchedCount > 0 ? String(r.unmatchedCount) : ''),
    tone: () => 'warning',
    csv: (r) => String(r.unmatchedCount),
    align: 'right',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
  {
    key: 'finalizedAt',
    header: 'Finalised',
    kind: 'date',
    value: (r) => r.finalizedAt ?? '',
  },
];

/* ─── Form state ──────────────────────────────────────────────── */

interface RunFormValues {
  accountId: string | null;
  accountLabel: string | null;
  periodStart: string;
  periodEnd: string;
  openingBalance: string;
  closingBalance: string;
  notes: string;
}

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const last = new Date(y, m + 1, 0).getDate();
  return {
    start: `${y}-${pad(m + 1)}-01`,
    end: `${y}-${pad(m + 1)}-${pad(last)}`,
  };
}

function emptyRunValues(): RunFormValues {
  const { start, end } = monthBounds();
  return {
    accountId: null,
    accountLabel: null,
    periodStart: start,
    periodEnd: end,
    openingBalance: '',
    closingBalance: '',
    notes: '',
  };
}

function valuesFromRow(row: SabcrmReconciliationListRow): RunFormValues {
  return {
    accountId: row.accountId,
    accountLabel: row.accountLabel,
    periodStart: (row.periodStart ?? '').slice(0, 10),
    periodEnd: (row.periodEnd ?? '').slice(0, 10),
    openingBalance: String(row.openingBalance),
    closingBalance: String(row.closingBalance),
    notes: row.notes,
  };
}

function keyToDate(key: string): Date | undefined {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function dateToKey(d: Date | undefined): string {
  if (!d) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/* ─── Component ───────────────────────────────────────────────── */

export interface ReconciliationClientProps {
  initialRows: SabcrmReconciliationListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmReconciliationKpis | null;
}

export function ReconciliationClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: ReconciliationClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [refreshToken, setRefreshToken] = React.useState(0);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] =
    React.useState<SabcrmReconciliationListRow | null>(null);
  const [values, setValues] = React.useState<RunFormValues>(emptyRunValues);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Display-row cache so `?edit=` opens instantly from listed rows.
  const rowsRef = React.useRef(
    new Map<string, SabcrmReconciliationListRow>(),
  );
  if (rowsRef.current.size === 0 && initialRows.length > 0) {
    for (const row of initialRows) rowsRef.current.set(row.id, row);
  }

  const patch = (p: Partial<RunFormValues>): void =>
    setValues((v) => ({ ...v, ...p }));

  const openCreate = (): void => {
    setEditing(null);
    setValues(emptyRunValues());
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = React.useCallback(
    (row: SabcrmReconciliationListRow): void => {
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
    void getSabcrmReconciliationRow(editId).then((res) => {
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

  const searchAccounts = async (q: string) => {
    const res = await searchSabcrmReconciliationAccounts(q);
    return res.ok ? res.data : [];
  };

  const submit = async (): Promise<void> => {
    setBusy(true);
    setFormError(null);
    try {
      const input = {
        accountId: values.accountId ?? '',
        periodStart: values.periodStart,
        periodEnd: values.periodEnd,
        openingBalance:
          values.openingBalance === ''
            ? undefined
            : Number(values.openingBalance),
        closingBalance:
          values.closingBalance === ''
            ? undefined
            : Number(values.closingBalance),
        notes: values.notes || undefined,
      };
      const res = editing
        ? await updateSabcrmReconciliationFull(editing.id, input)
        : await createSabcrmReconciliationFull(input);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(editing ? 'Run updated.' : 'Reconciliation run started.');
      setFormOpen(false);
      setEditing(null);
      if (editId) router.replace(pathname, { scroll: false });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const completeRun = async (): Promise<void> => {
    if (!editing) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await completeSabcrmReconciliationRun(editing.id);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success('Run completed.');
      setFormOpen(false);
      setEditing(null);
      if (editId) router.replace(pathname, { scroll: false });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const config = React.useMemo<
    DocListPageConfig<SabcrmReconciliationListRow>
  >(
    () => ({
      title: 'Reconciliation',
      description:
        'Bank reconciliation runs — match the books against each account statement, period by period.',
      icon: Scale,
      entity: { singular: 'reconciliation run', plural: 'reconciliation runs' },
      columns: COLUMNS,
      statuses: RECONCILIATION_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmReconciliationsPage(
          toReconciliationFilters(filters),
        );
        if (!res.ok) return res;
        for (const row of res.data.rows) rowsRef.current.set(row.id, row);
        return {
          ok: true,
          data: { rows: res.data.rows, hasMore: res.data.hasMore },
        };
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmReconciliationRows(toReconciliationFilters(filters)),
      csvFileName: 'reconciliation-runs.csv',
      rowHref: (row) =>
        `${RECONCILIATION_PATH}?edit=${encodeURIComponent(row.id)}`,
      rowLabel: (row) =>
        `reconciliation run for ${row.accountLabel ?? 'unknown account'}`,
      partyFilter: {
        placeholder: 'Any account',
        search: searchAccounts,
      },
      bulkActions: [
        {
          key: 'complete',
          label: 'Complete runs',
          icon: CheckCircle2,
          confirm: {
            title: 'Complete the selected runs?',
            description:
              'Completed runs are locked and stamped with a finalised time.',
            actionLabel: 'Complete runs',
          },
          run: async (rows) => {
            const open = rows.filter((r) => r.status === 'in_progress');
            if (open.length === 0) {
              return {
                ok: false,
                error: 'Only in-progress runs can be completed.',
              };
            }
            for (const row of open) {
              const res = await completeSabcrmReconciliationRun(row.id);
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
        label="In progress"
        icon={Scale}
        value={String(kpis.inProgressCount)}
        delta={kpis.inProgressCount === 1 ? 'open run' : 'open runs'}
        deltaTone={kpis.inProgressCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Last completed"
        icon={History}
        value={
          kpis.lastCompletedAt ? formatDocDate(kpis.lastCompletedAt) : '—'
        }
        delta={`${kpis.completedCount} completed in total`}
      />
      <KpiCard
        label="Unmatched lines"
        icon={SearchX}
        value={String(kpis.unmatchedTotal)}
        delta="across all runs"
        deltaTone={kpis.unmatchedTotal > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Latest difference"
        icon={CircleDollarSign}
        value={
          kpis.latestDifference === null
            ? '—'
            : formatDocMoney(kpis.latestDifference, kpis.currency)
        }
        delta="closing − opening − net bank flow"
        deltaTone={
          kpis.latestDifference !== null &&
          Math.abs(kpis.latestDifference) >= 0.01
            ? 'down'
            : 'neutral'
        }
      />
    </>
  ) : null;

  const editingLocked = editing?.status === 'completed';

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
            New run
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <Dialog open={formOpen} onOpenChange={(next) => !next && closeDialog()}>
        <DialogContent aria-describedby="reconciliation-form-desc">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Reconciliation run' : 'New reconciliation run'}
            </DialogTitle>
            <DialogDescription id="reconciliation-form-desc">
              {editing
                ? 'Review the run, adjust balances or complete it.'
                : 'Pick the account and statement period to reconcile.'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {editing ? (
              <div className="px-1 pb-2">
                <StatusFlow
                  flow={RECONCILIATION_FLOW}
                  statuses={RECONCILIATION_STATUSES}
                  current={editing.status}
                />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 px-1 py-2">
              <div className="col-span-2">
                <Field label="Account" required>
                  <EntityPicker
                    value={values.accountId}
                    valueLabel={values.accountLabel}
                    search={searchAccounts}
                    placeholder="Search payment accounts…"
                    disabled={busy || editingLocked}
                    invalid={!!formError && !values.accountId}
                    onChange={(opt) =>
                      patch({
                        accountId: opt?.id ?? null,
                        accountLabel: opt?.label ?? null,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Period start" required>
                <DatePicker
                  value={keyToDate(values.periodStart)}
                  onChange={(d) => patch({ periodStart: dateToKey(d) })}
                  placeholder="Pick a date"
                  disabled={busy || editingLocked}
                  aria-label="Period start"
                />
              </Field>
              <Field label="Period end" required>
                <DatePicker
                  value={keyToDate(values.periodEnd)}
                  onChange={(d) => patch({ periodEnd: dateToKey(d) })}
                  placeholder="Pick a date"
                  disabled={busy || editingLocked}
                  aria-label="Period end"
                />
              </Field>
              <Field label="Opening balance">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={values.openingBalance}
                  onChange={(e) => patch({ openingBalance: e.target.value })}
                  placeholder="0.00"
                  disabled={busy || editingLocked}
                />
              </Field>
              <Field label="Closing balance">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={values.closingBalance}
                  onChange={(e) => patch({ closingBalance: e.target.value })}
                  placeholder="0.00"
                  disabled={busy || editingLocked}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Notes">
                  <Textarea
                    value={values.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                    rows={2}
                    placeholder="Statement reference, anomalies…"
                    disabled={busy || editingLocked}
                  />
                </Field>
              </div>
            </div>

            {editing ? (
              <div className="flex flex-wrap items-center gap-3 px-1 pb-2 text-sm">
                <Badge tone="success">{editing.matchedCount} matched</Badge>
                <Badge tone={editing.unmatchedCount > 0 ? 'warning' : 'neutral'}>
                  {editing.unmatchedCount} unmatched
                </Badge>
                {editing.finalizedAt ? (
                  <span className="opacity-60">
                    Finalised {formatDocDate(editing.finalizedAt)}
                  </span>
                ) : null}
              </div>
            ) : null}

            {formError ? (
              <div className="px-1 pb-2">
                <Alert tone="danger" role="alert">
                  {formError}
                </Alert>
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={closeDialog}
              >
                {editingLocked ? 'Close' : 'Cancel'}
              </Button>
              {editing && editing.status === 'in_progress' ? (
                <Button
                  type="button"
                  variant="secondary"
                  iconLeft={CheckCircle2}
                  disabled={busy}
                  onClick={() => void completeRun()}
                >
                  Complete run
                </Button>
              ) : null}
              {!editingLocked ? (
                <Button type="submit" variant="primary" loading={busy}>
                  {editing ? 'Save changes' : 'Start run'}
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
