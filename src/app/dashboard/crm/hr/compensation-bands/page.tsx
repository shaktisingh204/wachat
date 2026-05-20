'use client';

/**
 * HR / Compensation Bands — Deep list page (§1D template).
 *
 * KPIs (server-aggregated): total bands, distinct levels, avg min/max salary,
 * bands due for review (>6 months since last update).
 * Filters: search · level · department · last-reviewed range.
 * Bulk: archive · delete · export CSV/XLSX.
 *
 * Server actions in `hr.actions.ts`. Multi-tenant via getSession.
 */

import * as React from 'react';
import { LineChart } from 'lucide-react';

import { HrListShell, type HrExportColumn } from '../_components/hr-list-shell';
import {
  HrDeepListBody,
  type DeepColumn,
  type DeepExportColumn,
  type SelectOption,
} from '../_components/hr-deep-list-body';
import {
  bulkArchiveCompensationBands,
  bulkDeleteCompensationBands,
  deleteCompensationBand,
  getCompensationBandKpis,
  getCompensationBands,
  type HrCompensationBandKpis,
} from '@/app/actions/hr.actions';

interface BandRow {
  _id: string;
  title?: string;
  level?: string;
  department?: string;
  min_salary?: number;
  max_salary?: number;
  minSalary?: number;
  maxSalary?: number;
  currency?: string;
  currency_type?: string;
  isActive?: boolean | string;
  notes?: string;
  updatedAt?: string | Date;
  lastReviewedAt?: string | Date;
}

const BASE = '/dashboard/crm/hr/compensation-bands';

const EMPTY_KPIS: HrCompensationBandKpis = {
  total: 0,
  distinctLevels: 0,
  avgMinSalary: 0,
  avgMaxSalary: 0,
  bandsDueReview: 0,
  byLevel: [],
};

function getRowId(r: BandRow): string {
  return String(r._id ?? '');
}

function minSalary(r: BandRow): number {
  return Number(r.min_salary ?? r.minSalary) || 0;
}

function maxSalary(r: BandRow): number {
  return Number(r.max_salary ?? r.maxSalary) || 0;
}

