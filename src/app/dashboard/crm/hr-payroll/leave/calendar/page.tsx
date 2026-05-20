'use client';

/**
 * Leave Calendar — month-grid view with KPI strip, filters, and legend.
 *
 * Multi-tenant: all data flows through `getLeavesForDateRange` /
 * `getLeaveTypes` / `getCrmEmployees` / `getCrmDepartments`, each of
 * which scopes to the current tenant server-side.
 *
 * KPIs (computed client-side from the loaded month window):
 *   - Total leaves this month
 *   - Today's absentees
 *   - This-week leave-days
 *   - By department breakdown (top 3)
 *
 * Toolbar: department filter, leave-type filter, "Today" + Prev/Next nav.
 * Legend: leave-type chips with color swatches.
 */

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  CalendarRange,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getLeavesForDateRange, getLeaveTypes } from '@/app/actions/worksuite/leave.actions';
import {
  getCrmEmployees,
  getCrmDepartments,
} from '@/app/actions/crm-employees.actions';
import type {
  WsLeaveCalendarEntry,
  WsLeaveType,
} from '@/lib/worksuite/leave-types';
import type { WithId, CrmDepartment } from '@/lib/definitions';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function monthEnd(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function startOfWeekIso(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return toIso(x);
}
function endOfWeekIso(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + (6 - x.getDay()));
  return toIso(x);
}

type EmployeeLite = {
  _id: string | { toString(): string };
  firstName?: string;
  lastName?: string;
  departmentId?: string | { toString(): string } | null;
};

