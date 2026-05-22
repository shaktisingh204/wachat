'use client';

import { Button, Card, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Users } from 'lucide-react';
import { format,
  addDays,
  startOfWeek } from 'date-fns';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WithId, CrmEmployee } from '@/lib/definitions';
import {
  getEmployeeShifts,
  getShiftSchedules,
  saveShiftSchedule,
  deleteShiftSchedule,
} from '@/app/actions/worksuite/shifts.actions';
import type {
  WsEmployeeShift,
  WsEmployeeShiftSchedule,
} from '@/lib/worksuite/shifts-types';

const DAYS_IN_VIEW = 7;

export default function ShiftSchedulePage() {
  const [employees, setEmployees] = useState<WithId<CrmEmployee>[]>([]);
  const [shifts, setShifts] = useState<WsEmployeeShift[]>([]);
  const [schedules, setSchedules] = useState<WsEmployeeShiftSchedule[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [pending, startTransition] = useTransition();

  const weekDays = useMemo(() => {
    return Array.from({ length: DAYS_IN_VIEW }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const load = useCallback(() => {
    startTransition(async () => {
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
    });
  }, [weekStart, selectedShiftId]);

  useEffect(() => {
    load();
  }, [load]);

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

  const handleCellClick = (employeeId: string, day: Date) => {
    if (!selectedShiftId) return;
    const key = `${employeeId}|${format(day, 'yyyy-MM-dd')}`;
    const existing = scheduleMap.get(key);

    startTransition(async () => {
      if (existing && existing.employee_shift_id === selectedShiftId && existing._id) {
        // Toggle off if same
        await deleteShiftSchedule(existing._id);
      } else {
        await saveShiftSchedule({
          _id: existing?._id,
          user_id: employeeId,
          employee_shift_id: selectedShiftId,
          date: day,
        });
      }
      load();
    });
  };

  return (
    <EntityListShell
      title="Shift Schedule"
      subtitle="Click a cell to assign the selected shift. Click again to clear."
      primaryAction={
        <>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          </Button>
          <Button
            variant="outline"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </>
      }
    >

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] text-zoru-ink">
              Week of {format(weekStart, 'MMM d, yyyy')}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              {employees.length} employees · {shifts.length} shifts configured
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-zoru-ink-muted">Shift to assign:</span>
            <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
              <ZoruSelectTrigger className="h-9 w-[200px] rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Choose shift" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {shifts.map((s) => (
                  <ZoruSelectItem key={String(s._id)} value={String(s._id)}>
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
          </div>
        </div>

        {shifts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-6 text-center text-[13px] text-zoru-ink-muted">
            Create a shift first to start scheduling.
          </div>
        ) : employees.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-6 text-center text-[13px] text-zoru-ink-muted">
            <Users className="mx-auto mb-2 h-5 w-5" /> No employees found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <div
              className="grid min-w-[900px]"
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
                  key={d.toISOString()}
                  className="border-b border-l border-zoru-line bg-zoru-surface-2 px-3 py-2 text-[12px] font-medium text-zoru-ink"
                >
                  <div>{format(d, 'EEE')}</div>
                  <div className="text-[11px] text-zoru-ink-muted">{format(d, 'MMM d')}</div>
                </div>
              ))}

              {/* Rows */}
              {employees.map((emp) => (
                <Row
                  key={emp._id.toString()}
                  employee={emp}
                  days={weekDays}
                  scheduleMap={scheduleMap}
                  shiftMap={shiftMap}
                  onClick={handleCellClick}
                  pending={pending}
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    </EntityListShell>
  );
}

function Row({
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
    <>
      <div className="flex items-center gap-2 border-t border-zoru-line px-3 py-2 text-[13px] text-zoru-ink">
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
            key={day.toISOString()}
            type="button"
            disabled={pending}
            onClick={() => onClick(empId, day)}
            className="flex min-h-[52px] items-center justify-center border-l border-t border-zoru-line bg-zoru-bg px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-zoru-surface-2 disabled:opacity-70"
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
    </>
  );
}
