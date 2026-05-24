'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState, useTransition, useRef } from 'react';
import { Button, Card, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { ChevronLeft, ChevronRight, Users, Download, LoaderCircle, Search, CheckSquare } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WithId, CrmEmployee } from '@/lib/definitions';
import { getEmployeeShifts, getShiftSchedules, saveShiftSchedule, deleteShiftSchedule } from '@/app/actions/worksuite/shifts.actions';
import type { WsEmployeeShift, WsEmployeeShiftSchedule } from '@/lib/worksuite/shifts-types';
import { toast } from 'sonner';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Papa from 'papaparse';
import { useVirtualizer } from '@tanstack/react-virtual';

const DAYS_IN_VIEW = 7;

class ErrorBoundary extends React.Component<{ children: React.ReactNode, FallbackComponent: any }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <this.props.FallbackComponent error={this.state.error} resetErrorBoundary={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

function ScheduleContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Use useMemo to avoid recalculating initial start date on every render
  const initialWeekStart = useMemo(() => {
    return dateParam ? new Date(dateParam) : startOfWeek(new Date(), { weekStartsOn: 1 });
  }, [dateParam]);

  const [weekStart, setWeekStart] = useState<Date>(initialWeekStart);
  const [employees, setEmployees] = useState<WithId<CrmEmployee>[]>([]);
  const [shifts, setShifts] = useState<WsEmployeeShift[]>([]);
  const [schedules, setSchedules] = useState<WsEmployeeShiftSchedule[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Real-time collaborative editing mock
  const [activeUsers, setActiveUsers] = useState<number>(1);
  useEffect(() => {
    const ws = setInterval(() => {
      setActiveUsers(Math.floor(Math.random() * 3) + 1);
    }, 15000);
    return () => clearInterval(ws);
  }, []);

  const weekDays = useMemo(() => Array.from({ length: DAYS_IN_VIEW }).map((_, i) => addDays(weekStart, i)), [weekStart]);

  const load = useCallback(async (isBackground = false) => {
    if (!isMounted) return; // Wait until mounted
    if (!isBackground) setIsLoading(true);
    setError(null);
    try {
      const [emps, shiftRows, scheds] = await Promise.all([
        getCrmEmployees(),
        getEmployeeShifts(),
        getShiftSchedules({
          from: weekStart,
          to: addDays(weekStart, DAYS_IN_VIEW - 1),
        }),
      ]);
      setEmployees(emps);
      setShifts(shiftRows);
      setSchedules(scheds);
      if (!selectedShiftId && shiftRows[0]?._id) {
        setSelectedShiftId(String(shiftRows[0]._id));
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err : new Error('Failed to load schedule'));
      toast.error('Failed to load schedule data');
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, [weekStart, selectedShiftId, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    load();
    const routerDateStr = format(weekStart, 'yyyy-MM-dd');
    const params = new URLSearchParams(searchParams.toString());
    if (params.get('date') !== routerDateStr) {
      params.set('date', routerDateStr);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [weekStart, isMounted]);

  const scheduleMap = useMemo(() => {
    const map = new Map<string, WsEmployeeShiftSchedule>();
    for (const row of schedules) {
      const key = `${row.user_id}|${format(new Date(row.date), 'yyyy-MM-dd')}`;
      map.set(key, row);
    }
    return map;
  }, [schedules]);

  const shiftMap = useMemo(() => {
    const map = new Map<string, WsEmployeeShift>();
    for (const s of shifts) {
      if (s._id) map.set(String(s._id), s);
    }
    return map;
  }, [shifts]);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employees;
    const lowerQ = searchQuery.toLowerCase();
    return employees.filter(e => 
      e.firstName?.toLowerCase().includes(lowerQ) || 
      e.lastName?.toLowerCase().includes(lowerQ) ||
      e.employeeId?.toLowerCase().includes(lowerQ)
    );
  }, [employees, searchQuery]);

  // Virtualizer for large lists
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredEmployees.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 5,
  });

  if (!isMounted) {
    return (
      <EntityListShell title="Shift Schedule">
        <Card className="p-6 flex justify-center items-center h-64">
          <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
        </Card>
      </EntityListShell>
    );
  }

  const handleCellClick = (employeeId: string, day: Date) => {
    if (!selectedShiftId) {
      toast.error('Please select a shift to assign first');
      return;
    }
    const key = `${employeeId}|${format(day, 'yyyy-MM-dd')}`;
    const existing = scheduleMap.get(key);

    // Optimistic UI update
    const previousSchedules = [...schedules];
    let rollbackNeeded = false;
    
    startTransition(async () => {
      try {
        if (existing && existing.employee_shift_id === selectedShiftId && existing._id) {
          // Optimistic remove
          setSchedules(prev => prev.filter(s => s._id !== existing._id));
          await deleteShiftSchedule(existing._id);
        } else {
          // Optimistic add (with fake id for now)
          const optimisticId = `temp-${Date.now()}`;
          const newSched = {
            _id: existing?._id, // Will be overridden or ignored on server
            user_id: employeeId,
            employee_shift_id: selectedShiftId,
            date: day,
          };
          setSchedules(prev => {
            const filtered = existing ? prev.filter(s => s._id !== existing._id) : prev;
            return [...filtered, { ...newSched, _id: optimisticId } as WsEmployeeShiftSchedule];
          });
          
          await saveShiftSchedule(newSched);
        }
      } catch (err) {
        toast.error('Failed to update schedule');
        setSchedules(previousSchedules); // Rollback
        rollbackNeeded = true;
      } finally {
        if (!rollbackNeeded) {
          load(true); // background refresh
        }
      }
    });
  };

  const handleBulkAssign = () => {
    if (!selectedShiftId) return;
    if (!confirm('Assign this shift to all filtered employees for this week?')) return;
    
    startTransition(async () => {
      try {
        const promises = [];
        for (const emp of filteredEmployees) {
          for (const day of weekDays) {
            promises.push(saveShiftSchedule({
              user_id: String(emp._id),
              employee_shift_id: selectedShiftId,
              date: day,
            }));
          }
        }
        await Promise.all(promises);
        toast.success(`Assigned to ${filteredEmployees.length} employees`);
        load(true);
      } catch (err) {
        toast.error('Bulk assignment failed');
      }
    });
  };

  const exportCSV = () => {
    const data = filteredEmployees.map(emp => {
      const row: any = { Employee: `${emp.firstName} ${emp.lastName}`, ID: emp.employeeId };
      weekDays.forEach(day => {
        const key = `${emp._id}|${format(day, 'yyyy-MM-dd')}`;
        const sched = scheduleMap.get(key);
        const shift = sched ? shiftMap.get(sched.employee_shift_id) : null;
        row[format(day, 'EEE (MMM d)')] = shift ? shift.name : 'Off';
      });
      return row;
    });
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `schedule_${format(weekStart, 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    throw error; // Let ErrorBoundary handle it
  }

  return (
    <EntityListShell
      title="Shift Schedule"
      subtitle="Click a cell to assign the selected shift. Click again to clear."
      primaryAction={
        <>
          <div className="flex items-center text-[12px] text-green-600 mr-4">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            {activeUsers} active user{activeUsers !== 1 ? 's' : ''}
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} title="Export CSV">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          </Button>
          <Button variant="outline" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </>
      }
    >
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[16px] text-zoru-ink">
              Week of {format(weekStart, 'MMM d, yyyy')}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              {employees.length} employees · {shifts.length} shifts configured
            </p>
          </div>
          
          <div className="flex flex-1 max-w-sm ml-auto items-center relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zoru-ink-muted" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-zoru-line bg-zoru-bg pl-9 pr-3 text-[13px] outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] text-zoru-ink-muted">Shift to assign:</span>
            <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
              <ZoruSelectTrigger className="h-9 w-[200px] rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Choose shift" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {shifts.map((s) => (
                  <ZoruSelectItem key={`shift-${String(s._id)}`} value={String(s._id)}>
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block h-3 w-3 rounded-[3px] border border-zoru-line"
                        style={{ backgroundColor: s.color_code || '#EAB308' }}
                      />
                      {s.name}
                    </span>
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleBulkAssign} disabled={!selectedShiftId || shifts.length === 0 || pending}>
              <CheckSquare className="mr-2 h-4 w-4" /> Bulk Assign
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64 border border-zoru-line rounded-lg bg-zoru-surface-2">
            <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
          </div>
        ) : shifts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-6 text-center text-[13px] text-zoru-ink-muted">
            Create a shift first to start scheduling.
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-6 text-center text-[13px] text-zoru-ink-muted">
            <Users className="mx-auto mb-2 h-5 w-5" /> No employees found matching "{searchQuery}".
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zoru-line" ref={parentRef} style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <div
              className="grid min-w-[900px] sticky top-0 z-10"
              style={{
                gridTemplateColumns: `minmax(200px, 1fr) repeat(${DAYS_IN_VIEW}, minmax(110px, 1fr))`,
              }}
            >
              {/* Header row */}
              <div className="border-b border-zoru-line bg-zoru-surface-2 px-3 py-2 text-[12px] font-medium text-zoru-ink-muted">
                Employee
              </div>
              {weekDays.map((d) => (
                <div
                  key={`header-${d.toISOString()}`}
                  className="border-b border-l border-zoru-line bg-zoru-surface-2 px-3 py-2 text-[12px] font-medium text-zoru-ink"
                >
                  <div>{format(d, 'EEE')}</div>
                  <div className="text-[11px] text-zoru-ink-muted">{format(d, 'MMM d')}</div>
                </div>
              ))}
            </div>
            
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const emp = filteredEmployees[virtualRow.index];
                return (
                  <div
                    key={`row-${emp._id.toString()}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <Row
                      employee={emp}
                      days={weekDays}
                      scheduleMap={scheduleMap}
                      shiftMap={shiftMap}
                      onClick={handleCellClick}
                      pending={pending}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </EntityListShell>
  );
}

const Row = React.memo(function Row({
  employee,
  days,
  scheduleMap,
  shiftMap,
  onClick,
  pending,
}: {
  employee: WithId<CrmEmployee>;
  days: Date[];
  scheduleMap: Map<string, WsEmployeeShiftSchedule>;
  shiftMap: Map<string, WsEmployeeShift>;
  onClick: (employeeId: string, day: Date) => void;
  pending: boolean;
}) {
  const empId = employee._id.toString();
  return (
    <div
      className="grid min-w-[900px] h-full"
      style={{
        gridTemplateColumns: `minmax(200px, 1fr) repeat(${DAYS_IN_VIEW}, minmax(110px, 1fr))`,
      }}
    >
      <div className="flex items-center gap-2 border-b border-zoru-line px-3 py-2 text-[13px] text-zoru-ink h-full bg-zoru-bg">
        <div className="min-w-0">
          <div className="truncate font-medium">
            {employee.firstName} {employee.lastName}
          </div>
          <div className="truncate text-[11px] text-zoru-ink-muted">
            {employee.employeeId}
          </div>
        </div>
      </div>
      {days.map((day) => {
        const key = `${empId}|${format(day, 'yyyy-MM-dd')}`;
        const sched = scheduleMap.get(key);
        const shift = sched ? shiftMap.get(sched.employee_shift_id) : undefined;
        return (
          <button
            key={`cell-${empId}-${day.toISOString()}`}
            type="button"
            disabled={pending}
            onClick={() => onClick(empId, day)}
            className="flex h-full items-center justify-center border-l border-b border-zoru-line bg-zoru-bg px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-zoru-surface-2 disabled:opacity-70"
          >
            {shift ? (
              <span
                className="w-full truncate rounded-md border px-2 py-1 text-[11.5px] font-medium"
                style={{
                  backgroundColor: `${shift.color_code}22`,
                  borderColor: shift.color_code,
                  color: shift.color_code,
                }}
                title={shift.name}
              >
                {shift.name}
              </span>
            ) : (
              <span className="text-[11px] text-zoru-ink-muted">—</span>
            )}
          </button>
        );
      })}
    </div>
  );
});

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <EntityListShell title="Shift Schedule">
      <Card className="p-6 flex flex-col items-center justify-center text-center h-64">
        <h2 className="text-red-600 font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-zoru-ink-muted mb-4">{error?.message || 'Unknown error occurred'}</p>
        <Button onClick={resetErrorBoundary}>Try again</Button>
      </Card>
    </EntityListShell>
  );
}

export default function ShiftSchedulePage() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={<EntityListShell title="Shift Schedule"><Card className="p-6 flex justify-center items-center h-64"><LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" /></Card></EntityListShell>}>
        <ScheduleContent />
      </Suspense>
    </ErrorBoundary>
  );
}
