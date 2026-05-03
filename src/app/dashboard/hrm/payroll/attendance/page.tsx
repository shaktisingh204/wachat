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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
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

  /* ─── Clock In (quick) ─────────────────────── */
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

  /* ─── Clock Out (direct) ───────────────────── */
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

  /* ─── Manual entry ─────────────────────────── */
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

  // Stats
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
            <DatePicker date={date} setDate={setDate} />
            <ClayButton
              variant="pill"
              leading={<FileText className="h-4 w-4" strokeWidth={1.75} />}
            >
              Export
            </ClayButton>
          </>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ClayCard>
          <p className="text-[12px] text-muted-foreground">Present</p>
          <p className="mt-1 text-[26px] font-semibold text-foreground">{presentCount}</p>
        </ClayCard>
        <ClayCard>
          <p className="text-[12px] text-muted-foreground">Late</p>
          <p className="mt-1 text-[26px] font-semibold text-foreground">{lateCount}</p>
        </ClayCard>
        <ClayCard>
          <p className="text-[12px] text-muted-foreground">WFH</p>
          <p className="mt-1 text-[26px] font-semibold text-foreground">{wfhCount}</p>
        </ClayCard>
        <ClayCard>
          <p className="text-[12px] text-muted-foreground">Total Employees</p>
          <p className="mt-1 text-[26px] font-semibold text-foreground">{employees.length}</p>
        </ClayCard>
      </div>

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-foreground">
              Attendance — {date ? format(date, 'PPP') : '…'}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {records.length} record{records.length === 1 ? '' : 's'} for this date
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Employee</TableHead>
                <TableHead className="text-muted-foreground">Clock In</TableHead>
                <TableHead className="text-muted-foreground">Clock Out</TableHead>
                <TableHead className="text-muted-foreground">Working From</TableHead>
                <TableHead className="text-muted-foreground">Hours</TableHead>
                <TableHead className="text-muted-foreground">Flags</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-border">
                  <TableCell colSpan={7} className="h-24 text-center text-[13px] text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : employees.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={7} className="h-24 text-center text-[13px] text-muted-foreground">
                    No employees found.
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((emp) => {
                  const rec = recordByEmployee.get(emp._id);
                  const isIn = !!rec?.clock_in_time;
                  const isOut = !!rec?.clock_out_time;
                  return (
                    <TableRow key={emp._id} className="border-border">
                      <TableCell className="text-[13px] font-medium text-foreground">
                        {[emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Unnamed'}
                      </TableCell>
                      <TableCell className="text-[13px] text-foreground">
                        {isIn ? (
                          <span className="flex items-center gap-1.5 text-green-600">
                            <LogIn className="h-3.5 w-3.5" />
                            {fmt(rec?.clock_in_time)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[13px] text-foreground">
                        {isOut ? (
                          <span className="flex items-center gap-1.5 text-red-500">
                            <LogOut className="h-3.5 w-3.5" />
                            {fmt(rec?.clock_out_time)}
                          </span>
                        ) : isIn ? (
                          <span className="text-amber-500 text-[12px]">Active</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[12.5px] capitalize text-foreground">
                        {rec?.working_from ? (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {rec.working_from}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[13px] text-foreground">
                        {fmtHours(rec?.working_hours)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rec?.late && (
                            <ClayBadge tone="amber">Late</ClayBadge>
                          )}
                          {rec?.half_day && (
                            <ClayBadge tone="blue">Half Day</ClayBadge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!isIn ? (
                            <ClayButton
                              variant="pill"
                              size="sm"
                              leading={<LogIn className="h-3.5 w-3.5" strokeWidth={1.75} />}
                              onClick={() => handleQuickClockIn(emp._id)}
                              disabled={isSaving}
                            >
                              Clock In
                            </ClayButton>
                          ) : !isOut ? (
                            <ClayButton
                              variant="pill"
                              size="sm"
                              leading={<LogOut className="h-3.5 w-3.5 text-destructive" strokeWidth={1.75} />}
                              onClick={() => handleClockOut(emp._id)}
                              disabled={isSaving}
                            >
                              Clock Out
                            </ClayButton>
                          ) : null}
                          <ClayButton
                            variant="pill"
                            size="sm"
                            onClick={() => handleManualEntry(emp._id, rec)}
                            title={rec ? 'Edit record' : 'Add manual entry'}
                          >
                            {rec ? <Edit className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          </ClayButton>
                          {rec?._id && (
                            <ClayButton variant="pill" size="sm" onClick={() => handleDelete(rec._id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </ClayButton>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>

      {/* Clock-in / Manual entry dialog */}
      <Dialog open={modal.open} onOpenChange={(v) => setModal((m) => ({ ...m, open: v }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {modal.mode === 'clock-in' ? 'Clock In' : modal.record ? 'Edit Attendance' : 'Add Attendance'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4 md:grid-cols-2">
            {/* Employee display */}
            <div className="md:col-span-2">
              <Label className="text-[12px] text-muted-foreground">Employee</Label>
              <p className="mt-1 text-[13px] font-medium text-foreground">
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

            {/* Working From */}
            <div>
              <Label className="text-[12px] text-muted-foreground">Working From</Label>
              <Select
                value={formState.working_from}
                onValueChange={(v) => setFormState((p) => ({ ...p, working_from: v }))}
              >
                <SelectTrigger className="mt-1.5 h-9 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKING_FROM_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o} className="capitalize">
                      {o.replace('-', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Shift */}
            <div>
              <Label className="text-[12px] text-muted-foreground">Shift</Label>
              <Select
                value={formState.shift_id}
                onValueChange={(v) => setFormState((p) => ({ ...p, shift_id: v }))}
              >
                <SelectTrigger className="mt-1.5 h-9 text-[13px]">
                  <SelectValue placeholder="Select shift (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {shifts.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-3 w-3 rounded-[3px]"
                          style={{ backgroundColor: s.color_code || '#EAB308' }}
                        />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Manual times — only in manual mode */}
            {modal.mode === 'manual' && (
              <>
                <div>
                  <Label className="text-[12px] text-muted-foreground">Clock In Time</Label>
                  <Input
                    type="datetime-local"
                    value={formState.clock_in_time}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, clock_in_time: e.target.value }))
                    }
                    className="mt-1.5 h-9 text-[13px]"
                  />
                </div>
                <div>
                  <Label className="text-[12px] text-muted-foreground">Clock Out Time</Label>
                  <Input
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

            {/* GPS */}
            <div>
              <Label className="text-[12px] text-muted-foreground">Latitude (optional)</Label>
              <Input
                value={formState.latitude}
                onChange={(e) => setFormState((p) => ({ ...p, latitude: e.target.value }))}
                placeholder="28.6139"
                className="mt-1.5 h-9 text-[13px]"
              />
            </div>
            <div>
              <Label className="text-[12px] text-muted-foreground">Longitude (optional)</Label>
              <Input
                value={formState.longitude}
                onChange={(e) => setFormState((p) => ({ ...p, longitude: e.target.value }))}
                placeholder="77.2090"
                className="mt-1.5 h-9 text-[13px]"
              />
            </div>

            {/* Flags */}
            <div className="flex items-center gap-4 md:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  checked={formState.late}
                  onChange={(e) => setFormState((p) => ({ ...p, late: e.target.checked }))}
                  className="h-4 w-4"
                />
                Mark as Late
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  checked={formState.half_day}
                  onChange={(e) => setFormState((p) => ({ ...p, half_day: e.target.checked }))}
                  className="h-4 w-4"
                />
                Half Day
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
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

          <DialogFooter>
            <ClayButton
              variant="pill"
              onClick={() => setModal((m) => ({ ...m, open: false }))}
            >
              Cancel
            </ClayButton>
            <ClayButton
              variant="obsidian"
              onClick={submitModal}
              disabled={isSaving}
              leading={
                modal.mode === 'clock-in' ? (
                  <LogIn className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Clock className="h-4 w-4" strokeWidth={1.75} />
                )
              }
            >
              {isSaving
                ? 'Saving…'
                : modal.mode === 'clock-in'
                ? 'Clock In'
                : modal.record
                ? 'Update'
                : 'Add Record'}
            </ClayButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
