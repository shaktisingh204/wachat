'use client';

/**
 * SabCRM Finance — TDS records list client (`/sabcrm/finance/tds`),
 * doc-surface kit adopter.
 *
 * Full-field surface for per-deductee quarterly TDS (spec §3.19):
 *
 *   - KPI strip scoped to the current Indian FY (pending deposit /
 *     deposited this quarter / filed certificates / FY total);
 *   - kit list — deductee, FY, quarter badge, gross + TDS money,
 *     certificate + challan numbers, deposit date, status; search +
 *     status + date filters, a deductee (people) filter in the kit's
 *     party slot, FY + QUARTER Selects in the actions slot, server
 *     pagination, bulk "Mark deposited"/"Mark filed", CSV export;
 *   - FULL create/edit Dialog: people picker (writes id + name, free
 *     text stays editable for non-CRM deductees), FY/quarter Selects,
 *     amounts, certificate + challan, deposit date, notes; the edit
 *     dialog shows the StatusFlow rail and the next transition.
 *
 * Row click deep-links `?edit=<id>` (deep-linkable edit dialog).
 */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BadgeCheck,
  CalendarClock,
  FileCheck2,
  IndianRupee,
  Landmark,
  Plus,
  ReceiptIndianRupee,
} from 'lucide-react';

import {
  Alert,
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
  SelectField,
  Textarea,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  EntityPicker,
  StatusFlow,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
} from '../_components/doc-surface';
import {
  TDS_FLOW,
  TDS_PATH,
  TDS_STATUSES,
  recentFinancialYears,
  toTdsFilters,
} from './tds-config';

