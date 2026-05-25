'use client';

import { useZoruToast } from '@/components/zoruui';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
  } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import {
  RecruitmentListShell,
  renderStatusCell,
  type RecruitmentColumn,
  type RecruitmentFilter,
  type RecruitmentKpi,
  } from '../../_components/recruitment-list-shell';
import { deleteJobPosting } from '@/app/actions/hr.actions';

/**
 * Jobs list — §1D.1 rebuild.
 *
 * KPI (4): Open · Filled · Closed · Avg time-to-fill
 * Columns (9): title · department · designation · type · openings ·
 *   applicants · status · expiry · created
 * Filters (5): status, department, type, location, owner
 */

import * as React from 'react';
import Link from 'next/link';

interface Job {
  _id: string;
  title?: string;
  departmentId?: string;
  designationId?: string;
  location?: string;
  employmentType?: string;
  totalOpenings?: number;
  status?: string;
  deadline?: string | Date;
  endDate?: string | Date;
  startDate?: string | Date;
  createdAt?: string | Date;
  recruiterId?: string;
  applicantsCount?: number;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'on-hold', label: 'On hold' },
  { value: 'closed', label: 'Closed' },
];

const TYPE_OPTIONS = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'freelance', label: 'Freelance' },
];

export function JobsView({ initial }: { initial: Job[] }) {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Job[]>(initial);
  const [search, setSearch] = React.useState('');
  const [activeKpi, setActiveKpi] = React.useState<string | undefined>();
  const [filterValues, setFilterValues] = React.useState<Record<string, string>>(
    {
      status: '',
      department: '',
      type: '',
      location: '',
      owner: '',
    },
  );
  const [page, setPage] = React.useState(1);

  React.useEffect(() => setRows(initial), [initial]);

  const onSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.title ?? ''}`.toLowerCase().includes(q)) return false;
      const statusFilter = activeKpi || filterValues.status;
      if (statusFilter && (r.status || '') !== statusFilter) return false;
      if (
        filterValues.department &&
        (r.departmentId || '') !== filterValues.department
      )
        return false;
      if (filterValues.type && (r.employmentType || '') !== filterValues.type)
        return false;
      if (filterValues.location && (r.location || '') !== filterValues.location)
        return false;
      if (filterValues.owner && (r.recruiterId || '') !== filterValues.owner)
        return false;
      return true;
    });
  }, [rows, search, filterValues, activeKpi]);

  const counts = React.useMemo(() => {
    const c = { open: 0, filled: 0, closed: 0, ttfDays: 0 };
    let ttfSum = 0;
    let ttfN = 0;
    for (const r of rows) {
      if (r.status === 'open') c.open += 1;
      if (r.status === 'closed') c.closed += 1;
      if ((r as any).filledAt || r.status === 'filled') {
        c.filled += 1;
        const created = r.createdAt ? +new Date(r.createdAt) : null;
        const filled = (r as any).filledAt
          ? +new Date((r as any).filledAt)
          : null;
        if (created && filled && filled > created) {
          ttfSum += Math.round((filled - created) / 86_400_000);
          ttfN += 1;
        }
      }
    }
    c.ttfDays = ttfN > 0 ? Math.round(ttfSum / ttfN) : 0;
    return c;
  }, [rows]);

  const kpis: RecruitmentKpi[] = [
    {
      key: 'open',
      label: 'Open',
      value: counts.open.toLocaleString(),
      icon: <Briefcase className="h-4 w-4" />,
      filterValue: 'open',
    },
    {
      key: 'filled',
      label: 'Filled',
      value: counts.filled.toLocaleString(),
      icon: <CheckCircle2 className="h-4 w-4" />,
      filterValue: 'filled',
    },
    {
      key: 'closed',
      label: 'Closed',
      value: counts.closed.toLocaleString(),
      icon: <XCircle className="h-4 w-4" />,
      filterValue: 'closed',
    },
    {
      key: 'ttf',
      label: 'Avg time-to-fill',
      value: counts.ttfDays > 0 ? `${counts.ttfDays}d` : '—',
      icon: <Clock className="h-4 w-4" />,
    },
  ];

  const columns: RecruitmentColumn<Job>[] = [
    {
      key: 'title',
      label: 'Title',
      render: (r) => (
        <Link
          href={`/dashboard/hrm/hr/jobs/${r._id}`}
          className="font-medium text-zoru-ink hover:underline"
        >
          {r.title || '—'}
        </Link>
      ),
    },
    {
      key: 'departmentId',
      label: 'Department',
      render: (r) => (r.departmentId ? shorten(r.departmentId) : '—'),
    },
    {
      key: 'designationId',
      label: 'Designation',
      render: (r) => (r.designationId ? shorten(r.designationId) : '—'),
    },
    { key: 'employmentType', label: 'Type', render: (r) => r.employmentType || '—' },
    {
      key: 'totalOpenings',
      label: 'Openings',
      render: (r) => String(r.totalOpenings ?? '—'),
    },
    {
      key: 'applicantsCount',
      label: 'Applicants',
      render: (r) => String(r.applicantsCount ?? 0),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => renderStatusCell(r.status),
    },
    {
      key: 'deadline',
      label: 'Expiry',
      render: (r) => fmtDate(r.deadline || r.endDate),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (r) => fmtDate(r.createdAt),
    },
  ];

  const filters: RecruitmentFilter[] = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: STATUS_OPTIONS,
    },
    { key: 'department', label: 'Department', type: 'text', placeholder: 'Department id' },
    { key: 'type', label: 'Type', type: 'select', options: TYPE_OPTIONS },
    { key: 'location', label: 'Location', type: 'text', placeholder: 'Location id' },
    { key: 'owner', label: 'Owner', type: 'text', placeholder: 'Recruiter id' },
  ];

  return (
    <RecruitmentListShell<Job>
      title="Jobs"
      subtitle="Open roles, JDs, and hiring pipelines."
      basePath="/dashboard/hrm/hr/jobs"
      singular="Job"
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
          department: '',
          type: '',
          location: '',
          owner: '',
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
        const r = await deleteJobPosting(id);
        if (r.success) {
          setRows((prev) => prev.filter((j) => j._id !== id));
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
        for (const id of ids) await deleteJobPosting(id);
        setRows((prev) => prev.filter((j) => !ids.includes(j._id)));
        return { success: true };
      }}
    />
  );
}


function shorten(s: string) {
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
