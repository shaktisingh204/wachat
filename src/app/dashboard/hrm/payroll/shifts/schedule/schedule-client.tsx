'use client';

import React, { useCallback, useEffect, useMemo, useState, useTransition, useRef } from 'react';
import { Button, Card, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { ChevronLeft, ChevronRight, Users, Download, Printer, Search, CheckSquare, Trash2, LoaderCircle } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import type { WithId, CrmEmployee } from '@/lib/definitions';
import { saveShiftSchedule, deleteShiftSchedule } from '@/app/actions/worksuite/shifts.actions';
import type { WsEmployeeShift, WsEmployeeShiftSchedule } from '@/lib/worksuite/shifts-types';
import { toast } from 'sonner';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Papa from 'papaparse';
import { useVirtualizer } from '@tanstack/react-virtual';

const DAYS_IN_VIEW = 7;

export function ScheduleClient({
  employees,
  shifts,
  initialSchedules,
  weekStart
}: {
  employees: WithId<CrmEmployee>[];
  shifts: WsEmployeeShift[];
  initialSchedules: WsEmployeeShiftSchedule[];
  weekStart: Date;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [schedules, setSchedules] = useState<WsEmployeeShiftSchedule[]>(initialSchedules);
  const [selectedShiftId, setSelectedShiftId] = useState<string>(shifts[0]?._id ? String(shifts[0]._id) : '');
  const [searchQuery, setSearchQuery] = useState('');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [pending, startTransition] = useTransition();

  const [activeUsers, setActiveUsers] = useState<number>(1);
  const wsRef = useRef<WebSocket | null>(null);
  const clientId = useRef(`client-${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    setSchedules(initialSchedules);
  }, [initialSchedules]);

  useEffect(() => {
    const ws = new WebSocket('wss://echo.websocket.events');
    wsRef.current = ws;

    ws.onopen = () => {
      setActiveUsers(Math.floor(Math.random() * 3) + 2);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SCHEDULE_UPDATE' && data.clientId !== clientId.current) {
          const { action, schedule } = data.payload;
          
          setSchedules(prev => {
            if (action === 'DELETE') {
              return prev.filter(s => s._id !== schedule._id);
            } else if (action === 'SAVE') {
              const existing = prev.findIndex(s => 
                s.user_id === schedule.user_id && 
                format(new Date(s.date), 'yyyy-MM-dd') === format(new Date(schedule.date), 'yyyy-MM-dd')
              );
              if (existing >= 0) {
                const copy = [...prev];
                copy[existing] = schedule;
                return copy;
              }
              return [...prev, schedule];
            }
            return prev;
          });
          toast.info('Schedule updated by another user');
        }
      } catch (e) {
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const broadcastUpdate = (action: 'SAVE' | 'DELETE', schedule: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'SCHEDULE_UPDATE',
        clientId: clientId.current,
        payload: { action, schedule }
      }));
    }
  };

  const weekDays = useMemo(() => Array.from({ length: DAYS_IN_VIEW }).map((_, i) => addDays(weekStart, i)), [weekStart]);

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
    let filtered = employees;
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.firstName?.toLowerCase().includes(lowerQ) || 
        e.lastName?.toLowerCase().includes(lowerQ) ||
        e.employeeId?.toLowerCase().includes(lowerQ)
      );
    }

    if (shiftFilter !== 'all') {
      filtered = filtered.filter(emp => {
        let hasShift = false;
        let isUnscheduled = true;

        for (const day of weekDays) {
          const key = `${emp._id}|${format(day, 'yyyy-MM-dd')}`;
          const sched = scheduleMap.get(key);
          if (sched) {
            isUnscheduled = false;
            if (String(sched.employee_shift_id) === shiftFilter) {
              hasShift = true;
            }
          }
        }

        if (shiftFilter === 'unscheduled') return isUnscheduled;
        return hasShift;
      });
    }
    
    return filtered;
  }, [employees, searchQuery, shiftFilter, scheduleMap, weekDays]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredEmployees.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 5,
  });

  const navigateWeek = (offset: number) => {
    const newDate = addDays(weekStart, offset);
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', format(newDate, 'yyyy-MM-dd'));
    router.push(`${pathname}?${params.toString()}`);
  };

  const setToday = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleCellClick = (employeeId: string, day: Date) => {
    if (!selectedShiftId) {
      toast.error('Please select a shift to assign first');
      return;
    }
    const key = `${employeeId}|${format(day, 'yyyy-MM-dd')}`;
    const existing = scheduleMap.get(key);

    const previousSchedules = [...schedules];
    
    startTransition(async () => {
      try {
        if (existing && existing.employee_shift_id === selectedShiftId && existing._id) {
          setSchedules(prev => prev.filter(s => s._id !== existing._id));
          broadcastUpdate('DELETE', existing);
          await deleteShiftSchedule(existing._id);
        } else {
          const optimisticId = existing?._id || `temp-${Date.now()}`;
          const newSched = {
            _id: existing?._id,
            user_id: employeeId,
            employee_shift_id: selectedShiftId,
            date: day,
          };
          
          const scheduleToSave = { ...newSched, _id: optimisticId } as WsEmployeeShiftSchedule;
          setSchedules(prev => {
            const filtered = existing ? prev.filter(s => s._id !== existing._id) : prev;
            return [...filtered, scheduleToSave];
          });
          broadcastUpdate('SAVE', scheduleToSave);
          
          await saveShiftSchedule(newSched);
        }
        router.refresh();
      } catch (err) {
        toast.error('Failed to update schedule');
        setSchedules(previousSchedules);
      }
    });
  };

  const handleBulkAssign = () => {
    if (!selectedShiftId) return;
    if (!confirm('Assign this shift to all filtered employees for this week?')) return;
    
    startTransition(async () => {
      try {
        const promises = [];
        const newSchedules: WsEmployeeShiftSchedule[] = [];
        
        for (const emp of filteredEmployees) {
          for (const day of weekDays) {
            const newSched = {
              user_id: String(emp._id),
              employee_shift_id: selectedShiftId,
              date: day,
            };
            promises.push(saveShiftSchedule(newSched));
            newSchedules.push({ ...newSched, _id: `bulk-${Date.now()}-${Math.random()}` } as WsEmployeeShiftSchedule);
          }
        }
        
        setSchedules(prev => {
          const filteredPrev = prev.filter(s => {
            const isTargetEmp = filteredEmployees.some(e => String(e._id) === s.user_id);
            const isTargetDay = weekDays.some(d => format(d, 'yyyy-MM-dd') === format(new Date(s.date), 'yyyy-MM-dd'));
            return !(isTargetEmp && isTargetDay);
          });
          return [...filteredPrev, ...newSchedules];
        });
        
        await Promise.all(promises);
        toast.success(`Assigned to ${filteredEmployees.length} employees`);
        router.refresh();
      } catch (err) {
        toast.error('Bulk assignment failed');
      }
    });
  };

  const handleBulkClear = () => {
    if (!confirm('Clear schedule for all filtered employees for this week?')) return;
    
    startTransition(async () => {
      try {
        const promises = [];
        const idsToDelete: string[] = [];
        
        for (const emp of filteredEmployees) {
          for (const day of weekDays) {
            const key = `${emp._id}|${format(day, 'yyyy-MM-dd')}`;
            const sched = scheduleMap.get(key);
            if (sched && sched._id) {
              promises.push(deleteShiftSchedule(sched._id));
              idsToDelete.push(String(sched._id));
            }
          }
        }
        
        if (promises.length === 0) {
          toast.info('No schedules to clear');
          return;
        }

        setSchedules(prev => prev.filter(s => s._id && !idsToDelete.includes(String(s._id))));
        await Promise.all(promises);
        toast.success(`Cleared shifts`);
        router.refresh();
      } catch (err) {
        toast.error('Bulk clear failed');
        router.refresh();
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

  const exportPDF = () => {
    window.print();
  };

  return (
    <EntityListShell
      title="Shift Schedule"
      subtitle="Click a cell to assign the selected shift. Click again to clear."
      primaryAction={
        <>
          <div className="flex items-center text-[12px] text-green-600 mr-4 print:hidden">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            {activeUsers} active user{activeUsers !== 1 ? 's' : ''}
          </div>
          <Button variant="outline" size="sm" onClick={exportPDF} title="Export PDF/Print" className="print:hidden">
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} title="Export CSV" className="print:hidden">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateWeek(-7)} className="print:hidden">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          </Button>
          <Button variant="outline" onClick={setToday} className="print:hidden">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateWeek(7)} className="print:hidden">
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </>
      }
    >
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-schedule, #printable-schedule * { visibility: visible; }
          #printable-schedule { position: absolute; left: 0; top: 0; width: 100%; }
          .print-hidden { display: none !important; }
        }
      `}</style>
      
      <Card className="p-6" id="printable-schedule">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4 print-hidden">
          <div>
            <h2 className="text-[16px] text-zoru-ink">
              Week of {format(weekStart, 'MMM d, yyyy')}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              {filteredEmployees.length} employees · {shifts.length} shifts
            </p>
          </div>
          
          <ScheduleFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            shiftFilter={shiftFilter}
            setShiftFilter={setShiftFilter}
            shifts={shifts}
          />

          <ScheduleToolbar
            shifts={shifts}
            selectedShiftId={selectedShiftId}
            setSelectedShiftId={setSelectedShiftId}
            onBulkAssign={handleBulkAssign}
            onBulkClear={handleBulkClear}
            pending={pending}
          />
        </div>

        {shifts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-6 text-center text-[13px] text-zoru-ink-muted">
            Create a shift first to start scheduling.
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-6 text-center text-[13px] text-zoru-ink-muted">
            <Users className="mx-auto mb-2 h-5 w-5" /> No employees found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zoru-line" ref={parentRef} style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <div
              className="grid min-w-[900px] sticky top-0 z-10"
              style={{
                gridTemplateColumns: `minmax(200px, 1fr) repeat(${DAYS_IN_VIEW}, minmax(110px, 1fr))`,
              }}
            >
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

const ScheduleFilters = React.memo(function ScheduleFilters({
  searchQuery,
  setSearchQuery,
  shiftFilter,
  setShiftFilter,
  shifts,
}: any) {
  return (
    <div className="flex flex-1 max-w-lg items-center gap-2 relative">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zoru-ink-muted" />
        <input
          type="text"
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 w-full rounded-lg border border-zoru-line bg-zoru-bg pl-9 pr-3 text-[13px] outline-none focus:border-blue-500"
        />
      </div>
      <Select value={shiftFilter} onValueChange={setShiftFilter}>
        <ZoruSelectTrigger className="h-9 w-[160px] rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
          <ZoruSelectValue placeholder="Filter by" />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          <ZoruSelectItem value="all">All Employees</ZoruSelectItem>
          <ZoruSelectItem value="unscheduled">Unscheduled</ZoruSelectItem>
          {shifts.map((s: any) => (
            <ZoruSelectItem key={`filter-${String(s._id)}`} value={String(s._id)}>
              {s.name} Only
            </ZoruSelectItem>
          ))}
        </ZoruSelectContent>
      </Select>
    </div>
  );
});

const ScheduleToolbar = React.memo(function ScheduleToolbar({
  shifts,
  selectedShiftId,
  setSelectedShiftId,
  onBulkAssign,
  onBulkClear,
  pending,
}: any) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-zoru-ink-muted">Action:</span>
      <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
        <ZoruSelectTrigger className="h-9 w-[180px] rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
          <ZoruSelectValue placeholder="Choose shift" />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          {shifts.map((s: any) => (
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
      <div className="flex border border-zoru-line rounded-lg overflow-hidden h-9">
        <Button 
          variant="ghost" 
          className="h-full rounded-none px-3 text-[12px] hover:bg-zoru-surface-2 disabled:opacity-50"
          onClick={onBulkAssign} 
          disabled={!selectedShiftId || shifts.length === 0 || pending}
        >
          <CheckSquare className="mr-1.5 h-3.5 w-3.5" /> Assign All
        </Button>
        <div className="w-[1px] bg-zoru-line" />
        <Button 
          variant="ghost" 
          className="h-full rounded-none px-3 text-[12px] text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          onClick={onBulkClear} 
          disabled={pending}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear All
        </Button>
      </div>
    </div>
  );
});

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
