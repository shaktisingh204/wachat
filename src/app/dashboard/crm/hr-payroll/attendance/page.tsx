'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCheckbox,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  AlarmClock,
  CalendarCheck,
  CalendarMinus,
  CalendarOff,
  Download,
  ListChecks,
  Plus,
  UserCheck,
  Eye,
  X,
} from 'lucide-react';

/**
 * Attendance — list page.
 *
 * Adds KPI strip (present / absent / on leave / late), bulk mark-present,
 * bulk mark-absent, and CSV export to the existing date + department + search.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import { getCrmAttendance, markCrmAttendance } from '@/app/actions/crm-hr.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';

const BASE = '/dashboard/crm/hr-payroll/attendance';

const STATUS_TONE: Record<string, StatusTone> = {
  Present: 'green',
  Absent: 'red',
  'Half Day': 'amber',
  Leave: 'blue',
  Late: 'amber',
};

interface EmployeeLite {
  _id: string;
  firstName?: string;
  lastName?: string;
  departmentId?: string | null;
  department?: string;
}

interface Row {
  _id: string;
  employeeId: string;
  employeeName: string;
  departmentId: string | null;
  status: string;
  checkIn?: string;
  checkOut?: string;
  notes?: string;
}

interface AttendanceKpi {
  present: number;
  absent: number;
  onLeave: number;
  late: number;
}

function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function fmtTime(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function employeeName(e: EmployeeLite): string {
  const full = [e.firstName, e.lastName].filter(Boolean).join(' ').trim();
  return full || 'Unnamed';
}

interface KpiPillProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'green' | 'red' | 'amber' | 'blue' | 'neutral';
}

function KpiPill({ icon, label, value, tone = 'neutral' }: KpiPillProps) {
  const toneClass: Record<string, string> = {
    green: 'text-green-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
    blue: 'text-blue-600',
    neutral: 'text-zoru-ink-muted',
  };
  return (
    <ZoruCard>
      <ZoruCardContent className="flex items-center gap-3 p-4">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 ${toneClass[tone]}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            {label}
          </p>
          <p className="text-[18px] font-semibold leading-tight text-zoru-ink">
            {value}
          </p>
        </div>
      </ZoruCardContent>
    </ZoruCard>
  );
}

export default function AttendanceListPage(): React.JSX.Element {
  const [dateIso, setDateIso] = React.useState<string>(todayIso());
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');
  const [employees, setEmployees] = React.useState<EmployeeLite[]>([]);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [isPending, startTransition] = React.useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = React.useState(false);
  const [bulkAction, setBulkAction] = React.useState<'Present' | 'Absent' | null>(null);
  const [bulkMarking, startBulkMark] = React.useTransition();
  const { toast } = useZoruToast();

  // Load attendance + employees in parallel for the picked date.
  React.useEffect(() => {
    startTransition(async () => {
      const [att, emps] = await Promise.all([
        getCrmAttendance(new Date(dateIso)),
        getCrmEmployees(),
      ]);
      const empList = (emps as unknown as EmployeeLite[]).map((e) => ({
        _id: String((e as Record<string, unknown>)._id ?? ''),
        firstName: e.firstName,
        lastName: e.lastName,
        departmentId:
          (e.departmentId as string | undefined) ??
          (e.department as string | undefined) ??
          null,
      }));
      setEmployees(empList);

      const empMap = new Map<string, EmployeeLite>();
      for (const e of empList) empMap.set(e._id, e);

      const mapped: Row[] = (att as unknown as Array<Record<string, unknown>>).map(
        (a) => {
          const empId = String(a.employeeId ?? '');
          const emp = empMap.get(empId);
          return {
            _id: String(a._id),
            employeeId: empId,
            employeeName: emp ? employeeName(emp) : 'Unknown',
            departmentId: emp?.departmentId ?? null,
            status: String(a.status ?? '—'),
            checkIn: a.checkIn as string | undefined,
            checkOut: a.checkOut as string | undefined,
            notes: a.notes as string | undefined,
          };
        },
      );
      setRows(mapped);
      setSelected(new Set());
    });
  }, [dateIso]);

  const departments = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) {
      if (e.departmentId) set.add(String(e.departmentId));
    }
    return Array.from(set).sort();
  }, [employees]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (departmentFilter !== 'all' && r.departmentId !== departmentFilter) {
        return false;
      }
      if (q && !r.employeeName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, departmentFilter]);

  const kpi = React.useMemo<AttendanceKpi>(() => {
    return {
      present: rows.filter((r) => r.status === 'Present').length,
      absent: rows.filter((r) => r.status === 'Absent').length,
      onLeave: rows.filter((r) => r.status === 'Leave').length,
      late: rows.filter((r) => r.status === 'Late').length,
    };
  }, [rows]);

  /* ── Selection ── */
  const headChecked =
    filtered.length > 0 && filtered.every((r) => selected.has(r._id));

  const toggleAll = (all: boolean) =>
    setSelected(all ? new Set(filtered.map((r) => r._id)) : new Set());

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* ── Bulk mark ── */
  const openBulkMark = (action: 'Present' | 'Absent') => {
    setBulkAction(action);
    setBulkConfirmOpen(true);
  };

  const runBulkMark = () => {
    if (!bulkAction || selected.size === 0) return;
    setBulkConfirmOpen(false);
    const ids = Array.from(selected);
    const date = new Date(dateIso);
    startBulkMark(async () => {
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        // id is the attendance record's _id; but markCrmAttendance needs employeeId
        const row = rows.find((r) => r._id === id);
        if (!row) { failed += 1; continue; }
        const res = await markCrmAttendance(
          row.employeeId,
          bulkAction as 'Present' | 'Absent',
          date,
        );
        if (res.success) ok += 1;
        else failed += 1;
      }
      toast({
        title:
          failed === 0
            ? `${ok} marked as ${bulkAction}`
            : `${ok} updated · ${failed} failed`,
        variant: failed > 0 ? 'destructive' : undefined,
      });
      setSelected(new Set());
      setBulkAction(null);
      // Reload
      startTransition(async () => {
        const att = await getCrmAttendance(new Date(dateIso));
        const empMap = new Map<string, EmployeeLite>();
        for (const e of employees) empMap.set(e._id, e);
        const mapped: Row[] = (att as unknown as Array<Record<string, unknown>>).map(
          (a) => {
            const empId = String(a.employeeId ?? '');
            const emp = empMap.get(empId);
            return {
              _id: String(a._id),
              employeeId: empId,
              employeeName: emp ? employeeName(emp) : 'Unknown',
              departmentId: emp?.departmentId ?? null,
              status: String(a.status ?? '—'),
              checkIn: a.checkIn as string | undefined,
              checkOut: a.checkOut as string | undefined,
              notes: a.notes as string | undefined,
            };
          },
        );
        setRows(mapped);
      });
    });
  };

  /* ── Export CSV ── */
  const handleExportCsv = () => {
    const headers = [
      'Employee',
      'Department',
      'Status',
      'Check-in',
      'Check-out',
      'Date',
    ];
    const exportRows = filtered.map((r) => ({
      Employee: r.employeeName,
      Department: r.departmentId ?? '',
      Status: r.status,
      'Check-in': fmtTime(r.checkIn),
      'Check-out': fmtTime(r.checkOut),
      Date: dateIso,
    }));
    downloadCsv(`attendance-${dateIso}-${dateStamp()}.csv`, headers, exportRows);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiPill
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Present today"
          value={kpi.present}
          tone="green"
        />
        <KpiPill
          icon={<CalendarOff className="h-4 w-4" />}
          label="Absent today"
          value={kpi.absent}
          tone="red"
        />
        <KpiPill
          icon={<CalendarMinus className="h-4 w-4" />}
          label="On leave today"
          value={kpi.onLeave}
          tone="blue"
        />
        <KpiPill
          icon={<AlarmClock className="h-4 w-4" />}
          label="Late arrivals"
          value={kpi.late}
          tone="amber"
        />
      </div>

      <EntityListShell
        title="Attendance"
        subtitle="Daily attendance roster. Pick a date, filter by department, then bulk-mark."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              CSV
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`${BASE}/new?date=${dateIso}`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Bulk-mark for date
              </Link>
            </ZoruButton>
          </div>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search employees…',
        }}
        filters={
          <>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-zoru-ink-muted">Date</span>
              <ZoruInput
                type="date"
                value={dateIso}
                onChange={(e) => setDateIso(e.target.value)}
                className="h-9 w-[160px] rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <ZoruSelect
              value={departmentFilter}
              onValueChange={setDepartmentFilter}
            >
              <ZoruSelectTrigger className="h-9 w-[200px]">
                <ZoruSelectValue placeholder="Department" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All departments</ZoruSelectItem>
                {departments.map((d) => (
                  <ZoruSelectItem key={d} value={d}>
                    {d}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
                <ListChecks className="h-4 w-4 text-zoru-primary" />
                {selected.size} selected
              </div>
              <div className="flex items-center gap-2">
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => openBulkMark('Present')}
                  disabled={bulkMarking}
                >
                  <UserCheck className="h-3.5 w-3.5" /> Mark Present
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => openBulkMark('Absent')}
                  disabled={bulkMarking}
                >
                  <CalendarOff className="h-3.5 w-3.5" /> Mark Absent
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(new Set())}
                  aria-label="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isPending && rows.length === 0}
      >
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-8">
                  <ZoruCheckbox
                    checked={headChecked}
                    onCheckedChange={(c) => toggleAll(Boolean(c))}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Department</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Check-in</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Check-out</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filtered.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-zoru-ink-muted"
                  >
                    {isPending
                      ? 'Loading…'
                      : `No attendance recorded for ${dateIso}.`}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((r) => {
                  const tone = STATUS_TONE[r.status] ?? 'neutral';
                  const checked = selected.has(r._id);
                  return (
                    <ZoruTableRow key={r._id} className="border-zoru-line">
                      <ZoruTableCell>
                        <ZoruCheckbox
                          checked={checked}
                          onCheckedChange={() => toggleOne(r._id)}
                          aria-label={`Select ${r.employeeName}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        <EntityRowLink
                          href={`${BASE}/${r._id}`}
                          label={r.employeeName}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {r.departmentId ?? '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill label={r.status} tone={tone} />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {fmtTime(r.checkIn)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {fmtTime(r.checkOut)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <ZoruButton variant="ghost" size="icon" asChild>
                          <Link href={`${BASE}/${r._id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </ZoruButton>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </EntityListShell>

      <p className="text-[12px] text-zoru-ink-muted">
        <CalendarCheck className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
        Showing attendance for <strong>{dateIso}</strong>.
      </p>

      {/* Bulk mark confirm */}
      <ZoruAlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Mark {selected.size} employee{selected.size === 1 ? '' : 's'} as{' '}
              {bulkAction}?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This will overwrite any existing attendance record for these employees
              on {dateIso}.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={runBulkMark} disabled={bulkMarking}>
              {bulkMarking ? 'Saving…' : `Mark ${bulkAction}`}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
