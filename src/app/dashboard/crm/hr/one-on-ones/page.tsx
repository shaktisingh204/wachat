'use client';

/**
 * One-on-ones — §1D Deep-list page.
 *
 * KPI strip:
 *   - Total scheduled
 *   - Completed this month
 *   - Overdue (scheduled in past, not completed)
 *   - Avg duration (minutes)
 *
 * Filters: search · status · department · manager · date range
 * Bulk:    archive · delete · send-reminder · export CSV / XLSX
 *
 * View switcher (Table | Calendar) preserved from previous shell.
 */

import * as React from 'react';
import Link from 'next/link';
import { Plus, Users } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
  bulkArchiveOneOnOnes,
  bulkDeleteOneOnOnes,
  bulkRemindOneOnOnes,
  deleteOneOnOne,
  getOneOnOnes,
} from '@/app/actions/hr.actions';
import type { HrOneOnOne } from '@/lib/hr-types';

import {
  HrDateCell,
  HrStatusCell,
} from '../_components/hr-list-shell';
import {
  HrDeepListBody,
  type DeepColumn,
} from '../_components/hr-deep-list-body';

type Row = HrOneOnOne & {
  _id: string;
  scheduled_date?: string | Date;
  manager_id?: string;
  managerName?: string;
  duration_minutes?: number;
  durationMinutes?: number;
  department?: string;
  agenda?: string;
  notes?: string;
};

const BASE = '/dashboard/crm/hr/one-on-ones';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function ymd(d: Date | string): string {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
}

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function rowScheduled(r: Row): number | null {
  const v = r.scheduled_date ?? r.scheduledAt;
  if (!v) return null;
  const t = new Date(v as string | Date).getTime();
  return Number.isFinite(t) ? t : null;
}

function rowDuration(r: Row): number | null {
  const d = r.duration_minutes ?? r.durationMinutes;
  return typeof d === 'number' && Number.isFinite(d) ? d : null;
}

/* ─── Calendar view (preserved) ─────────────────────────────────────── */

