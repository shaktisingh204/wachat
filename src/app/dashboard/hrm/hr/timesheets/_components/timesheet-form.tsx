'use client';

// TODO 1E.sweep: status/billable dropdowns -> <EnumFormField>; project -> <EntityFormField entity="project">; employee -> <EntityFormField entity="employee">. See plan §1E.

/**
 * <TimesheetForm /> — shared form used by `/new` and `/[id]`.
 *
 * Renders a 7-day weekly grid (Mon..Sun) + employee picker + status +
 * notes + optional project breakdowns. Submits via `saveCrmTimesheet`.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';

import {
    ZoruButton,
    ZoruCard,
    ZoruInput,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';

import {
    saveCrmTimesheet,
    type CrmTimesheetDoc,
    type CrmTimesheetProjectBreakdown,
    type CrmTimesheetStatus,
} from '@/app/actions/crm-timesheets.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const STATUS_OPTIONS: Array<{ value: CrmTimesheetStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'archived', label: 'Archived' },
];

interface EmployeeLite {
    _id: string;
    firstName?: string;
    lastName?: string;
}

interface Props {
    initial?: CrmTimesheetDoc | null;
}

function employeeName(e: EmployeeLite): string {
    const full = [e.firstName, e.lastName].filter(Boolean).join(' ').trim();
    return full || 'Unnamed';
}

function isoWeekStart(): string {
    const d = new Date();
    const day = d.getDay(); // 0=Sun..6=Sat
    const diff = day === 0 ? -6 : 1 - day; // back to Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}

function plusDaysIso(iso: string, days: number): string {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

export function TimesheetForm({ initial }: Props): React.JSX.Element {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [employees, setEmployees] = React.useState<EmployeeLite[]>([]);
    const [isSaving, startSave] = React.useTransition();

    const [employeeId, setEmployeeId] = React.useState(initial?.employeeId ?? '');
    const [weekStart, setWeekStart] = React.useState(
        initial?.weekStartDate?.slice(0, 10) ?? isoWeekStart(),
    );
    const [weekEnd, setWeekEnd] = React.useState(
        initial?.weekEndDate?.slice(0, 10) ?? plusDaysIso(isoWeekStart(), 6),
    );
    const [dailyHours, setDailyHours] = React.useState<number[]>(
        initial?.dailyHours && initial.dailyHours.length === 7
            ? initial.dailyHours
            : [0, 0, 0, 0, 0, 0, 0],
    );
    const [status, setStatus] = React.useState<CrmTimesheetStatus>(
        initial?.status ?? 'draft',
    );
    const [notes, setNotes] = React.useState(initial?.notes ?? '');
    const [projects, setProjects] = React.useState<CrmTimesheetProjectBreakdown[]>(
        initial?.projectBreakdowns ?? [],
    );

    React.useEffect(() => {
        getCrmEmployees()
            .then((es) =>
                setEmployees(
                    (es as unknown as EmployeeLite[]).map((e) => ({
                        _id: String(e._id),
                        firstName: e.firstName,
                        lastName: e.lastName,
                    })),
                ),
            )
            .catch(() => setEmployees([]));
    }, []);

    // Auto-sync the end date as 6 days after start.
    React.useEffect(() => {
        if (weekStart) {
            const expected = plusDaysIso(weekStart, 6);
            setWeekEnd((curr) => (curr === expected ? curr : expected));
        }
    }, [weekStart]);

    const totalHours = React.useMemo(
        () => dailyHours.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0),
        [dailyHours],
    );

    const updateDay = (i: number, value: string) => {
        const n = Number(value);
        setDailyHours((prev) => {
            const next = prev.slice();
            next[i] = Number.isFinite(n) ? n : 0;
            return next;
        });
    };

    const addProject = () =>
        setProjects((p) => [...p, { projectId: '', hours: 0 }]);
    const updateProject = (i: number, patch: Partial<CrmTimesheetProjectBreakdown>) =>
        setProjects((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
    const removeProject = (i: number) =>
        setProjects((p) => p.filter((_, idx) => idx !== i));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        startSave(async () => {
            const fd = new FormData();
            if (initial?._id) fd.set('timesheetId', initial._id);
            fd.set('employeeId', employeeId);
            const emp = employees.find((x) => x._id === employeeId);
            if (emp) fd.set('employeeName', employeeName(emp));
            fd.set('weekStartDate', weekStart);
            fd.set('weekEndDate', weekEnd);
            fd.set('dailyHours', JSON.stringify(dailyHours));
            fd.set('totalHours', String(totalHours));
            fd.set('status', status);
            fd.set('notes', notes);
            fd.set(
                'projectBreakdowns',
                JSON.stringify(projects.filter((p) => p.projectId.trim())),
            );

            const result = await saveCrmTimesheet(undefined, fd);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
                return;
            }
            toast({ title: result.message ?? 'Saved' });
            router.push('/dashboard/hrm/hr/timesheets');
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <ZoruCard className="p-6">
                <h2 className="mb-4 text-[14px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Header
                </h2>
                <div className="grid gap-4 md:grid-cols-3">
                    <div>
                        <ZoruLabel>Employee *</ZoruLabel>
                        <ZoruSelect value={employeeId || undefined} onValueChange={setEmployeeId}>
                            <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                                <ZoruSelectValue placeholder="Select employee" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {employees.map((e) => (
                                    <ZoruSelectItem key={e._id} value={e._id}>
                                        {employeeName(e)}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div>
                        <ZoruLabel>Week start *</ZoruLabel>
                        <ZoruInput
                            type="date"
                            value={weekStart}
                            onChange={(e) => setWeekStart(e.target.value)}
                            required
                            className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                        />
                    </div>
                    <div>
                        <ZoruLabel>Week end</ZoruLabel>
                        <ZoruInput
                            type="date"
                            value={weekEnd}
                            onChange={(e) => setWeekEnd(e.target.value)}
                            className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                        />
                    </div>
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="text-[14px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                        Daily hours
                    </h2>
                    <span className="text-[12px] text-zoru-ink-muted">
                        Total: <strong className="text-zoru-ink">{totalHours.toFixed(2)}h</strong>
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-7">
                    {DAYS.map((label, idx) => (
                        <div key={label}>
                            <ZoruLabel>{label}</ZoruLabel>
                            <ZoruInput
                                type="number"
                                step="0.25"
                                min="0"
                                value={String(dailyHours[idx] ?? 0)}
                                onChange={(e) => updateDay(idx, e.target.value)}
                                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>
                    ))}
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-[14px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                        Project breakdowns
                    </h2>
                    <ZoruButton type="button" variant="outline" size="sm" onClick={addProject}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add project
                    </ZoruButton>
                </div>
                {projects.length === 0 ? (
                    <p className="text-[13px] text-zoru-ink-muted">
                        No project breakdowns. Optional — useful for billable splits.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {projects.map((p, i) => (
                            <div
                                key={`pb-${i}`}
                                className="grid items-end gap-3 md:grid-cols-[1fr_140px_auto]"
                            >
                                <div>
                                    <ZoruLabel>Project ID</ZoruLabel>
                                    <ZoruInput
                                        value={p.projectId}
                                        onChange={(e) =>
                                            updateProject(i, { projectId: e.target.value })
                                        }
                                        placeholder="proj_…"
                                        className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                    />
                                </div>
                                <div>
                                    <ZoruLabel>Hours</ZoruLabel>
                                    <ZoruInput
                                        type="number"
                                        step="0.25"
                                        min="0"
                                        value={String(p.hours)}
                                        onChange={(e) =>
                                            updateProject(i, { hours: Number(e.target.value) || 0 })
                                        }
                                        className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                    />
                                </div>
                                <ZoruButton
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeProject(i)}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </ZoruButton>
                            </div>
                        ))}
                    </div>
                )}
            </ZoruCard>

            <ZoruCard className="p-6">
                <h2 className="mb-4 text-[14px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Status & notes
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <ZoruLabel>Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmTimesheetStatus)}
                        >
                            <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div>
                        <ZoruLabel>Notes</ZoruLabel>
                        <ZoruTextarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="mt-1.5 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                        />
                    </div>
                </div>
            </ZoruCard>

            <div className="flex justify-end gap-2">
                <ZoruButton
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/dashboard/hrm/hr/timesheets')}
                >
                    Cancel
                </ZoruButton>
                <ZoruButton type="submit" disabled={isSaving}>
                    {isSaving ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    {initial?._id ? 'Save changes' : 'Create timesheet'}
                </ZoruButton>
            </div>
        </form>
    );
}
