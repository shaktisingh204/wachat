"use client";

import * as React from "react";
import { CalendarCheck, Plus, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  SelectField,
  useToast,
  type DataTableColumn,
  type SelectOption,
} from "@/components/sabcrm/20ui";
import { SabHrmPageShell, statusTone } from "@/components/sabhrm/page-toolkit";
import {
  createAttendance,
  deleteAttendance,
  listAttendance,
  type AttendanceFormValues,
  type AttendancePickerOptions,
} from "@/app/actions/sabhrm/attendance.actions";
import type {
  AttendanceRow,
  AttendanceStatus,
  Paginated,
} from "@/lib/sabhrm/types";

const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half day",
  late: "Late",
  on_leave: "On leave",
  holiday: "Holiday",
  week_off: "Week off",
};

const STATUS_OPTIONS: SelectOption[] = Object.entries(ATTENDANCE_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const TONE_BADGE: Record<string, "default" | "success" | "warning" | "destructive"> = {
  default: "default",
  positive: "success",
  warning: "warning",
  danger: "destructive",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: AttendanceFormValues = {
  employeeId: "",
  date: todayISO(),
  status: "present",
  checkIn: "",
  checkOut: "",
  note: "",
};

export function AttendanceClient({
  initial,
  options,
  loadError,
}: {
  initial: Paginated<AttendanceRow>;
  options: AttendancePickerOptions;
  loadError: string | null;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<AttendanceRow[]>(initial.rows);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [employeeFilter, setEmployeeFilter] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<AttendanceFormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(
    async (nextFrom = from, nextTo = to, nextEmp = employeeFilter) => {
      setLoading(true);
      const res = await listAttendance({
        from: nextFrom || undefined,
        to: nextTo || undefined,
        employeeId: nextEmp || undefined,
        pageSize: 100,
      });
      setLoading(false);
      if (res.ok) setRows(res.data.rows);
      else toast({ title: "Couldn't load attendance", description: res.error, variant: "destructive" });
    },
    [from, to, employeeFilter, toast],
  );

  // Re-fetch when filters change.
  React.useEffect(() => {
    const t = setTimeout(() => void refresh(from, to, employeeFilter), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, employeeFilter]);

  const patch = (p: Partial<AttendanceFormValues>) => setForm((f) => ({ ...f, ...p }));

  const submit = React.useCallback(async () => {
    setFormErr(null);
    setSaving(true);
    const res = await createAttendance(form);
    setSaving(false);
    if (!res.ok) {
      setFormErr(res.error);
      return;
    }
    toast({ title: "Attendance marked", description: `${res.data.employeeName} — ${res.data.date}` });
    setOpen(false);
    setForm(EMPTY_FORM);
    setRows((r) => [res.data, ...r]);
  }, [form, toast]);

  const remove = React.useCallback(
    async (row: AttendanceRow) => {
      if (!window.confirm(`Delete attendance for ${row.employeeName} on ${row.date}?`)) return;
      const res = await deleteAttendance(row.id);
      if (!res.ok) {
        toast({ title: "Couldn't delete", description: res.error, variant: "destructive" });
        return;
      }
      setRows((r) => r.filter((x) => x.id !== row.id));
      toast({ title: "Attendance deleted" });
    },
    [toast],
  );

  const columns: DataTableColumn<AttendanceRow>[] = [
    {
      key: "employeeName",
      header: "Employee",
      render: (r) => (
        <span className="text-sm font-medium text-[var(--st-text)]">{r.employeeName}</span>
      ),
    },
    { key: "date", header: "Date", render: (r) => <span className="text-sm tabular-nums">{r.date || "—"}</span> },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={TONE_BADGE[statusTone(r.status)]}>{ATTENDANCE_STATUS_LABELS[r.status]}</Badge>
      ),
    },
    { key: "checkIn", header: "In", render: (r) => <span className="text-sm tabular-nums">{r.checkIn ?? "—"}</span> },
    { key: "checkOut", header: "Out", render: (r) => <span className="text-sm tabular-nums">{r.checkOut ?? "—"}</span> },
    {
      key: "workedHours",
      header: "Hours",
      align: "right",
      render: (r) => (
        <span className="text-sm tabular-nums">{r.workedHours != null ? r.workedHours.toFixed(2) : "—"}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          iconLeft={Trash2}
          aria-label={`Delete attendance for ${r.employeeName}`}
          onClick={(e) => {
            e.stopPropagation();
            void remove(r);
          }}
        />
      ),
    },
  ];

  return (
    <SabHrmPageShell
      title="Attendance"
      description="Daily attendance log. Mark attendance for an employee and track worked hours from check-in/out."
      actions={
        <Button
          variant="primary"
          size="sm"
          iconLeft={Plus}
          onClick={() => {
            setForm({ ...EMPTY_FORM, date: todayISO() });
            setFormErr(null);
            setOpen(true);
          }}
        >
          Mark attendance
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
        <div className="w-40">
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
        </div>
        <div className="w-40">
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <div className="min-w-[200px] flex-1">
          <Field label="Employee">
            <SelectField
              value={employeeFilter}
              options={[{ value: "", label: "All employees" }, ...options.employees]}
              onChange={(v) => setEmployeeFilter(String(v))}
            />
          </Field>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={<CalendarCheck aria-hidden />}
            title={loadError ? "Couldn't load attendance" : "No attendance records"}
            description={loadError ?? "Mark attendance for an employee to start building your daily log."}
            action={
              !loadError ? (
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
                  Mark attendance
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(r) => r.id}
            hover
            density={loading ? "comfortable" : "comfortable"}
          />
        </Card>
      )}

      {/* Mark attendance dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark attendance</DialogTitle>
            <DialogDescription>
              Record a day&apos;s attendance for an employee. If you enter both a
              check-in and check-out time, worked hours are computed automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Employee" className="sm:col-span-2">
              <SelectField
                value={form.employeeId}
                options={[{ value: "", label: "Select employee" }, ...options.employees]}
                onChange={(v) => patch({ employeeId: String(v) })}
              />
            </Field>
            <Field label="Date">
              <Input type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} />
            </Field>
            <Field label="Status">
              <SelectField
                value={form.status}
                options={STATUS_OPTIONS}
                onChange={(v) => patch({ status: v as AttendanceStatus })}
              />
            </Field>
            <Field label="Check-in">
              <Input type="time" value={form.checkIn ?? ""} onChange={(e) => patch({ checkIn: e.target.value })} />
            </Field>
            <Field label="Check-out">
              <Input type="time" value={form.checkOut ?? ""} onChange={(e) => patch({ checkOut: e.target.value })} />
            </Field>
            <Field label="Note" className="sm:col-span-2">
              <Input
                value={form.note ?? ""}
                onChange={(e) => patch({ note: e.target.value })}
                placeholder="Optional note"
              />
            </Field>
          </div>

          {formErr ? <p className="mt-1 text-sm text-[var(--st-status-bad,#dc2626)]">{formErr}</p> : null}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              loading={saving}
              disabled={saving || !form.employeeId || !form.date}
              onClick={() => void submit()}
            >
              Mark attendance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabHrmPageShell>
  );
}
