'use client';

import { Card, Button } from '@/components/zoruui';
import {
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getLeavesForDateRange } from '@/app/actions/worksuite/leave.actions';
import { listDepartments } from '@/app/actions/crm/departments.actions';
import type { WsLeaveCalendarEntry } from '@/lib/worksuite/leave-types';
import type { CrmDepartmentDoc } from '@/lib/rust-client/crm-departments';

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
function weekStart(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}
function weekEnd(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + (6 - x.getDay()));
  x.setHours(23, 59, 59, 999);
  return x;
}
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type ViewMode = 'month' | 'week' | 'day';

export default function LeaveCalendarPage() {
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [entries, setEntries] = useState<WsLeaveCalendarEntry[]>([]);
  const [departments, setDepartments] = useState<CrmDepartmentDoc[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [isLoading, startTransition] = useTransition();

  const { start, end } = useMemo(() => {
    if (viewMode === 'month') {
      return { start: monthStart(cursor), end: monthEnd(cursor) };
    } else if (viewMode === 'week') {
      return { start: weekStart(cursor), end: weekEnd(cursor) };
    } else {
      const d = new Date(cursor);
      d.setHours(0, 0, 0, 0);
      const e = new Date(cursor);
      e.setHours(23, 59, 59, 999);
      return { start: d, end: e };
    }
  }, [cursor, viewMode]);

  useEffect(() => {
    listDepartments({ limit: 100 }).then(res => setDepartments(res.items || []));
  }, []);

  useEffect(() => {
    startTransition(async () => {
      const rows = await getLeavesForDateRange(start, end);
      setEntries(rows);
    });
  }, [start, end]);

  const filteredEntries = useMemo(() => {
    if (!departmentFilter) return entries;
    return entries.filter(e => e.department_id === departmentFilter);
  }, [entries, departmentFilter]);

  const entriesByDay = useMemo(() => {
    const m = new Map<string, WsLeaveCalendarEntry[]>();
    for (const e of filteredEntries) {
      const bucket = m.get(e.date) ?? [];
      bucket.push(e);
      m.set(e.date, bucket);
    }
    return m;
  }, [filteredEntries]);

  const grid = useMemo(() => {
    const cells: Array<{ date: Date | null; iso: string | null }> = [];
    
    if (viewMode === 'month') {
      const first = start.getDay();
      const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      for (let i = 0; i < first; i++) cells.push({ date: null, iso: null });
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
        date.setHours(0, 0, 0, 0);
        cells.push({ date, iso: toIso(date) });
      }
    } else if (viewMode === 'week') {
      for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        cells.push({ date, iso: toIso(date) });
      }
    } else {
      cells.push({ date: start, iso: toIso(start) });
    }
    
    return cells;
  }, [cursor, start, viewMode]);

  const goPrev = () => {
    if (viewMode === 'month') {
      setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      setCursor((c) => new Date(c.getFullYear(), c.getMonth(), c.getDate() - 7));
    } else {
      setCursor((c) => new Date(c.getFullYear(), c.getMonth(), c.getDate() - 1));
    }
  };

  const goNext = () => {
    if (viewMode === 'month') {
      setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      setCursor((c) => new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7));
    } else {
      setCursor((c) => new Date(c.getFullYear(), c.getMonth(), c.getDate() + 1));
    }
  };

  const goToday = () => setCursor(new Date());

  const label = useMemo(() => {
    if (viewMode === 'month') {
      return cursor.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return cursor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  }, [cursor, viewMode, start, end]);

  const today = toIso(new Date());

  return (
    <EntityListShell
      title="Leave Calendar"
      subtitle="Calendar view of approved leaves across the organization."
    >
      <Card className="p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Prev</span>
            </Button>
            <div className="min-w-[200px] text-center font-medium text-[15px] text-zoru-ink">
              {label}
            </div>
            <Button variant="outline" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Next</span>
            </Button>
            <Button variant="outline" onClick={goToday} className="ml-2">
              Today
            </Button>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-md border border-zoru-line p-1">
              <button 
                onClick={() => setViewMode('month')} 
                className={`px-3 py-1 text-[13px] rounded-sm transition-colors ${viewMode === 'month' ? 'bg-zoru-ink text-white' : 'text-zoru-ink hover:bg-zoru-bg'}`}
              >
                Month
              </button>
              <button 
                onClick={() => setViewMode('week')} 
                className={`px-3 py-1 text-[13px] rounded-sm transition-colors ${viewMode === 'week' ? 'bg-zoru-ink text-white' : 'text-zoru-ink hover:bg-zoru-bg'}`}
              >
                Week
              </button>
              <button 
                onClick={() => setViewMode('day')} 
                className={`px-3 py-1 text-[13px] rounded-sm transition-colors ${viewMode === 'day' ? 'bg-zoru-ink text-white' : 'text-zoru-ink hover:bg-zoru-bg'}`}
              >
                Day
              </button>
            </div>
            
            <div className="relative">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="h-[34px] rounded-md border border-zoru-line bg-transparent pl-8 pr-3 text-[13px] text-zoru-ink focus:border-zoru-brand focus:outline-none focus:ring-1 focus:ring-zoru-brand"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <Filter className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zoru-ink-muted" />
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <div className="min-w-[600px]">
            {viewMode !== 'day' && (
              <div className={`grid grid-cols-7 gap-1`}>
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-[11.5px] uppercase text-zoru-ink-muted"
                  >
                    {d}
                  </div>
                ))}
              </div>
            )}
            <div className={`grid ${viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'} gap-1`}>
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
                const isToday = cell.iso === today;
                
                // Month view limits visible entries, week/day view shows all
                const limit = viewMode === 'month' ? 3 : dayEntries.length;
                const visibleEntries = dayEntries.slice(0, limit);
                const hiddenCount = dayEntries.length - visibleEntries.length;

                return (
                  <div
                    key={cell.iso!}
                    className={
                      `rounded-lg border bg-zoru-bg p-2 transition-colors hover:bg-zoru-bg-hover ` +
                      (isToday
                        ? 'border-zoru-ink ring-1 ring-zoru-ink '
                        : 'border-zoru-line ') +
                      (viewMode === 'day' ? 'min-h-[300px] ' : 'min-h-[120px] ')
                    }
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`text-[13px] font-medium ${isToday ? 'text-zoru-ink' : 'text-zoru-ink-muted'}`}>
                        {viewMode === 'day' ? '' : cell.date.getDate()}
                      </span>
                      {dayEntries.length > 0 && (
                        <span className="rounded bg-zoru-line/50 px-1.5 py-0.5 text-[10px] font-medium text-zoru-ink-muted">
                          {dayEntries.length} out
                        </span>
                      )}
                    </div>
                    
                    <div className={`flex flex-col gap-1.5 ${viewMode === 'day' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2' : ''}`}>
                      {visibleEntries.map((e) => {
                        const dateRangeStr = e.leave_date === e.end_date || !e.end_date
                          ? new Date(e.leave_date).toLocaleDateString()
                          : `${new Date(e.leave_date).toLocaleDateString()} to ${new Date(e.end_date).toLocaleDateString()}`;
                        
                        return (
                          <div
                            key={`${e._id}-${e.date}`}
                            className="group relative truncate rounded-md px-2 py-1 text-[11.5px] font-medium"
                            style={{
                              backgroundColor: (e.color || '#94A3B8') + '25',
                              color: e.color || '#64748B',
                            }}
                            title={`${e.employeeName} — ${e.type_name}\nDate: ${dateRangeStr}`}
                          >
                            <div className="truncate">{e.employeeName ?? 'Employee'}</div>
                            {viewMode !== 'month' && (
                              <div className="truncate text-[10px] opacity-75 mt-0.5">
                                {e.type_name} {e.half_day_type ? `(${e.half_day_type})` : ''}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {hiddenCount > 0 && (
                        <div 
                          className="cursor-pointer text-[11px] font-medium text-zoru-ink-muted hover:text-zoru-ink hover:underline"
                          onClick={() => {
                            setCursor(cell.date!);
                            setViewMode('day');
                          }}
                        >
                          +{hiddenCount} more (click to view)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="mt-4 text-center text-[13px] text-zoru-ink-muted">Loading…</p>
        ) : null}
      </Card>
    </EntityListShell>
  );
}
