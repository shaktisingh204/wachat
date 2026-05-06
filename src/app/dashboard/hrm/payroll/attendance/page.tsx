'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  CheckSquare,
  Clock,
  LogIn,
  LogOut,
  FileText,
  MapPin,
  Plus,
  Edit,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogFooter,
  ZoruDatePicker,
  ZoruCard,
  ZoruButton,
  ZoruBadge,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { getEmployeeShifts } from '@/app/actions/worksuite/shifts.actions';
import {
  getAttendanceExt,
  saveAttendanceExt,
  clockIn,
  clockOut,
  deleteAttendanceExt,
} from '@/app/actions/worksuite/attendance.actions';
import type { WsAttendanceExt } from '@/lib/worksuite/shifts-types';

type EmployeeLite = { _id: string; firstName?: string; lastName?: string };
type ShiftLite = { _id: string; name: string; color_code?: string };

const WORKING_FROM_OPTIONS = ['office', 'home', 'remote', 'client-site', 'field'];

function fmt(v: unknown): string {
  if (!v) return '—';
  try {
    return format(new Date(v as any), 'hh:mm a');
  } catch {
    return String(v);
  }
}

function fmtHours(h?: number): string {
  if (!h) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

type ModalState = {
  open: boolean;
  mode: 'clock-in' | 'manual';
  employeeId: string;
  record?: WsAttendanceExt;
};

export default function AttendancePage() {
  const { toast } = useZoruToast();
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [shifts, setShifts] = useState<ShiftLite[]>([]);
  const [records, setRecords] = useState<WsAttendanceExt[]>([]);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isLoading, startTransition] = useTransition();

  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: 'clock-in',
    employeeId: '',
  });
  const [formState, setFormState] = useState({
    working_from: 'office',
    shift_id: '',
    clock_in_time: '',
    clock_out_time: '',
    late: false,
    half_day: false,
    latitude: '',
    longitude: '',
    overwrite: false,
  });
  const [isSaving, startSave] = useTransition();

  const load = useCallback(() => {
    if (!date) return;
    startTransition(async () => {
      const [emps, sh, recs] = await Promise.all([
        getCrmEmployees(),
        getEmployeeShifts(),
        getAttendanceExt(date),
      ]);
      setEmployees(
        (emps as any[]).map((e) => ({
          _id: String(e._id),
          firstName: e.firstName,
          lastName: e.lastName,
        })),
      );
      setShifts(
        (sh as any[]).map((s) => ({
          _id: String(s._id),
          name: s.name,
          color_code: s.color_code,
        })),
      );
      setRecords(recs);
    });
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const recordByEmployee = useMemo(() => {
    const m = new Map<string, WsAttendanceExt>();
    for (const r of records) m.set(r.user_id, r);
    return m;
  }, [records]);

  const handleQuickClockIn = (empId: string) => {
    setFormState({
      working_from: 'office',
      shift_id: '',
      clock_in_time: '',
      clock_out_time: '',
      late: false,
      half_day: false,
      latitude: '',
      longitude: '',
      overwrite: false,
    });
    setModal({ open: true, mode: 'clock-in', employeeId: empId });
  };

  const handleClockOut = (empId: string) => {
    startSave(async () => {
      const r = await clockOut(empId, date);
      if (r.success) {
        toast({ title: 'Clocked out successfully.' });
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  const handleManualEntry = (empId: string, existing?: WsAttendanceExt) => {
    if (existing) {
      setFormState({
        working_from: existing.working_from ?? 'office',
        shift_id: existing.employee_shift_id ?? '',
        clock_in_time: existing.clock_in_time
          ? format(new Date(existing.clock_in_time as any), "yyyy-MM-dd'T'HH:mm")
          : '',
        clock_out_time: existing.clock_out_time
          ? format(new Date(existing.clock_out_time as any), "yyyy-MM-dd'T'HH:mm")
          : '',
        late: existing.late ?? false,
        half_day: existing.half_day ?? false,
        latitude: existing.latitude ?? '',
        longitude: existing.longitude ?? '',
        overwrite: existing.overwrite_attendance ?? false,
      });
    } else {
      const base = date ? format(date, "yyyy-MM-dd") : '';
      setFormState({
        working_from: 'office',
        shift_id: '',
        clock_in_time: base ? `${base}T09:00` : '',
        clock_out_time: base ? `${base}T18:00` : '',
        late: false,
        half_day: false,
        latitude: '',
        longitude: '',
        overwrite: false,
      });
    }
    setModal({ open: true, mode: 'manual', employeeId: empId, record: existing });
  };

  const submitModal = () => {
    if (!modal.employeeId || !date) return;
    startSave(async () => {
      let result;
      if (modal.mode === 'clock-in') {
        result = await clockIn(modal.employeeId, {
          working_from: formState.working_from,
          employee_shift_id: formState.shift_id || undefined,
          latitude: formState.latitude || undefined,
          longitude: formState.longitude || undefined,
          overwrite: formState.overwrite,
        });
      } else {
        result = await saveAttendanceExt({
          _id: modal.record?._id,
          user_id: modal.employeeId,
          date: date,
          clock_in_time: formState.clock_in_time || undefined,
          clock_out_time: formState.clock_out_time || undefined,
          working_from: formState.working_from,
          employee_shift_id: formState.shift_id || undefined,
          late: formState.late,
          half_day: formState.half_day,
          latitude: formState.latitude || undefined,
          longitude: formState.longitude || undefined,
          overwrite_attendance: formState.overwrite,
        });
      }
      if (result.success) {
        toast({ title: modal.mode === 'clock-in' ? 'Clocked in.' : 'Attendance saved.' });
        setModal((m) => ({ ...m, open: false }));
        load();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  const handleDelete = (id?: string) => {
    if (!id) return;
    if (!confirm('Delete this attendance record?')) return;
    startSave(async () => {
      await deleteAttendanceExt(id);
      load();
    });
  };

  const presentCount = records.filter((r) => r.clock_in_time).length;
  const lateCount = records.filter((r) => r.late).length;
  const wfhCount = records.filter((r) => r.working_from === 'home').length;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Attendance"
        subtitle="Track clock-in / clock-out, working location, and shift assignments."
        icon={CheckSquare}
        actions={
          <>
            <ZoruDatePicker value={date} onChange={setDate} />
            <ZoruButton variant="outline">
              <FileText className="h-4 w-4" />
              Export
            </ZoruButton>
          </>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ZoruCard className="p-6">
          <p className="text-[12px] text-zoru-ink-muted">Present</p>
          <p className="mt-1 text-[26px] text-zoru-ink">{presentCount}</p>
        </ZoruCard>
        <ZoruCard className="p-6">
          <p className="text-[12px] text-zoru-ink-muted">Late</p>
          <p className="mt-1 text-[26px] text-zoru-ink">{lateCount}</p>
        </ZoruCard>
        <ZoruCard className="p-6">
          <p className="text-[12px] text-zoru-ink-muted">WFH</p>
          <p className="mt-1 text-[26px] text-zoru-ink">{wfhCount}</p>
        </ZoruCard>
        <ZoruCard className="p-6">
          <p className="text-[12px] text-zoru-ink-muted">Total Employees</p>
          <p className="mt-1 text-[26px] text-zoru-ink">{employees.length}</p>
        </ZoruCard>
      </div>

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] text-zoru-ink">
              Attendance — {date ? format(date, 'PPP') : '…'}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              {records.length} record{records.length === 1 ? '' : 's'} for this date
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Clock In</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Clock Out</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Working From</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Hours</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Flags</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={7} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    Loading…
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : employees.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={7} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    No employees found.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                employees.map((emp) => {
                  const rec = recordByEmployee.get(emp._id);
                  const isIn = !!rec?.clock_in_time;
                  const isOut = !!rec?.clock_out_time;
                  return (
                    <ZoruTableRow key={emp._id} className="border-zoru-line">
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {[emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Unnamed'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {isIn ? (
                          <span className="flex items-center gap-1.5 text-green-600">
                            <LogIn className="h-3.5 w-3.5" />
                            {fmt(rec?.clock_in_time)}
                          </span>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {isOut ? (
                          <span className="flex items-center gap-1.5 text-red-500">
                            <LogOut className="h-3.5 w-3.5" />
                            {fmt(rec?.clock_out_time)}
                          </span>
                        ) : isIn ? (
                          <span className="text-amber-500 text-[12px]">Active</span>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12.5px] capitalize text-zoru-ink">
                        {rec?.working_from ? (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-zoru-ink-muted" />
                            {rec.working_from}
                          </span>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {fmtHours(rec?.working_hours)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <div className="flex flex-wrap gap-1">
                          {rec?.late && (
                            <ZoruBadge variant="warning">Late</ZoruBadge>
                          )}
                          {rec?.half_day && (
                            <ZoruBadge variant="info">Half Day</ZoruBadge>
                          )}
                        </div>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!isIn ? (
                            <ZoruButton
                              variant="outline"
                              size="sm"
                              onClick={() => handleQuickClockIn(emp._id)}
                              disabled={isSaving}
                            >
                              <LogIn className="h-3.5 w-3.5" />
                              Clock In
                            </ZoruButton>
                          ) : !isOut ? (
                            <ZoruButton
                              variant="outline"
                              size="sm"
                              onClick={() => handleClockOut(emp._id)}
                              disabled={isSaving}
                            >
                              <LogOut className="h-3.5 w-3.5 text-zoru-danger-ink" />
                              Clock Out
                            </ZoruButton>
                          ) : null}
                          <ZoruButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleManualEntry(emp._id, rec)}
                            title={rec ? 'Edit record' : 'Add manual entry'}
                          >
                            {rec ? <Edit className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          </ZoruButton>
                          {rec?._id && (
                            <ZoruButton variant="ghost" size="sm" onClick={() => handleDelete(rec._id)}>
                              <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                            </ZoruButton>
                          )}
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>

      {/* Clock-in / Manual entry dialog */}
      <ZoruDialog open={modal.open} onOpenChange={(v) => setModal((m) => ({ ...m, open: v }))}>
        <ZoruDialogContent className="max-w-lg">
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {modal.mode === 'clock-in' ? 'Clock In' : modal.record ? 'Edit Attendance' : 'Add Attendance'}
            </ZoruDialogTitle>
          </ZoruDialogHeader>

          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">Employee</ZoruLabel>
              <p className="mt-1 text-[13px] text-zoru-ink">
                {employees.find((e) => e._id === modal.employeeId)
                  ? [
                      employees.find((e) => e._id === modal.employeeId)?.firstName,
                      employees.find((e) => e._id === modal.employeeId)?.lastName,
                    ]
                      .filter(Boolean)
                      .join(' ')
                  : modal.employeeId}
              </p>
            </div>

            <div>
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">Working From</ZoruLabel>
              <ZoruSelect
                value={formState.working_from}
                onValueChange={(v) => setFormState((p) => ({ ...p, working_from: v }))}
              >
                <ZoruSelectTrigger className="mt-1.5 h-9 text-[13px]">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {WORKING_FROM_OPTIONS.map((o) => (
                    <ZoruSelectItem key={o} value={o} className="capitalize">
                      {o.replace('-', ' ')}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div>
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">Shift</ZoruLabel>
              <ZoruSelect
                value={formState.shift_id || undefined}
                onValueChange={(v) => setFormState((p) => ({ ...p, shift_id: v }))}
              >
                <ZoruSelectTrigger className="mt-1.5 h-9 text-[13px]">
                  <ZoruSelectValue placeholder="Select shift (optional)" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {shifts.map((s) => (
                    <ZoruSelectItem key={s._id} value={s._id}>
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-3 w-3 rounded-[3px]"
                          style={{ backgroundColor: s.color_code || '#EAB308' }}
                        />
                        {s.name}
                      </span>
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            {modal.mode === 'manual' && (
              <>
                <div>
                  <ZoruLabel className="text-[12px] text-zoru-ink-muted">Clock In Time</ZoruLabel>
                  <ZoruInput
                    type="datetime-local"
                    value={formState.clock_in_time}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, clock_in_time: e.target.value }))
                    }
                    className="mt-1.5 h-9 text-[13px]"
                  />
                </div>
                <div>
                  <ZoruLabel className="text-[12px] text-zoru-ink-muted">Clock Out Time</ZoruLabel>
                  <ZoruInput
                    type="datetime-local"
                    value={formState.clock_out_time}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, clock_out_time: e.target.value }))
                    }
                    className="mt-1.5 h-9 text-[13px]"
                  />
                </div>
              </>
            )}

            <div>
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">Latitude (optional)</ZoruLabel>
              <ZoruInput
                value={formState.latitude}
                onChange={(e) => setFormState((p) => ({ ...p, latitude: e.target.value }))}
                placeholder="28.6139"
                className="mt-1.5 h-9 text-[13px]"
              />
            </div>
            <div>
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">Longitude (optional)</ZoruLabel>
              <ZoruInput
                value={formState.longitude}
                onChange={(e) => setFormState((p) => ({ ...p, longitude: e.target.value }))}
                placeholder="77.2090"
                className="mt-1.5 h-9 text-[13px]"
              />
            </div>

            <div className="flex items-center gap-4 md:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-zoru-ink">
                <input
                  type="checkbox"
                  checked={formState.late}
                  onChange={(e) => setFormState((p) => ({ ...p, late: e.target.checked }))}
                  className="h-4 w-4"
                />
                Mark as Late
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-zoru-ink">
                <input
                  type="checkbox"
                  checked={formState.half_day}
                  onChange={(e) => setFormState((p) => ({ ...p, half_day: e.target.checked }))}
                  className="h-4 w-4"
                />
                Half Day
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-zoru-ink">
                <input
                  type="checkbox"
                  checked={formState.overwrite}
                  onChange={(e) => setFormState((p) => ({ ...p, overwrite: e.target.checked }))}
                  className="h-4 w-4"
                />
                Overwrite Existing
              </label>
            </div>
          </div>

          <ZoruDialogFooter>
            <ZoruButton
              variant="outline"
              onClick={() => setModal((m) => ({ ...m, open: false }))}
            >
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={submitModal}
              disabled={isSaving}
            >
              {modal.mode === 'clock-in' ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              {isSaving
                ? 'Saving…'
                : modal.mode === 'clock-in'
                ? 'Clock In'
                : modal.record
                ? 'Update'
                : 'Add Record'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
