'use client';
import { fmtDate } from '@/lib/utils';

import { useToast } from '@/components/sabcrm/20ui/compat';
import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
  XCircle,
  LayoutGrid,
  Table as TableIcon,
  } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

/**
 * Interviews list — §1D.1 + calendar view per spec.
 *
 * KPI (4): Today · This week · Pending feedback · Cancelled
 * Columns (8): candidate · round · mode · panel · slot · status · score · actions
 * Filters (5): status, mode, date-from, candidate, panel
 * Views: table | calendar (by slot date)
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
import { InterviewsCalendar } from './interviews-calendar';
import { deleteInterview } from '@/app/actions/hr.actions';

interface Interview {
  _id: string;
  candidateId?: string;
  roundNumber?: number;
  roundName?: string;
  interviewerName?: string;
  scheduledAt?: string | Date;
  type?: string;
  result?: string;
  rating?: number;
  feedback?: string;
  location?: string;
  meetingLink?: string;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'rescheduled', label: 'Rescheduled' },
];

const MODE_OPTIONS = [
  { value: 'phone', label: 'Phone' },
  { value: 'video', label: 'Video' },
  { value: 'in-person', label: 'In-person' },
  { value: 'technical', label: 'Technical' },
  { value: 'hr', label: 'HR' },
];

export function InterviewsView({ initial }: { initial: Interview[] }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<Interview[]>(initial);
  const [view, setView] = React.useState<'table' | 'calendar'>('table');
  const [search, setSearch] = React.useState('');
  const [activeKpi, setActiveKpi] = React.useState<string | undefined>();
  const [filterValues, setFilterValues] = React.useState<Record<string, string>>(
    {
      status: '',
      mode: '',
      from: '',
      candidate: '',
      panel: '',
    },
  );
  const [page, setPage] = React.useState(1);

  React.useEffect(() => setRows(initial), [initial]);

  const onSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  const counts = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);

    const out = { today: 0, week: 0, pending: 0, cancelled: 0 };
    for (const r of rows) {
      if (r.scheduledAt) {
        const d = new Date(r.scheduledAt);
        if (d >= today && d < tomorrow) out.today += 1;
        if (d >= today && d < weekEnd) out.week += 1;
      }
      if (r.result === 'pending' || !r.result) out.pending += 1;
      if (r.result === 'rescheduled' || (r as any).status === 'cancelled')
        out.cancelled += 1;
    }
    return out;
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.candidateId ?? ''} ${r.interviewerName ?? ''} ${
          r.roundName ?? ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const statusFilter = activeKpi
        ? activeKpi === 'pending'
          ? 'pending'
          : activeKpi === 'cancelled'
            ? 'rescheduled'
            : ''
        : filterValues.status;
      if (statusFilter && (r.result || 'pending') !== statusFilter)
        return false;
      if (filterValues.mode && (r.type || '') !== filterValues.mode)
        return false;
      if (filterValues.candidate && (r.candidateId || '') !== filterValues.candidate)
        return false;
      if (filterValues.panel && (r.interviewerName || '') !== filterValues.panel)
        return false;
      if (filterValues.from) {
        const from = new Date(filterValues.from);
        if (!r.scheduledAt || new Date(r.scheduledAt) < from) return false;
      }
      if (activeKpi === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        if (!r.scheduledAt) return false;
        const d = new Date(r.scheduledAt);
        if (d < today || d >= tomorrow) return false;
      }
      if (activeKpi === 'week') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() + 7);
        if (!r.scheduledAt) return false;
        const d = new Date(r.scheduledAt);
        if (d < today || d >= weekEnd) return false;
      }
      return true;
    });
  }, [rows, search, filterValues, activeKpi]);

  const kpis: RecruitmentKpi[] = [
    {
      key: 'today',
      label: 'Today',
      value: counts.today.toLocaleString(),
      icon: <CalendarDays className="h-4 w-4" />,
      filterValue: 'today',
    },
    {
      key: 'week',
      label: 'This week',
      value: counts.week.toLocaleString(),
      icon: <CalendarRange className="h-4 w-4" />,
      filterValue: 'week',
    },
    {
      key: 'pending',
      label: 'Pending feedback',
      value: counts.pending.toLocaleString(),
      icon: <ClipboardList className="h-4 w-4" />,
      filterValue: 'pending',
    },
    {
      key: 'cancelled',
      label: 'Cancelled',
      value: counts.cancelled.toLocaleString(),
      icon: <XCircle className="h-4 w-4" />,
      filterValue: 'cancelled',
    },
  ];

  const columns: RecruitmentColumn<Interview>[] = [
    {
      key: 'candidateId',
      label: 'Candidate',
      render: (r) =>
        r.candidateId ? (
          <Link
            href={`/dashboard/hrm/hr/candidates/${r.candidateId}`}
            className="text-[var(--st-text)] hover:underline"
          >
            {shorten(r.candidateId)}
          </Link>
        ) : (
          '—'
        ),
    },
    { key: 'roundNumber', label: 'Round', render: (r) => `R${r.roundNumber ?? '?'}` },
    { key: 'type', label: 'Mode', render: (r) => r.type || '—' },
    { key: 'interviewerName', label: 'Panel', render: (r) => r.interviewerName || '—' },
    {
      key: 'scheduledAt',
      label: 'Slot',
      render: (r) =>
        r.scheduledAt ? fmtDate(r.scheduledAt, true) : '—',
    },
    {
      key: 'result',
      label: 'Status',
      render: (r) => renderStatusCell(r.result || 'pending'),
    },
    { key: 'rating', label: 'Score', render: (r) => (r.rating != null ? `${r.rating}/5` : '—') },
    {
      key: 'meetingLink',
      label: 'Link',
      render: (r) =>
        r.meetingLink ? (
          <Link
            href={r.meetingLink}
            target="_blank"
            className="text-[var(--st-text)] underline-offset-2 hover:underline"
          >
            Open
          </Link>
        ) : (
          '—'
        ),
    },
  ];

  const filters: RecruitmentFilter[] = [
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'mode', label: 'Mode', type: 'select', options: MODE_OPTIONS },
    { key: 'from', label: 'From', type: 'date' },
    { key: 'candidate', label: 'Candidate', type: 'text', placeholder: 'Candidate id' },
    { key: 'panel', label: 'Panel', type: 'text', placeholder: 'Interviewer' },
  ];

  return (
    <RecruitmentListShell<Interview>
      title="Interviews"
      subtitle="Schedule rounds, panel feedback, and recommendations."
      basePath="/dashboard/hrm/hr/interviews"
      singular="Interview"
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
          mode: '',
          from: '',
          candidate: '',
          panel: '',
        });
        setActiveKpi(undefined);
        setSearch('');
        setPage(1);
      }}
      columns={columns}
      views={[
        { key: 'table', label: 'Table', icon: <TableIcon className="h-3.5 w-3.5" /> },
        { key: 'calendar', label: 'Calendar', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
      ]}
      activeView={view}
      onPickView={(v) => setView(v as 'table' | 'calendar')}
      customView={<InterviewsCalendar interviews={filtered} />}
      page={page}
      onPageChange={setPage}
      total={filtered.length}
      onDelete={async (id) => {
        const r = await deleteInterview(id);
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
        for (const id of ids) await deleteInterview(id);
        setRows((prev) => prev.filter((x) => !ids.includes(x._id)));
        return { success: true };
      }}
    />
  );
}

function shorten(s: string) {
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
