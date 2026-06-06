'use client';

import { Card, Button, Tooltip, TooltipProvider, TooltipTrigger, TooltipContent, Popover, PopoverTrigger, PopoverContent } from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';

import { fmtDate } from '@/lib/utils';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getLeavesForDateRange } from '@/app/actions/worksuite/leave.actions';
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

export default function LeaveCalendarClient({
  initialDepartments,
  initialEntries,
}: {
  initialDepartments: CrmDepartmentDoc[];
  initialEntries: WsLeaveCalendarEntry[];
}) {
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [entries, setEntries] = useState<WsLeaveCalendarEntry[]>(initialEntries);
  const [departments, setDepartments] = useState<CrmDepartmentDoc[]>(initialDepartments);
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [isLoading, startTransition] = useTransition();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    startTransition(async () => {
      const rows = await getLeavesForDateRange(start, end);
      setEntries(rows);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      return fmtDate(cursor, 'MMMM yyyy');
    } else if (viewMode === 'week') {
      return `${fmtDate(start, 'MMM d')} - ${fmtDate(end, 'MMM d, yyyy')}`;
    } else {
      return fmtDate(cursor, 'EEEE, MMMM d, yyyy');
    }
  }, [cursor, viewMode, start, end]);

  const today = toIso(new Date());

  return (
    <EntityListShell
      title="Leave Calendar"
      subtitle="Calendar view of approved leaves across the organization."
    >
      <TooltipProvider>
        <Card className="p-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Prev</span>
            </Button>
            <div className="min-w-[200px] text-center font-medium text-[15px] text-[var(--st-text)]">
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
            <div className="flex items-center gap-1 rounded-md border border-[var(--st-border)] p-1">
              <button 
                onClick={() => setViewMode('month')} 
                className={`px-3 py-1 text-[13px] rounded-sm transition-colors ${viewMode === 'month' ? 'bg-[var(--st-text)] text-white' : 'text-[var(--st-text)] hover:bg-[var(--st-bg)]'}`}
              >
                Month
              </button>
              <button 
                onClick={() => setViewMode('week')} 
                className={`px-3 py-1 text-[13px] rounded-sm transition-colors ${viewMode === 'week' ? 'bg-[var(--st-text)] text-white' : 'text-[var(--st-text)] hover:bg-[var(--st-bg)]'}`}
              >
                Week
              </button>
              <button 
                onClick={() => setViewMode('day')} 
                className={`px-3 py-1 text-[13px] rounded-sm transition-colors ${viewMode === 'day' ? 'bg-[var(--st-text)] text-white' : 'text-[var(--st-text)] hover:bg-[var(--st-bg)]'}`}
              >
                Day
              </button>
            </div>
            
            <div className="relative">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="h-[34px] rounded-md border border-[var(--st-border)] bg-transparent pl-8 pr-3 text-[13px] text-[var(--st-text)] focus:border-[var(--st-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--st-accent)]"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <Filter className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-zoru-line scrollbar-track-transparent pb-4">
          <div className="min-w-[700px]">
            {viewMode !== 'day' && (
              <div className={`grid grid-cols-7 gap-1`}>
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-[11.5px] uppercase text-[var(--st-text-secondary)]"
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
                      `rounded-lg border bg-[var(--st-bg)] p-2 transition-colors hover:bg-[var(--st-hover)] ` +
                      (isToday
                        ? 'border-[var(--st-text)] ring-1 ring-[var(--st-text)] '
                        : 'border-[var(--st-border)] ') +
                      (viewMode === 'day' ? 'min-h-[300px] ' : 'min-h-[120px] ')
                    }
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`text-[13px] font-medium ${isToday ? 'text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]'}`}>
                        {viewMode === 'day' ? '' : cell.date.getDate()}
                      </span>
                      {dayEntries.length > 0 && (
                        <span className="rounded bg-[var(--st-border)]/50 px-1.5 py-0.5 text-[10px] font-medium text-[var(--st-text-secondary)]">
                          {dayEntries.length} out
                        </span>
                      )}
                    </div>
                    
                    <div className={`flex flex-col gap-1.5 ${viewMode === 'day' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2' : ''}`}>
                      {visibleEntries.map((e) => {
                        const dateRangeStr = e.leave_date === e.end_date || !e.end_date
                          ? fmtDate(e.leave_date, 'MMM d, yyyy')
                          : `${fmtDate(e.leave_date, 'MMM d, yyyy')} to ${fmtDate(e.end_date, 'MMM d, yyyy')}`;
                        
                        return (
                          <Tooltip key={`${e._id}-${e.date}`}>
                            <TooltipTrigger asChild>
                              <div
                                className="group relative truncate rounded-md px-2 py-1 text-[11.5px] font-medium cursor-default transition-colors hover:brightness-95"
                                style={{
                                  backgroundColor: (e.color || '#94A3B8') + '25',
                                  color: e.color || '#64748B',
                                }}
                              >
                                <div className="truncate">{e.employeeName ?? 'Employee'}</div>
                                {viewMode !== 'month' && (
                                  <div className="truncate text-[10px] opacity-75 mt-0.5">
                                    {e.type_name} {e.half_day_type ? `(${e.half_day_type})` : ''}
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <div className="flex flex-col gap-1 text-[13px] py-1">
                                <span className="font-semibold text-[var(--st-bg)]">{e.employeeName ?? 'Employee'}</span>
                                <span className="text-[var(--st-bg)]/80">{e.type_name} {e.half_day_type ? `(${e.half_day_type})` : ''}</span>
                                <span className="text-[var(--st-bg)]/80 font-mono text-[11px] mt-1">{dateRangeStr}</span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                      {hiddenCount > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <div 
                              className="inline-block cursor-pointer text-[11px] font-medium text-[var(--st-text-secondary)] hover:text-[var(--st-text)] hover:underline py-0.5"
                            >
                              +{hiddenCount} more
                            </div>
                          </PopoverTrigger>
                          <PopoverContent side="bottom" align="start" className="w-64 p-3 z-50">
                            <div className="mb-2 text-[13px] font-medium text-[var(--st-text)] border-b border-[var(--st-border)] pb-2 flex justify-between items-center">
                              <span>{cell.date ? fmtDate(cell.date, 'EEE, MMM d') : ''}</span>
                              <span className="text-[11px] text-[var(--st-text-secondary)]">{dayEntries.length} leaves</span>
                            </div>
                            <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-zoru-line scrollbar-track-transparent pr-1">
                              {dayEntries.map((e) => (
                                <div
                                  key={`popover-${e._id}-${e.date}`}
                                  className="truncate rounded-md px-2 py-1.5 text-[11.5px] font-medium"
                                  style={{
                                    backgroundColor: (e.color || '#94A3B8') + '25',
                                    color: e.color || '#64748B',
                                  }}
                                >
                                  <div className="truncate">{e.employeeName ?? 'Employee'}</div>
                                  <div className="truncate text-[10px] opacity-75 mt-0.5">
                                    {e.type_name} {e.half_day_type ? `(${e.half_day_type})` : ''}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 text-center pt-2 border-t border-[var(--st-border)]">
                              <button
                                className="text-[12px] text-[var(--st-accent)] hover:underline font-medium"
                                onClick={() => {
                                  setCursor(cell.date!);
                                  setViewMode('day');
                                }}
                              >
                                View day schedule
                              </button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="mt-4 text-center text-[13px] text-[var(--st-text-secondary)]">Loading…</p>
        ) : null}
      </Card>
      </TooltipProvider>
    </EntityListShell>
  );
}