export default function LeaveCalendarPage() {
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [entries, setEntries] = useState<WsLeaveCalendarEntry[]>([]);
  const [types, setTypes] = useState<WsLeaveType[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [departments, setDepartments] = useState<WithId<CrmDepartment>[]>([]);

  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [isLoading, startTransition] = useTransition();

  const start = useMemo(() => monthStart(cursor), [cursor]);
  const end = useMemo(() => monthEnd(cursor), [cursor]);

  // Load static data once
  useEffect(() => {
    startTransition(async () => {
      const [ts, emps, deps] = await Promise.all([
        getLeaveTypes(),
        getCrmEmployees(),
        getCrmDepartments(),
      ]);
      setTypes(ts);
      setEmployees(emps as EmployeeLite[]);
      setDepartments(deps);
    });
  }, []);

  // Reload entries when month changes
  useEffect(() => {
    startTransition(async () => {
      const rows = await getLeavesForDateRange(start, end);
      setEntries(rows);
    });
  }, [start, end]);

  // employee -> departmentId map (string)
  const empDeptMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) {
      const id = String(e._id);
      const dep = e.departmentId ? String(e.departmentId) : '';
      m.set(id, dep);
    }
    return m;
  }, [employees]);

  const deptNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of departments) m.set(String(d._id), d.name);
    return m;
  }, [departments]);

  // Apply filters
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter !== 'all' && e.leave_type_id !== typeFilter) return false;
      if (departmentFilter !== 'all') {
        const dep = empDeptMap.get(e.user_id) ?? '';
        if (dep !== departmentFilter) return false;
      }
      return true;
    });
  }, [entries, typeFilter, departmentFilter, empDeptMap]);

  const entriesByDay = useMemo(() => {
    const m = new Map<string, WsLeaveCalendarEntry[]>();
    for (const e of filteredEntries) {
      const bucket = m.get(e.date) ?? [];
      bucket.push(e);
      m.set(e.date, bucket);
    }
    return m;
  }, [filteredEntries]);

  // KPIs
  const todayIso = toIso(new Date());
  const weekStart = startOfWeekIso(new Date());
  const weekEnd = endOfWeekIso(new Date());

  const kpiTotalMonth = filteredEntries.length;
  const kpiTodayAbsent = filteredEntries.filter((e) => e.date === todayIso).length;
  const kpiThisWeek = filteredEntries.filter(
    (e) => e.date >= weekStart && e.date <= weekEnd,
  ).length;

  const kpiByDept = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filteredEntries) {
      const dep = empDeptMap.get(e.user_id) ?? '';
      const name = dep ? (deptNameMap.get(dep) ?? 'Unassigned') : 'Unassigned';
      m.set(name, (m.get(name) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [filteredEntries, empDeptMap, deptNameMap]);

  const grid = useMemo(() => {
    const first = start.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: Array<{ date: Date | null; iso: string | null }> = [];
    for (let i = 0; i < first; i++) cells.push({ date: null, iso: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
      date.setHours(0, 0, 0, 0);
      cells.push({ date, iso: toIso(date) });
    }
    return cells;
  }, [cursor, start]);

  const goPrev = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNext = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToday = () => setCursor(new Date());

  const monthLabel = cursor.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <EntityListShell
      title="Leave Calendar"
      subtitle="Monthly view of approved leaves across the organization."
    >
      {/* KPI strip */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Total leaves this month"
          value={kpiTotalMonth.toLocaleString('en-IN')}
          hint={monthLabel}
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Today's absentees"
          value={kpiTodayAbsent.toLocaleString('en-IN')}
          hint={todayIso}
        />
        <KpiCard
          icon={<CalendarRange className="h-4 w-4" />}
          label="This week"
          value={kpiThisWeek.toLocaleString('en-IN')}
          hint={`${weekStart} → ${weekEnd}`}
        />
        <KpiCard
          icon={<Building2 className="h-4 w-4" />}
          label="By department (top 3)"
          value={kpiByDept.length === 0 ? '0' : String(kpiByDept[0]?.[1] ?? 0)}
          hint={
            kpiByDept.length === 0
              ? 'No leaves'
              : kpiByDept.map(([n, c]) => `${n}: ${c}`).join(', ')
          }
        />
      </div>

      <ZoruCard className="p-6">
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" onClick={goPrev} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
              Prev
            </ZoruButton>
            <div className="min-w-[180px] text-center text-[16px] text-zoru-ink">
              {monthLabel}
            </div>
            <ZoruButton variant="outline" onClick={goNext} aria-label="Next month">
              Next
              <ChevronRight className="h-4 w-4" />
            </ZoruButton>
            <ZoruButton variant="outline" onClick={goToday}>
              Today
            </ZoruButton>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <ZoruSelect value={departmentFilter} onValueChange={setDepartmentFilter}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Department" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All departments</ZoruSelectItem>
                  {departments.map((d) => (
                    <ZoruSelectItem key={String(d._id)} value={String(d._id)}>
                      {d.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="w-44">
              <ZoruSelect value={typeFilter} onValueChange={setTypeFilter}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Leave type" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All types</ZoruSelectItem>
                  {types.map((t) => (
                    <ZoruSelectItem key={String(t._id)} value={String(t._id)}>
                      {t.type_name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[11.5px] uppercase text-zoru-ink-muted"
            >
              {d}
            </div>
          ))}
          {grid.map((cell, idx) => {
            if (!cell.date) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[90px] rounded-lg border border-transparent"
                />
              );
            }
            const dayEntries = entriesByDay.get(cell.iso!) ?? [];
            const isToday = cell.iso === todayIso;
            return (
              <div
                key={cell.iso!}
                className={
                  'min-h-[90px] rounded-lg border bg-zoru-bg p-1.5 ' +
                  (isToday
                    ? 'border-zoru-ink ring-1 ring-zoru-ink'
                    : 'border-zoru-line')
                }
              >
                <div className="mb-1 text-[12px] text-zoru-ink">
                  {cell.date.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEntries.slice(0, 3).map((e) => (
                    <div
                      key={`${e._id}-${e.date}`}
                      className="truncate rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        backgroundColor: (e.color || '#94A3B8') + '25',
                        color: e.color || '#64748B',
                      }}
                      title={`${e.employeeName} — ${e.type_name}`}
                    >
                      {e.employeeName ?? 'Employee'}
                    </div>
                  ))}
                  {dayEntries.length > 3 ? (
                    <div className="text-[10.5px] text-zoru-ink-muted">
                      +{dayEntries.length - 3} more
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        {types.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zoru-line pt-4">
            <span className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
              Legend
            </span>
            {types.map((t) => (
              <ZoruBadge
                key={String(t._id)}
                variant="outline"
                className="gap-1.5"
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: t.color || '#94A3B8' }}
                />
                {t.type_name}
              </ZoruBadge>
            ))}
          </div>
        ) : null}

        {isLoading ? (
          <p className="mt-4 text-center text-[12px] text-zoru-ink-muted">Loading…</p>
        ) : null}
      </ZoruCard>
    </EntityListShell>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <ZoruCard className="p-5">
      <div className="flex items-center gap-2 text-zoru-ink-muted">
        {icon}
        <p className="text-[12.5px] font-medium">{label}</p>
      </div>
      <div className="mt-2 text-2xl text-zoru-ink">{value}</div>
      {hint ? (
        <p className="mt-1 truncate text-[11.5px] text-zoru-ink-muted" title={hint}>
          {hint}
        </p>
      ) : null}
    </ZoruCard>
  );
}
