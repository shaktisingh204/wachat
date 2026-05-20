'use client';

/**
 * HR / Probation — Deep list page (§1D template).
 *
 * KPIs: in progress, ending this month, extended, confirmed.
 * Filters: search · status · evaluator · end-date range.
 * Bulk: confirm · extend · terminate · archive · delete · export CSV/XLSX.
 * Server actions live in `crm-probation.actions.ts` (RBAC-guarded, RUST
 * fallback aware, multi-tenant via getSession).
 */

import * as React from 'react';
import { ShieldCheck } from 'lucide-react';

import { HrListShell, HrDateCell, HrStatusCell, type HrExportColumn } from '../_components/hr-list-shell';
import {
  HrDeepListBody,
  type DeepColumn,
  type DeepExportColumn,
  type SelectOption,
} from '../_components/hr-deep-list-body';
import { useZoruToast } from '@/components/zoruui';

import {
  bulkArchiveProbations,
  bulkConfirmProbations,
  bulkExtendProbations,
  bulkTerminateProbations,
  deleteCrmProbation,
  getCrmProbationKpis,
  getCrmProbations,
  type CrmProbationDoc,
  type CrmProbationKpis,
  type ProbationStatus,
} from '@/app/actions/crm-probation.actions';

interface ProbationRow extends Omit<CrmProbationDoc, '_id' | 'userId'> {
  _id: string;
}

const BASE = '/dashboard/crm/hr/probation';

const STATUS_OPTIONS: Array<{ value: ProbationStatus; label: string }> = [
  { value: 'in_progress', label: 'In progress' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'extended', label: 'Extended' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'archived', label: 'Archived' },
];

const EMPTY_KPIS: CrmProbationKpis = {
  total: 0,
  inProgress: 0,
  endingThisMonth: 0,
  extended: 0,
  confirmed: 0,
  terminated: 0,
};

function getRowId(r: ProbationRow): string {
  return String(r._id ?? '');
}

function getRowStatus(r: ProbationRow): string {
  return String(r.status ?? 'in_progress');
}

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ');
}

function inDateRange(value: unknown, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!value) return false;
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) return false;
  if (from) {
    const f = new Date(from);
    if (!Number.isNaN(f.getTime()) && d < f) return false;
  }
  if (to) {
    const t = new Date(to);
    if (!Number.isNaN(t.getTime())) {
      const end = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59);
      if (d > end) return false;
    }
  }
  return true;
}