function CalendarView({ rows }: { rows: Row[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay = React.useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const ts = r.scheduled_date ?? r.scheduledAt;
      if (!ts) continue;
      const key = ymd(ts as string | Date);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return map;
  }, [rows]);

  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < startDow; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });

  return (
    <ZoruCard className="p-4">
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] text-zoru-ink-muted">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          const key = c.day ? ymd(new Date(year, month, c.day)) : `e-${i}`;
          const list = c.day ? byDay.get(key) ?? [] : [];
          return (
            <div
              key={key}
              className={
                'min-h-[72px] rounded border p-1 text-[11px] ' +
                (c.day
                  ? 'border-zoru-line bg-zoru-bg text-zoru-ink'
                  : 'border-transparent bg-transparent')
              }
            >
              {c.day ? (
                <>
                  <div className="font-medium">{c.day}</div>
                  <div className="mt-1 space-y-0.5">
                    {list.slice(0, 3).map((r) => (
                      <div
                        key={String(r._id)}
                        className="truncate rounded bg-zoru-surface-2 px-1 py-0.5 text-[10px]"
                        title={r.agenda || r.managerName || '1:1'}
                      >
                        {r.managerName || '1:1'}
                      </div>
                    ))}
                    {list.length > 3 ? (
                      <div className="text-[10px] text-zoru-ink-muted">
                        +{list.length - 3} more
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </ZoruCard>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function OneOnOnesPage(): React.JSX.Element {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [isLoading, startTransition] = React.useTransition();
  const [view, setView] = React.useState<'table' | 'calendar'>('table');

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [dept, setDept] = React.useState<string>('all');
  const [manager, setManager] = React.useState<string>('all');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  const refresh = React.useCallback(() => {
    startTransition(async () => {
      const data = (await getOneOnOnes()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  /* ── KPIs ──────────────────────────────────────────────────────── */

  const kpis = React.useMemo(() => {
    const now = Date.now();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    let completedThisMonth = 0;
    let overdue = 0;
    let totalDuration = 0;
    let durationN = 0;
    for (const r of rows) {
      const status = String(r.status ?? '').toLowerCase();
      const t = rowScheduled(r);
      if (status === 'completed') {
        if (t !== null && t >= monthStart) completedThisMonth += 1;
      } else if (status !== 'cancelled' && t !== null && t < now) {
        overdue += 1;
      }
      const d = rowDuration(r);
      if (d !== null) {
        totalDuration += d;
        durationN += 1;
      }
    }
    return {
      totalScheduled: rows.length,
      completedThisMonth,
      overdue,
      avgDuration: durationN ? Math.round(totalDuration / durationN) : 0,
    };
  }, [rows]);

  /* ── filter options ────────────────────────────────────────────── */

  const deptOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.department) set.add(r.department);
    return Array.from(set).sort().map((v) => ({ value: v, label: v }));
  }, [rows]);

  const ownerOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      const id = String(r.manager_id ?? r.managerName ?? '');
      if (id && !seen.has(id)) seen.set(id, r.managerName ?? id);
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [rows]);

  /* ── filtered rows ──────────────────────────────────────────────── */

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    return rows.filter((r) => {
      const status = String(r.status ?? '').toLowerCase();
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (dept !== 'all' && (r.department ?? '') !== dept) return false;
      if (manager !== 'all') {
        const id = String(r.manager_id ?? r.managerName ?? '');
        if (id !== manager) return false;
      }
      if (q) {
        const hay = `${r.managerName ?? ''} ${r.agenda ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const ts = rowScheduled(r);
      if (from !== null && (ts == null || ts < from)) return false;
      if (to !== null && (ts == null || ts > to)) return false;
      return true;
    });
  }, [rows, search, statusFilter, dept, manager, dateFrom, dateTo]);

  const columns: DeepColumn<Row>[] = React.useMemo(
    () => [
      { key: 'manager', label: 'Manager', render: (r) => r.managerName ?? '—' },
      {
        key: 'employee',
        label: 'Employee',
        render: (r) => String(r.employeeId ?? '—'),
      },
      {
        key: 'scheduled',
        label: 'Scheduled',
        render: (r) => <HrDateCell value={r.scheduled_date ?? r.scheduledAt} />,
      },
      {
        key: 'duration',
        label: 'Duration',
        numeric: true,
        render: (r) => {
          const d = rowDuration(r);
          return d !== null ? (
            <span className="tabular-nums">{d}m</span>
          ) : (
            <span className="text-zoru-ink-muted">—</span>
          );
        },
      },
      {
        key: 'agenda',
        label: 'Agenda',
        render: (r) => (
          <span className="block max-w-[260px] truncate text-zoru-ink-muted">
            {r.agenda ?? '—'}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (r) => <HrStatusCell value={String(r.status ?? '')} />,
      },
    ],
    [],
  );

  return (
    <EntityListShell
      title="One-on-ones"
      subtitle="Scheduled manager-employee check-ins with agendas, notes, and action items."
      primaryAction={
        <ZoruButton asChild>
          <Link href={`${BASE}/new`}>
            <Plus className="h-4 w-4" /> New 1:1
          </Link>
        </ZoruButton>
      }
      viewSwitcher={
        <div className="inline-flex overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line">
          <ZoruButton
            size="sm"
            variant={view === 'table' ? 'default' : 'ghost'}
            onClick={() => setView('table')}
          >
            Table
          </ZoruButton>
          <ZoruButton
            size="sm"
            variant={view === 'calendar' ? 'default' : 'ghost'}
            onClick={() => setView('calendar')}
          >
            Calendar
          </ZoruButton>
        </div>
      }
      filters={
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((opt) => (
            <ZoruButton
              key={opt.value}
              variant={statusFilter === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </ZoruButton>
          ))}
        </div>
      }
      loading={isLoading && rows.length === 0}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">Total scheduled</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.totalScheduled}</p>
          </ZoruCard>
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">Completed this month</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.completedThisMonth}</p>
          </ZoruCard>
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">Overdue</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.overdue}</p>
          </ZoruCard>
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">Avg duration</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.avgDuration}m</p>
          </ZoruCard>
        </div>

        {view === 'calendar' ? (
          <CalendarView rows={filtered} />
        ) : rows.length === 0 && !isLoading ? (
          <ZoruCard className="flex min-h-[180px] flex-col items-center justify-center gap-3 p-6">
            <Users className="h-8 w-8 text-zoru-ink-muted" aria-hidden="true" />
            <p className="text-sm text-zoru-ink-muted">No 1:1s yet.</p>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="h-4 w-4" /> Schedule a 1:1
              </Link>
            </ZoruButton>
          </ZoruCard>
        ) : (
          <HrDeepListBody<Row>
            rows={filtered}
            columns={columns}
            getRowId={(r) => String(r._id)}
            detailHref={(r) => `${BASE}/${r._id}/edit`}
            editHref={(r) => `${BASE}/${r._id}/edit`}
            onDeleteOne={deleteOneOnOne}
            onBulkDelete={bulkDeleteOneOnOnes}
            onBulkArchive={bulkArchiveOneOnOnes}
            onBulkReminder={bulkRemindOneOnOnes}
            reminderLabel="Remind attendees"
            onAfterChange={refresh}
            search={search}
            setSearch={setSearch}
            searchPlaceholder="Search by manager or agenda…"
            deptOptions={deptOptions}
            dept={dept}
            setDept={setDept}
            ownerOptions={ownerOptions}
            owner={manager}
            setOwner={setManager}
            dateFrom={dateFrom}
            dateTo={dateTo}
            setDateFrom={setDateFrom}
            setDateTo={setDateTo}
            exportColumns={[
              { header: 'Manager', value: (r) => r.managerName ?? '' },
              { header: 'Employee', value: (r) => String(r.employeeId ?? '') },
              {
                header: 'Scheduled',
                value: (r) => {
                  const t = rowScheduled(r);
                  return t === null ? '' : new Date(t).toISOString().slice(0, 10);
                },
              },
              {
                header: 'Duration (min)',
                value: (r) => rowDuration(r) ?? '',
              },
              { header: 'Agenda', value: (r) => r.agenda ?? '' },
              { header: 'Status', value: (r) => String(r.status ?? '') },
              { header: 'Department', value: (r) => r.department ?? '' },
            ]}
            exportName="one-on-ones"
            emptyText="No 1:1s match these filters."
          />
        )}
      </div>
    </EntityListShell>
  );
}
