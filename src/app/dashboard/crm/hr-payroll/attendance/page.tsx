'use client';

import {
  ZoruButton,
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
} from '@/components/zoruui';
import {
  CalendarCheck,
  CheckSquare,
  Plus,
  Eye } from 'lucide-react';

/**
 * Attendance — list page.
 *
 * Filterable by date + department. Pulls `getCrmAttendance(date)` for
 * the picked date and `getCrmEmployees()` once to join names.
 * Rows are read-only; per-row click navigates to the detail page,
 * bulk-mark CTA navigates to `/new`.
 */

import * as React from 'react';
import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { getCrmAttendance } from '@/app/actions/crm-hr.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';

const BASE = '/dashboard/crm/hr-payroll/attendance';

type AttendanceStatus = 'Present' | 'Absent' | 'Half Day' | 'Leave' | 'Late';

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

export default function AttendanceListPage(): React.JSX.Element {
    const [dateIso, setDateIso] = React.useState<string>(todayIso());
    const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
    const [search, setSearch] = React.useState('');
    const [employees, setEmployees] = React.useState<EmployeeLite[]>([]);
    const [rows, setRows] = React.useState<Row[]>([]);
    const [isPending, startTransition] = React.useTransition();

    // Load attendance + employees in parallel for the picked date.
    React.useEffect(() => {
        startTransition(async () => {
            const [att, emps] = await Promise.all([
                getCrmAttendance(new Date(dateIso)),
                getCrmEmployees(),
            ]);
            const empList = (emps as unknown as EmployeeLite[]).map((e) => ({
                _id: String(e._id),
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

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HRM', href: '/dashboard/hrm' },
                    { label: 'Payroll', href: '/dashboard/crm/hr-payroll' },
                    { label: 'Attendance' },
                ]}
                title="Attendance"
                subtitle="Daily attendance roster. Pick a date, filter by department, then bulk-mark."
                icon={CheckSquare}
                actions={
                    <ZoruButton asChild>
                        <Link href={`${BASE}/new?date=${dateIso}`}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Bulk-mark for date
                        </Link>
                    </ZoruButton>
                }
            />

            <EntityListShell
                title=""
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
                        <ZoruSelect value={departmentFilter} onValueChange={setDepartmentFilter}>
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
                loading={isPending && rows.length === 0}
            >
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Department</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Check-in</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Check-out</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {filtered.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={6}
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
                                    return (
                                        <ZoruTableRow key={r._id} className="border-zoru-line">
                                            <ZoruTableCell className="font-medium text-zoru-ink">
                                                <Link
                                                    href={`${BASE}/${r._id}`}
                                                    className="hover:underline"
                                                >
                                                    {r.employeeName}
                                                </Link>
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
        </div>
    );
}
