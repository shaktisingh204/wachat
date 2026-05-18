'use client';

import { useZoruToast } from '@/components/zoruui';
import {
  ListChecks,
  CheckCircle2,
  AlertTriangle,
  Clock,
  } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

/**
 * Onboarding list — §1D.1 rebuild.
 *
 * KPI (4): In progress · Completed · Overdue · Avg completion days
 * Columns (8): employee · task · category · checklist progress · owner ·
 *   due · status · actions
 * Filters (5): status, owner, category, due-from, employee
 *
 * The HR onboarding collection stores both **template** definitions and
 * **task** instances side-by-side (driven by the existing `_config.ts`).
 * The list view treats every row as a task instance for KPI/column
 * purposes; templates render their own progress as `tasks.length`.
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
import { deleteOnboardingTemplate } from '@/app/actions/hr.actions';

interface Onboarding {
  _id: string;
  employee_id?: string;
  task_name?: string;
  description?: string;
  assigned_to?: string;
  due_date?: string | Date;
  status?: string;
  category?: string;
  completedAt?: string | Date;
  createdAt?: string | Date;
  tasks?: { title: string; dueDays?: number }[];
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'skipped', label: 'Skipped' },
];

const CATEGORY_OPTIONS = [
  { value: 'paperwork', label: 'Paperwork' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'training', label: 'Training' },
  { value: 'access', label: 'Access' },
  { value: 'intro', label: 'Introduction' },
];

export function OnboardingView({ initial }: { initial: Onboarding[] }) {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Onboarding[]>(initial);
  const [search, setSearch] = React.useState('');
  const [activeKpi, setActiveKpi] = React.useState<string | undefined>();
  const [filterValues, setFilterValues] = React.useState<Record<string, string>>(
    {
      status: '',
      owner: '',
      category: '',
      dueFrom: '',
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;
    let ttSum = 0;
    let ttN = 0;
    for (const r of rows) {
      if (r.status === 'completed') {
        completed += 1;
        if (r.createdAt && r.completedAt) {
          const d = +new Date(r.completedAt) - +new Date(r.createdAt);
          if (d > 0) {
            ttSum += Math.round(d / 86_400_000);
            ttN += 1;
          }
        }
      } else if (r.status === 'pending' || !r.status) {
        inProgress += 1;
        if (r.due_date && new Date(r.due_date) < today) overdue += 1;
      }
    }
    return {
      inProgress,
      completed,
      overdue,
      avgDays: ttN > 0 ? Math.round(ttSum / ttN) : 0,
    };
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.task_name ?? ''} ${r.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const statusFilter = activeKpi
        ? activeKpi === 'inProgress'
          ? 'pending'
          : activeKpi === 'completed'
            ? 'completed'
            : ''
        : filterValues.status;
      if (statusFilter && (r.status || 'pending') !== statusFilter)
        return false;
      if (
        filterValues.category &&
        (r.category || '') !== filterValues.category
      )
        return false;
      if (
        filterValues.employee &&
        (r.employee_id || '') !== filterValues.employee
      )
        return false;
      if (
        filterValues.owner &&
        (r.assigned_to || '') !== filterValues.owner
      )
        return false;
      if (filterValues.dueFrom) {
        const from = new Date(filterValues.dueFrom);
        if (!r.due_date || new Date(r.due_date) < from) return false;
      }
      if (activeKpi === 'overdue') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (
          !r.due_date ||
          new Date(r.due_date) >= today ||
          r.status === 'completed'
        )
          return false;
      }
      return true;
    });
  }, [rows, search, filterValues, activeKpi]);

  const kpis: RecruitmentKpi[] = [
    {
      key: 'inProgress',
      label: 'In progress',
      value: counts.inProgress,
      icon: <ListChecks className="h-4 w-4" />,
      filterValue: 'inProgress',
    },
    {
      key: 'completed',
      label: 'Completed',
      value: counts.completed,
      icon: <CheckCircle2 className="h-4 w-4" />,
      filterValue: 'completed',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: counts.overdue,
      icon: <AlertTriangle className="h-4 w-4" />,
      filterValue: 'overdue',
    },
    {
      key: 'avg',
      label: 'Avg completion days',
      value: counts.avgDays > 0 ? `${counts.avgDays}d` : '—',
      icon: <Clock className="h-4 w-4" />,
    },
  ];

  const columns: RecruitmentColumn<Onboarding>[] = [
    {
      key: 'employee_id',
      label: 'Employee',
      render: (r) =>
        r.employee_id ? <code className="text-[11px]">{shorten(r.employee_id)}</code> : '—',
    },
    {
      key: 'task_name',
      label: 'Task',
      render: (r) => (
        <Link
          href={`/dashboard/hrm/hr/onboarding/${r._id}`}
          className="font-medium text-zoru-ink hover:underline"
        >
          {r.task_name || '—'}
        </Link>
      ),
    },
    { key: 'category', label: 'Category', render: (r) => r.category || '—' },
    {
      key: 'progress',
      label: 'Progress',
      render: (r) =>
        r.tasks && r.tasks.length > 0
          ? `${r.tasks.length} items`
          : r.status === 'completed'
            ? '100%'
            : '0%',
    },
    { key: 'assigned_to', label: 'Owner', render: (r) => r.assigned_to || '—' },
    { key: 'due_date', label: 'Due', render: (r) => fmtDate(r.due_date) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => renderStatusCell(r.status || 'pending'),
    },
    { key: 'createdAt', label: 'Created', render: (r) => fmtDate(r.createdAt) },
  ];

  const filters: RecruitmentFilter[] = [
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'category', label: 'Category', type: 'select', options: CATEGORY_OPTIONS },
    { key: 'employee', label: 'Employee', type: 'text', placeholder: 'Employee id' },
    { key: 'owner', label: 'Owner', type: 'text', placeholder: 'Owner id' },
    { key: 'dueFrom', label: 'Due from', type: 'date' },
  ];

  return (
    <RecruitmentListShell<Onboarding>
      title="Onboarding"
      subtitle="Checklists and tasks for new joiners."
      basePath="/dashboard/hrm/hr/onboarding"
      singular="Task"
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
          owner: '',
          category: '',
          dueFrom: '',
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
        const r = await deleteOnboardingTemplate(id);
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
        for (const id of ids) await deleteOnboardingTemplate(id);
        setRows((prev) => prev.filter((x) => !ids.includes(x._id)));
        return { success: true };
      }}
    />
  );
}

function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '—';
  }
}
function shorten(s: string) {
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