import {
  createSabcrmTdsRecordFull,
  exportSabcrmTdsRows,
  getSabcrmTdsRecordRow,
  listSabcrmTdsRecordsPage,
  transitionSabcrmTdsStatus,
  updateSabcrmTdsRecordFull,
} from '@/app/actions/sabcrm-finance-tds.actions';
import { searchSabcrmFinanceParties } from '@/app/actions/sabcrm-finance-invoices.actions';
import {
  SABCRM_TDS_QUARTERS,
  SABCRM_TDS_TRANSITIONS,
  type SabcrmTdsKpis,
  type SabcrmTdsListRow,
} from '@/app/actions/sabcrm-finance-tds.actions.types';
import type { CrmTdsQuarter, CrmTdsStatus } from '@/lib/rust-client/crm-tds';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmTdsListRow>[] = [
  {
    key: 'employee',
    header: 'Deductee',
    kind: 'text',
    value: (r) => r.employeeName,
  },
  { key: 'fy', header: 'FY', kind: 'text', value: (r) => r.financialYear },
  {
    key: 'quarter',
    header: 'Quarter',
    kind: 'badge',
    value: (r) => r.quarter,
  },
  {
    key: 'gross',
    header: 'Gross',
    kind: 'money',
    value: (r) => r.grossAmount,
  },
  { key: 'tds', header: 'TDS', kind: 'money', value: (r) => r.tdsAmount },
  {
    key: 'certificate',
    header: 'Certificate',
    kind: 'text',
    value: (r) => r.certificateNumber,
  },
  {
    key: 'challan',
    header: 'Challan',
    kind: 'text',
    value: (r) => r.depositChallanNumber,
  },
  {
    key: 'depositDate',
    header: 'Deposited',
    kind: 'date',
    value: (r) => r.depositDate ?? '',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Form state ──────────────────────────────────────────────── */

interface TdsFormValues {
  employeeId: string | null;
  employeeName: string;
  financialYear: string;
  quarter: CrmTdsQuarter;
  grossAmount: string;
  tdsAmount: string;
  certificateNumber: string;
  depositChallanNumber: string;
  depositDate: string;
  notes: string;
}

function emptyTdsValues(): TdsFormValues {
  return {
    employeeId: null,
    employeeName: '',
    financialYear: recentFinancialYears(1)[0],
    quarter: 'Q1',
    grossAmount: '',
    tdsAmount: '',
    certificateNumber: '',
    depositChallanNumber: '',
    depositDate: '',
    notes: '',
  };
}

function valuesFromRow(row: SabcrmTdsListRow): TdsFormValues {
  return {
    employeeId: row.employeeId || null,
    employeeName: row.employeeName,
    financialYear: row.financialYear,
    quarter: (row.quarter as CrmTdsQuarter) || 'Q1',
    grossAmount: String(row.grossAmount),
    tdsAmount: String(row.tdsAmount),
    certificateNumber: row.certificateNumber,
    depositChallanNumber: row.depositChallanNumber,
    depositDate: (row.depositDate ?? '').slice(0, 10),
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

const QUARTER_OPTIONS: SelectOption[] = SABCRM_TDS_QUARTERS.map((q) => ({
  value: q.value,
  label: q.label,
}));

/** People-only search (deductees) over the records engine. */
async function searchPeople(q: string) {
  const res = await searchSabcrmFinanceParties(q);
  if (!res.ok) return [];
  return res.data
    .filter((p) => p.objectSlug === 'people')
    .map((p) => ({ id: p.id, label: p.label, meta: p.meta }));
}

/* ─── Component ───────────────────────────────────────────────── */

export interface TdsClientProps {
  initialRows: SabcrmTdsListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmTdsKpis | null;
}

export function TdsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: TdsClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [refreshToken, setRefreshToken] = React.useState(0);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabcrmTdsListRow | null>(null);
  const [values, setValues] = React.useState<TdsFormValues>(emptyTdsValues);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // FY + quarter toolbar filters (outside the kit; read via refs).
  const fyOptions = React.useMemo(recentFinancialYears, []);
  const [fyFilter, setFyFilter] = React.useState<string | null>('');
  const [quarterFilter, setQuarterFilter] = React.useState<string | null>('');
  const extraRef = React.useRef<{
    financialYear: string;
    quarter: CrmTdsQuarter | '';
  }>({ financialYear: '', quarter: '' });
  extraRef.current = {
    financialYear: fyFilter ?? '',
    quarter: (quarterFilter ?? '') as CrmTdsQuarter | '',
  };

  // Display-row cache so `?edit=` opens instantly from listed rows.
  const rowsRef = React.useRef(new Map<string, SabcrmTdsListRow>());
  if (rowsRef.current.size === 0 && initialRows.length > 0) {
    for (const row of initialRows) rowsRef.current.set(row.id, row);
  }

  const patch = (p: Partial<TdsFormValues>): void =>
    setValues((v) => ({ ...v, ...p }));

  const openCreate = (): void => {
    setEditing(null);
    setValues(emptyTdsValues());
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = React.useCallback((row: SabcrmTdsListRow): void => {
    setEditing(row);
    setValues(valuesFromRow(row));
    setFormError(null);
    setFormOpen(true);
  }, []);

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
    void getSabcrmTdsRecordRow(editId).then((res) => {
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
    if (values.tdsAmount === '') {
      setFormError('A TDS amount is required.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const input = {
        employeeId: values.employeeId ?? undefined,
        employeeName: values.employeeName,
        financialYear: values.financialYear,
        quarter: values.quarter,
        tdsAmount: values.tdsAmount === '' ? undefined : Number(values.tdsAmount),
        grossAmount:
          values.grossAmount === '' ? undefined : Number(values.grossAmount),
        certificateNumber: values.certificateNumber || undefined,
        depositChallanNumber: values.depositChallanNumber || undefined,
        depositDate: values.depositDate || undefined,
        notes: values.notes || undefined,
      };
      const res = editing
        ? await updateSabcrmTdsRecordFull(editing.id, input)
        : await createSabcrmTdsRecordFull({
            ...input,
            tdsAmount: Number(values.tdsAmount),
          });
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(
        editing
          ? `TDS for ${res.data.employeeName} updated.`
          : `TDS for ${res.data.employeeName} recorded.`,
      );
      setFormOpen(false);
      setEditing(null);
      if (editId) router.replace(pathname, { scroll: false });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const transition = async (next: CrmTdsStatus): Promise<void> => {
    if (!editing) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await transitionSabcrmTdsStatus(editing.id, next);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(
        next === 'deposited' ? 'Marked as deposited.' : 'Marked as filed.',
      );
      setFormOpen(false);
      setEditing(null);
      if (editId) router.replace(pathname, { scroll: false });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const config = React.useMemo<DocListPageConfig<SabcrmTdsListRow>>(
    () => ({
      title: 'TDS',
      description:
        'Tax deducted at source — per-deductee quarterly records, deposits and filings.',
      icon: ReceiptIndianRupee,
      entity: { singular: 'TDS record', plural: 'TDS records' },
      columns: COLUMNS,
      statuses: TDS_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmTdsRecordsPage(
          toTdsFilters(filters, extraRef.current),
        );
        if (!res.ok) return res;
        for (const row of res.data.rows) rowsRef.current.set(row.id, row);
        return {
          ok: true,
          data: { rows: res.data.rows, hasMore: res.data.hasMore },
        };
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmTdsRows(toTdsFilters(filters, extraRef.current)),
      csvFileName: 'tds-records.csv',
      rowHref: (row) => `${TDS_PATH}?edit=${encodeURIComponent(row.id)}`,
      rowLabel: (row) =>
        `TDS record for ${row.employeeName} ${row.financialYear} ${row.quarter}`,
      partyFilter: {
        placeholder: 'Any deductee',
        search: searchPeople,
      },
      bulkActions: [
        {
          key: 'deposit',
          label: 'Mark deposited',
          icon: Landmark,
          run: async (rows) => {
            const pending = rows.filter((r) => r.status === 'pending');
            if (pending.length === 0) {
              return {
                ok: false,
                error: 'Only pending records can be deposited.',
              };
            }
            for (const row of pending) {
              const res = await transitionSabcrmTdsStatus(row.id, 'deposited');
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'file',
          label: 'Mark filed',
          icon: FileCheck2,
          run: async (rows) => {
            const deposited = rows.filter((r) => r.status === 'deposited');
            if (deposited.length === 0) {
              return {
                ok: false,
                error: 'Only deposited records can be filed.',
              };
            }
            for (const row of deposited) {
              const res = await transitionSabcrmTdsStatus(row.id, 'filed');
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
        label="Pending deposit"
        icon={IndianRupee}
        value={formatDocMoney(kpis.pendingAmount, 'INR')}
        delta={`${kpis.pendingCount} ${kpis.pendingCount === 1 ? 'record' : 'records'} awaiting challan`}
        deltaTone={kpis.pendingCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label={`Deposited ${kpis.quarter}`}
        icon={Landmark}
        value={formatDocMoney(kpis.depositedThisQuarter, 'INR')}
        delta={`current quarter, FY ${kpis.financialYear}`}
      />
      <KpiCard
        label="Filed"
        icon={BadgeCheck}
        value={String(kpis.filedCount)}
        delta={kpis.filedCount === 1 ? 'certificate filed' : 'certificates filed'}
        deltaTone={kpis.filedCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label={`FY ${kpis.financialYear} total`}
        icon={CalendarClock}
        value={formatDocMoney(kpis.fyTotal, 'INR')}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} records`
            : 'all quarters'
        }
      />
    </>
  ) : null;

  const nextTransitions = editing
    ? (SABCRM_TDS_TRANSITIONS[editing.status] ?? [])
    : [];

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <>
            <div className="w-36">
              <SelectField
                value={fyFilter}
                onChange={(v) => {
                  setFyFilter(v);
                  setRefreshToken((t) => t + 1);
                }}
                options={[
                  { value: '', label: 'All FYs' },
                  ...fyOptions.map((fy) => ({ value: fy, label: `FY ${fy}` })),
                ]}
                aria-label="Filter by financial year"
              />
            </div>
            <div className="w-36">
              <SelectField
                value={quarterFilter}
                onChange={(v) => {
                  setQuarterFilter(v);
                  setRefreshToken((t) => t + 1);
                }}
                options={[
                  { value: '', label: 'All quarters' },
                  ...QUARTER_OPTIONS,
                ]}
                aria-label="Filter by quarter"
              />
            </div>
            <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
              New TDS record
            </Button>
          </>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <Dialog open={formOpen} onOpenChange={(next) => !next && closeDialog()}>
        <DialogContent aria-describedby="tds-form-desc">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? `TDS — ${editing.employeeName} (${editing.financialYear} ${editing.quarter})`
                : 'New TDS record'}
            </DialogTitle>
            <DialogDescription id="tds-form-desc">
              {editing
                ? 'Update the record, or move it along the deposit → file workflow.'
                : 'Record tax deducted at source for a deductee and quarter.'}
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
                  flow={TDS_FLOW}
                  statuses={TDS_STATUSES}
                  current={editing.status}
                />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 px-1 py-2">
              <Field
                label="Deductee record"
                help="Optional — links a CRM person."
              >
                <EntityPicker
                  value={values.employeeId}
                  valueLabel={values.employeeId ? values.employeeName : null}
                  search={searchPeople}
                  placeholder="Search people…"
                  disabled={busy}
                  onChange={(opt) =>
                    patch({
                      employeeId: opt?.id ?? null,
                      // The picker fills the name; it stays editable.
                      employeeName: opt?.label ?? values.employeeName,
                    })
                  }
                />
              </Field>
              <Field label="Deductee name" required>
                <Input
                  value={values.employeeName}
                  onChange={(e) => patch({ employeeName: e.target.value })}
                  placeholder="A. Sharma"
                  disabled={busy}
                />
              </Field>
              <Field label="Financial year" required>
                <SelectField
                  value={values.financialYear}
                  onChange={(v) =>
                    patch({ financialYear: v ?? fyOptions[0] })
                  }
                  options={fyOptions.map((fy) => ({
                    value: fy,
                    label: `FY ${fy}`,
                  }))}
                  disabled={busy}
                />
              </Field>
              <Field label="Quarter" required>
                <SelectField
                  value={values.quarter}
                  onChange={(v) =>
                    patch({ quarter: (v as CrmTdsQuarter) ?? 'Q1' })
                  }
                  options={QUARTER_OPTIONS}
                  disabled={busy}
                />
              </Field>
              <Field label="Gross amount">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={values.grossAmount}
                  onChange={(e) => patch({ grossAmount: e.target.value })}
                  placeholder="0.00"
                  disabled={busy}
                />
              </Field>
              <Field label="TDS amount" required>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={values.tdsAmount}
                  onChange={(e) => patch({ tdsAmount: e.target.value })}
                  placeholder="0.00"
                  disabled={busy}
                />
              </Field>
              <Field label="Certificate number">
                <Input
                  value={values.certificateNumber}
                  onChange={(e) =>
                    patch({ certificateNumber: e.target.value })
                  }
                  placeholder="Form 16A no."
                  disabled={busy}
                />
              </Field>
              <Field label="Deposit challan">
                <Input
                  value={values.depositChallanNumber}
                  onChange={(e) =>
                    patch({ depositChallanNumber: e.target.value })
                  }
                  placeholder="Challan no."
                  disabled={busy}
                />
              </Field>
              <Field label="Deposit date">
                <DatePicker
                  value={keyToDate(values.depositDate)}
                  onChange={(d) => patch({ depositDate: dateToKey(d) })}
                  placeholder="Pick a date"
                  disabled={busy}
                  aria-label="Deposit date"
                />
              </Field>
              <Field label="Notes">
                <Textarea
                  value={values.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                  rows={2}
                  placeholder="Section, remarks…"
                  disabled={busy}
                />
              </Field>
            </div>

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
                Cancel
              </Button>
              {nextTransitions.includes('deposited') ? (
                <Button
                  type="button"
                  variant="secondary"
                  iconLeft={Landmark}
                  disabled={busy}
                  onClick={() => void transition('deposited')}
                >
                  Mark deposited
                </Button>
              ) : null}
              {nextTransitions.includes('filed') ? (
                <Button
                  type="button"
                  variant="secondary"
                  iconLeft={FileCheck2}
                  disabled={busy}
                  onClick={() => void transition('filed')}
                >
                  Mark filed
                </Button>
              ) : null}
              <Button type="submit" variant="primary" loading={busy}>
                {editing ? 'Save changes' : 'Create record'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
