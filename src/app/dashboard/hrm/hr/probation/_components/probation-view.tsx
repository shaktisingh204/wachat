import { fmtDate } from '@/lib/utils';
'use client';

import { useZoruToast } from '@/components/zoruui';
import {
  ShieldCheck,
  CalendarClock,
  Award,
  RefreshCcw,
  } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

/**
 * Probation list — §1D.1 rebuild.
 *
 * KPI (4): Active · Ending this month · Confirmed · Extended
 * Columns (8): employee · reviewer · start · end · status · score ·
 *   review · actions
 * Filters (5): status, reviewer, score, end-from, employee
 */

import * as React from 'react';
import Link from 'next/link';

import {
  RecruitmentListShell,
  renderStatusCell,
  type RecruitmentColumn,
  type RecruitmentFilter,
  type RecruitmentKpi,
} from '../../_components/recruitment-list-shell';
import { deleteProbation } from '@/app/actions/hr.actions';

interface Probation {
  _id: string;
  employeeId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  status?: string;
  reviewerName?: string;
  reviewer_id?: string;
  performanceScore?: number;
  midReviewDate?: string | Date;
  extension_date?: string | Date;
}

const STATUS_OPTIONS = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'passed', label: 'Passed' },
  { value: 'extended', label: 'Extended' },
  { value: 'terminated', label: 'Terminated' },
];

export function ProbationView({ initial }: { initial: Probation[] }) {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Probation[]>(initial);
  const [search, setSearch] = React.useState('');
  const [activeKpi, setActiveKpi] = React.useState<string | undefined>();
  const [filterValues, setFilterValues] = React.useState<Record<string, string>>(
    {
      status: '',
      reviewer: '',
      minScore: '',
      endFrom: '',
      employee: '',
    },
  );
  const [page, setPage] = React.useState(1);

  React.useEffect(() => setRows(initial), [initial]);

  const onSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  const counts = React.useMemo(() => {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    let active = 0;
    let ending = 0;
    let confirmed = 0;
    let extended = 0;
    for (const r of rows) {
      if (r.status === 'ongoing') {
        active += 1;
        if (r.endDate && new Date(r.endDate) <= monthEnd) ending += 1;
      } else if (r.status === 'passed') confirmed += 1;
      else if (r.status === 'extended') extended += 1;
    }
    return { active, ending, confirmed, extended };
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.employeeId ?? ''} ${r.reviewerName ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const statusFilter = activeKpi || filterValues.status;
      if (statusFilter && (r.status || 'ongoing') !== statusFilter)
        return false;
      if (
        filterValues.reviewer &&
        (r.reviewer_id || '') !== filterValues.reviewer
      )
        return false;
      if (filterValues.minScore) {
        const min = Number(filterValues.minScore);
        if (Number.isFinite(min) && (r.performanceScore ?? 0) < min) return false;
      }
      if (filterValues.endFrom) {
        const from = new Date(filterValues.endFrom);
        if (!r.endDate || new Date(r.endDate) < from) return false;
      }
      if (filterValues.employee && (r.employeeId || '') !== filterValues.employee)
        return false;
      return true;
    });
  }, [rows, search, filterValues, activeKpi]);

  const kpis: RecruitmentKpi[] = [
    {
      key: 'active',
      label: 'Active',
      value: counts.active,
      icon: <ShieldCheck className="h-4 w-4" />,
      filterValue: 'ongoing',
    },
    {
      key: 'ending',
      label: 'Ending this month',
      value: counts.ending,
      icon: <CalendarClock className="h-4 w-4" />,
    },
    {
      key: 'confirmed',
      label: 'Confirmed',
      value: counts.confirmed,
      icon: <Award className="h-4 w-4" />,
      filterValue: 'passed',
    },
    {
      key: 'extended',
      label: 'Extended',
      value: counts.extended,
      icon: <RefreshCcw className="h-4 w-4" />,
      filterValue: 'extended',
    },
  ];

  const columns: RecruitmentColumn<Probation>[] = [
    {
      key: 'employeeId',
      label: 'Employee',
      render: (r) =>
        r.employeeId ? (
          <Link
            href={`/dashboard/hrm/hr/directory/${r.employeeId}`}
            className="text-zoru-ink hover:underline"
          >
            {shorten(r.employeeId)}
          </Link>
        ) : (
          '—'
        ),
    },
    { key: 'reviewerName', label: 'Reviewer', render: (r) => r.reviewerName || '—' },
    { key: 'startDate', label: 'Start', render: (r) => fmtDate(r.startDate) },
    { key: 'endDate', label: 'End', render: (r) => fmtDate(r.endDate) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => renderStatusCell(r.status),
    },
    {
      key: 'performanceScore',
      label: 'Score',
      render: (r) =>
        r.performanceScore != null ? `${r.performanceScore}/5` : '—',
    },
    { key: 'midReviewDate', label: 'Mid review', render: (r) => fmtDate(r.midReviewDate) },
    { key: 'extension_date', label: 'Extension', render: (r) => fmtDate(r.extension_date) },
  ];

  const filters: RecruitmentFilter[] = [
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'reviewer', label: 'Reviewer', type: 'text', placeholder: 'Reviewer id' },
    { key: 'minScore', label: 'Min score', type: 'text', placeholder: 'Min score' },
    { key: 'endFrom', label: 'End from', type: 'date' },
    { key: 'employee', label: 'Employee', type: 'text', placeholder: 'Employee id' },
  ];

  return (
    <RecruitmentListShell<Probation>
      title="Probation"
      subtitle="Track probation periods, reviews, and outcomes."
      basePath="/dashboard/hrm/hr/probation"
      singular="Probation"
      rows={filtered}
      kpis={kpis}
      activeKpi={activeKpi}
      onPickKpi={setActiveKpi}
      search={search}
      onSearchChange={onSearch}
      filters={filters}
      filterValues={filterValues}
      onFilterChange={(k, v) => {
        setFilterValues((prev) => ({ ...prev, [k]: v }));
        setPage(1);
      }}
      onClearFilters={() => {
        setFilterValues({
          status: '',
          reviewer: '',
          minScore: '',
          endFrom: '',
          employee: '',
        });
        setActiveKpi(undefined);
        setSearch('');
        setPage(1);
      }}
      columns={columns}
      page={page}
      onPageChange={setPage}
      total={filtered.length}
      onDelete={async (id) => {
        const r = await deleteProbation(id);
        if (r.success) {
          setRows((prev) => prev.filter((x) => x._id !== id));
        } else {
          toast({
            title: 'Delete failed',
            description: r.error,
            variant: 'destructive',
          });
        }
        return r;
      }}
      onBulkDelete={async (ids) => {
        for (const id of ids) await deleteProbation(id);
        setRows((prev) => prev.filter((x) => !ids.includes(x._id)));
        return { success: true };
      }}
    />
  );
}

function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  try {
    return fmtDate(d);
  } catch {
    return '—';
  }
}
function shorten(s: string) {
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