export default function ProbationListPage() {
  const EXPORT_COLS: HrExportColumn<ProbationRow>[] = [
    { label: 'Employee', value: (r) => r.employeeName ?? r.employeeId ?? '' },
    { label: 'Evaluator', value: (r) => r.evaluatorName ?? r.evaluatorId ?? '' },
    { label: 'Status', value: (r) => getRowStatus(r) },
    { label: 'Start Date', value: (r) => r.startDate ? new Date(r.startDate as unknown as string).toISOString().slice(0, 10) : '' },
    { label: 'End Date', value: (r) => r.endDate ? new Date(r.endDate as unknown as string).toISOString().slice(0, 10) : '' },
    { label: 'Overall Score', value: (r) => r.overallScore ?? '' },
    { label: 'Recommendation', value: (r) => r.recommendation ?? '' },
    { label: 'Notes', value: (r) => r.notes ?? '' },
  ];
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<ProbationRow[]>([]);
  const [kpis, setKpis] = React.useState<CrmProbationKpis>(EMPTY_KPIS);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [evaluator, setEvaluator] = React.useState<string>('all');
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, k] = await Promise.all([
        getCrmProbations(),
        getCrmProbationKpis(),
      ]);
      setRows(((list ?? []) as unknown) as ProbationRow[]);
      setKpis(k ?? EMPTY_KPIS);
    } catch {
      setRows([]);
      setKpis(EMPTY_KPIS);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const evaluatorOptions: SelectOption[] = React.useMemo(() => {
    const set = new Map<string, string>();
    for (const r of rows) {
      const id = String(r.evaluatorId ?? '').trim();
      const name = String(r.evaluatorName ?? '').trim();
      const key = id || name;
      if (key && !set.has(key)) set.set(key, name || id);
    }
    return Array.from(set.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (evaluator !== 'all') {
        const id = String(r.evaluatorId ?? '').trim();
        const name = String(r.evaluatorName ?? '').trim();
        if (id !== evaluator && name !== evaluator) return false;
      }
      if (!inDateRange(r.endDate, dateFrom, dateTo)) return false;
      if (!q) return true;
      const hay = `${r.employeeName ?? ''} ${r.employeeId ?? ''} ${
        r.evaluatorName ?? ''
      } ${r.notes ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, evaluator, dateFrom, dateTo, search]);

  const columns: DeepColumn<ProbationRow>[] = [
    {
      key: 'employee',
      label: 'Employee',
      render: (r) => r.employeeName || r.employeeId || '—',
    },
    {
      key: 'evaluator',
      label: 'Evaluator',
      render: (r) => r.evaluatorName || r.evaluatorId || '—',
    },
    {
      key: 'startDate',
      label: 'Start',
      render: (r) => <HrDateCell value={r.startDate} />,
    },
    {
      key: 'endDate',
      label: 'End',
      render: (r) => <HrDateCell value={r.endDate} />,
    },
    {
      key: 'overallScore',
      label: 'Score',
      numeric: true,
      render: (r) => (r.overallScore != null ? r.overallScore : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <HrStatusCell value={statusLabel(getRowStatus(r))} />,
    },
  ];

  const exportColumns: DeepExportColumn<ProbationRow>[] = [
    { header: 'Employee', value: (r) => r.employeeName ?? r.employeeId ?? '' },
    { header: 'Evaluator', value: (r) => r.evaluatorName ?? r.evaluatorId ?? '' },
    {
      header: 'StartDate',
      value: (r) => (r.startDate ? new Date(r.startDate as unknown as string).toISOString() : ''),
    },
    {
      header: 'EndDate',
      value: (r) => (r.endDate ? new Date(r.endDate as unknown as string).toISOString() : ''),
    },
    { header: 'OverallScore', value: (r) => r.overallScore ?? '' },
    { header: 'Recommendation', value: (r) => r.recommendation ?? '' },
    { header: 'Status', value: (r) => getRowStatus(r) },
    { header: 'Notes', value: (r) => r.notes ?? '' },
  ];

  /** Quick action wrappers — toast + refresh. */
  const runBulk = React.useCallback(
    async (
      action: (ids: string[]) => Promise<{
        success: boolean;
        updated: number;
        error?: string;
      }>,
      verb: string,
      ids: string[],
    ) => {
      if (ids.length === 0) return;
      const res = await action(ids);
      if (res.success) {
        toast({
          title: `${verb} ${res.updated} probation${res.updated === 1 ? '' : 's'}`,
        });
        await refresh();
      } else {
        toast({
          title: `${verb} failed`,
          description: res.error,
          variant: 'destructive',
        });
      }
    },
    [toast, refresh],
  );

  return (
    <HrListShell<ProbationRow>
      title="Probation"
      subtitle="Track probation periods, evaluation criteria and outcomes."
      icon={ShieldCheck}
      newHref={`${BASE}/new`}
      editHref={(r) => `${BASE}/${getRowId(r)}/edit`}
      detailHref={(r) => `${BASE}/${getRowId(r)}`}
      columns={columns}
      rows={filtered}
      loading={loading}
      getRowId={getRowId}
      getRowStatus={getRowStatus}
      statusOptions={STATUS_OPTIONS.map((o) => ({
        value: o.value,
        label: o.label,
      }))}
      searchPredicate={() => true}
      searchPlaceholder="Search by employee, evaluator, notes…"
      kpis={[
        { label: 'In probation', value: kpis.inProgress.toLocaleString() },
        {
          label: 'Ending this month',
          value: kpis.endingThisMonth.toLocaleString(),
          tone: kpis.endingThisMonth > 0 ? 'amber' : 'neutral',
        },
        {
          label: 'Extended',
          value: kpis.extended.toLocaleString(),
          tone: 'amber',
        },
        {
          label: 'Confirmed',
          value: kpis.confirmed.toLocaleString(),
          tone: 'green',
        },
      ]}
      exportColumns={EXPORT_COLS}
      exportBaseName="probation"
      onDelete={async (id) => {
        const res = await deleteCrmProbation(id);
        return { success: res.success, error: res.error };
      }}
      onAfterChange={refresh}
    >
      <HrDeepListBody<ProbationRow>
        rows={filtered}
        columns={columns}
        getRowId={getRowId}
        detailHref={(r) => `${BASE}/${getRowId(r)}`}
        editHref={(r) => `${BASE}/${getRowId(r)}/edit`}
        onDeleteOne={async (id) => {
          const res = await deleteCrmProbation(id);
          return { success: res.success, error: res.error };
        }}
        onBulkDelete={async (ids) => {
          // No hard-delete server action — fall back to per-id archive
          // which sets `status: archived` (the same shape the existing
          // single-delete UX uses).
          await runBulk(bulkArchiveProbations, 'Archived', ids);
          return { success: true, deleted: ids.length };
        }}
        onBulkArchive={async (ids) => {
          await runBulk(bulkArchiveProbations, 'Archived', ids);
          return { success: true, archived: ids.length };
        }}
        onBulkReminder={async (ids) => {
          // Reminder slot repurposed as "Confirm" — extend / terminate
          // are surfaced as inline buttons in `beforeTable`.
          const res = await bulkConfirmProbations(ids);
          return { success: res.success, notified: res.updated, error: res.error };
        }}
        reminderLabel="Confirm"
        onAfterChange={refresh}
        search={search}
        setSearch={setSearch}
        searchPlaceholder="Search by employee, evaluator, notes…"
        ownerOptions={evaluatorOptions}
        owner={evaluator}
        setOwner={setEvaluator}
        dateFrom={dateFrom}
        dateTo={dateTo}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        exportColumns={exportColumns}
        exportName="probations"
        emptyText="No probations match this filter."
        beforeTable={
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-zoru-ink-muted">
            <span>
              Terminated:{' '}
              <span className="font-medium text-zoru-ink">
                {kpis.terminated.toLocaleString()}
              </span>
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void runBulk(
                    bulkExtendProbations,
                    'Extended',
                    filtered.map(getRowId),
                  )
                }
                disabled={filtered.length === 0}
                className="rounded-md border border-zoru-line px-2 py-1 text-[12px] text-zoru-ink hover:bg-zoru-surface-2 disabled:opacity-50"
              >
                Extend filtered
              </button>
              <button
                type="button"
                onClick={() =>
                  void runBulk(
                    bulkTerminateProbations,
                    'Terminated',
                    filtered.map(getRowId),
                  )
                }
                disabled={filtered.length === 0}
                className="rounded-md border border-zoru-line px-2 py-1 text-[12px] text-zoru-ink hover:bg-zoru-surface-2 disabled:opacity-50"
              >
                Terminate filtered
              </button>
            </div>
          </div>
        }
      />
    </HrListShell>
  );
}