function fmtMoney(n: number, currency: string): string {
  if (!n) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toLocaleString()} ${currency || ''}`.trim();
  }
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

export default function CompensationBandsPage() {
  const EXPORT_COLS: HrExportColumn<BandRow>[] = [
    { label: 'Role', value: (r) => r.title ?? '' },
    { label: 'Level', value: (r) => r.level ?? '' },
    { label: 'Department', value: (r) => r.department ?? '' },
    { label: 'Min Salary', value: (r) => minSalary(r) },
    { label: 'Max Salary', value: (r) => maxSalary(r) },
    { label: 'Currency', value: (r) => r.currency ?? r.currency_type ?? '' },
    { label: 'Active', value: (r) => String(r.isActive ?? '') },
    { label: 'Last Reviewed', value: (r) => r.lastReviewedAt ? new Date(r.lastReviewedAt as string).toISOString().slice(0, 10) : '' },
    { label: 'Updated At', value: (r) => r.updatedAt ? new Date(r.updatedAt as string).toISOString().slice(0, 10) : '' },
    { label: 'Notes', value: (r) => r.notes ?? '' },
  ];
  const [rows, setRows] = React.useState<BandRow[]>([]);
  const [kpis, setKpis] = React.useState<HrCompensationBandKpis>(EMPTY_KPIS);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [level, setLevel] = React.useState<string>('all');
  const [dept, setDept] = React.useState<string>('all');
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, k] = await Promise.all([
        getCompensationBands(),
        getCompensationBandKpis(),
      ]);
      setRows((list ?? []) as unknown as BandRow[]);
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

  const levelOptions: SelectOption[] = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const v = String(r.level ?? '').trim();
      if (v) set.add(v);
    }
    return Array.from(set)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  const deptOptions: SelectOption[] = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const v = String(r.department ?? '').trim();
      if (v) set.add(v);
    }
    return Array.from(set)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (level !== 'all' && String(r.level ?? '') !== level) return false;
      if (dept !== 'all' && String(r.department ?? '') !== dept) return false;
      if (!inDateRange(r.lastReviewedAt ?? r.updatedAt, dateFrom, dateTo)) return false;
      if (!q) return true;
      const hay = `${r.title ?? ''} ${r.level ?? ''} ${r.department ?? ''} ${r.notes ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, level, dept, dateFrom, dateTo, search]);

  const columns: DeepColumn<BandRow>[] = [
    { key: 'title', label: 'Role', render: (r) => r.title || '—' },
    { key: 'level', label: 'Level', render: (r) => r.level || '—' },
    {
      key: 'department',
      label: 'Department',
      render: (r) => r.department || '—',
    },
    {
      key: 'min',
      label: 'Min',
      numeric: true,
      render: (r) => fmtMoney(minSalary(r), r.currency ?? ''),
    },
    {
      key: 'max',
      label: 'Max',
      numeric: true,
      render: (r) => fmtMoney(maxSalary(r), r.currency ?? ''),
    },
    {
      key: 'currency',
      label: 'Currency',
      render: (r) => r.currency || '—',
    },
  ];

  const exportColumns: DeepExportColumn<BandRow>[] = [
    { header: 'Role', value: (r) => r.title ?? '' },
    { header: 'Level', value: (r) => r.level ?? '' },
    { header: 'Department', value: (r) => r.department ?? '' },
    { header: 'MinSalary', value: (r) => minSalary(r) },
    { header: 'MaxSalary', value: (r) => maxSalary(r) },
    { header: 'Currency', value: (r) => r.currency ?? '' },
    { header: 'Notes', value: (r) => r.notes ?? '' },
  ];

  const topLevel = kpis.byLevel[0]?.level;

  return (
    <HrListShell<BandRow>
      title="Compensation Bands"
      subtitle="Salary bands by role and level — keep them fresh."
      icon={LineChart}
      newHref={`${BASE}/new`}
      editHref={(r) => `${BASE}/${getRowId(r)}/edit`}
      detailHref={(r) => `${BASE}/${getRowId(r)}`}
      columns={columns}
      rows={filtered}
      loading={loading}
      getRowId={getRowId}
      searchPredicate={() => true}
      searchPlaceholder="Search by role, level, department…"
      kpis={[
        { label: 'Total bands', value: kpis.total.toLocaleString() },
        {
          label: 'Distinct levels',
          value: kpis.distinctLevels.toLocaleString(),
          hint: topLevel ? `Top: ${topLevel}` : undefined,
        },
        {
          label: 'Avg salary range',
          value: `${fmtMoney(kpis.avgMinSalary, 'INR')} – ${fmtMoney(kpis.avgMaxSalary, 'INR')}`,
        },
        {
          label: 'Due for review',
          value: kpis.bandsDueReview.toLocaleString(),
          tone: kpis.bandsDueReview > 0 ? 'amber' : 'neutral',
          hint: '>6 months since update',
        },
      ]}
      exportColumns={EXPORT_COLS}
      exportBaseName="compensation-bands"
      onDelete={async (id) => {
        const res = await deleteCompensationBand(id);
        return { success: !!res?.success, error: res?.error };
      }}
      onAfterChange={refresh}
    >
      <HrDeepListBody<BandRow>
        rows={filtered}
        columns={columns}
        getRowId={getRowId}
        detailHref={(r) => `${BASE}/${getRowId(r)}`}
        editHref={(r) => `${BASE}/${getRowId(r)}/edit`}
        onDeleteOne={async (id) => {
          const res = await deleteCompensationBand(id);
          return { success: !!res?.success, error: res?.error };
        }}
        onBulkDelete={async (ids) => {
          const res = await bulkDeleteCompensationBands(ids);
          return { success: res.success, deleted: res.deleted, error: res.error };
        }}
        onBulkArchive={async (ids) => {
          const res = await bulkArchiveCompensationBands(ids);
          return { success: res.success, archived: res.archived, error: res.error };
        }}
        onAfterChange={refresh}
        search={search}
        setSearch={setSearch}
        searchPlaceholder="Search by role, level, department…"
        cycleOptions={levelOptions}
        cycle={level}
        setCycle={setLevel}
        cycleLabel="Level"
        deptOptions={deptOptions}
        dept={dept}
        setDept={setDept}
        dateFrom={dateFrom}
        dateTo={dateTo}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        exportColumns={exportColumns}
        exportName="compensation-bands"
        emptyText="No compensation bands match this filter."
      />
    </HrListShell>
  );
}
