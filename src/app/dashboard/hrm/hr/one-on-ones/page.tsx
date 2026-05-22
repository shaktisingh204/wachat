'use client';

import { Button, Card } from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import { Users } from 'lucide-react';

import { getOneOnOnes,
  deleteOneOnOne } from '@/app/actions/hr.actions';
import type { HrOneOnOne } from '@/lib/hr-types';

import {
  HrDateCell,
  HrListShell,
  HrStatusCell,
  } from '../_components/hr-list-shell';

/**
 * One-on-ones — list page rebuilt to §1D.1 bar.
 *
 * KPI strip: Today · This week · Upcoming · Completed.
 * (Pending action-item rollups would need a server aggregate — TODO 1D.1.)
 *
 * View switcher: Table | Calendar (lightweight month grid).
 * Server actions preserved: getOneOnOnes / deleteOneOnOne.
 */

import * as React from 'react';

type Row = HrOneOnOne & {
  _id: string;
  scheduled_date?: string | Date;
  manager_id?: string;
  managerName?: string;
  duration_minutes?: number;
  durationMinutes?: number;
  agenda?: string;
  notes?: string;
};

function ymd(d: Date | string): string {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
}

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function CalendarView({ rows }: { rows: Row[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay = useMemo(() => {
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

export default function OneOnOnesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [view, setView] = useState<'table' | 'calendar'>('table');

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = (await getOneOnOnes()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const now = Date.now();
  const todayStart = startOfDay(now);
  const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000;

  const kpis = React.useMemo(() => {
    let today = 0;
    let thisWeek = 0;
    let upcoming = 0;
    let completed = 0;
    for (const r of rows) {
      const ts = r.scheduled_date ?? r.scheduledAt;
      const t = ts ? new Date(ts).getTime() : NaN;
      if (Number.isFinite(t)) {
        if (t >= todayStart && t < todayStart + 24 * 60 * 60 * 1000) today += 1;
        if (t >= todayStart && t < weekEnd) thisWeek += 1;
        if (t >= now) upcoming += 1;
      }
      if (String(r.status ?? '').toLowerCase() === 'completed') completed += 1;
    }
    return [
      { label: 'Today', value: today, tone: 'blue' as const },
      { label: 'This week', value: thisWeek },
      { label: 'Upcoming', value: upcoming, hint: 'From today onward' },
      { label: 'Completed', value: completed, tone: 'green' as const },
    ];
  }, [rows, now, todayStart, weekEnd]);

  return (
    <HrListShell<Row>
      title="One-on-ones"
      subtitle="Scheduled manager-employee check-ins with agendas, notes, and action items."
      icon={Users}
      newHref="/dashboard/hrm/hr/one-on-ones/new"
      editHref={(r) => `/dashboard/hrm/hr/one-on-ones/${r._id}/edit`}
      rows={rows}
      loading={isLoading}
      kpis={kpis}
      statusOptions={[
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
      ]}
      getRowStatus={(r) => String(r.status ?? '')}
      searchPlaceholder="Search by manager or agenda…"
      searchPredicate={(r, q) =>
        String(r.managerName ?? '').toLowerCase().includes(q) ||
        String(r.agenda ?? '').toLowerCase().includes(q)
      }
      onDelete={deleteOneOnOne}
      onAfterChange={refresh}
      emptyText="No 1:1s yet"
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
      columns={[
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
          render: (r) => {
            const d = r.duration_minutes ?? r.durationMinutes;
            return d ? <span className="tabular-nums">{d}m</span> : <span className="text-zoru-ink-muted">—</span>;
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
      ]}
    >
      {view === 'calendar' ? <CalendarView rows={rows} /> : undefined}
    </HrListShell>
  );
}
