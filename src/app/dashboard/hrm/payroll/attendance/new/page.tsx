'use client';

import { Button, Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter,
  useSearchParams } from 'next/navigation';
import {
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * Bulk-mark attendance — one row per employee for a single date.
 *
 * Uses `markCrmAttendance` per row. Status options: Present | Absent |
 * Late | Half Day | Leave. Saving fires a single batch.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import { markCrmAttendance } from '@/app/actions/crm-hr.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';

type BulkStatus = 'Present' | 'Absent' | 'Late' | 'Half Day' | 'Leave';

const STATUS_OPTIONS: BulkStatus[] = ['Present', 'Absent', 'Late', 'Half Day', 'Leave'];

interface EmployeeLite {
    _id: string;
    firstName?: string;
    lastName?: string;
    departmentId?: string | null;
    department?: string;
}

function employeeName(e: EmployeeLite): string {
    const full = [e.firstName, e.lastName].filter(Boolean).join(' ').trim();
    return full || 'Unnamed';
}

function todayIso(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}

export default function BulkMarkAttendancePage(): React.JSX.Element {
    const router = useRouter();
    const params = useSearchParams();
    const { toast } = useToast();

    const initialDate = params.get('date') || todayIso();
    const [dateIso, setDateIso] = React.useState(initialDate);
    const [employees, setEmployees] = React.useState<EmployeeLite[]>([]);
    const [statuses, setStatuses] = React.useState<Record<string, BulkStatus>>({});
    const [departmentFilter, setDepartmentFilter] = React.useState('all');
    const [search, setSearch] = React.useState('');
    const [isLoading, startLoad] = React.useTransition();
    const [isSaving, startSave] = React.useTransition();

    React.useEffect(() => {
        startLoad(async () => {
            const emps = await getCrmEmployees();
            const list = (emps as unknown as EmployeeLite[]).map((e) => ({
                _id: String(e._id),
                firstName: e.firstName,
                lastName: e.lastName,
                departmentId:
                    (e.departmentId as string | undefined) ??
                    (e.department as string | undefined) ??
                    null,
            }));
            setEmployees(list);
            // Default every employee to 'Present' for a fast-path mark-all.
            const seed: Record<string, BulkStatus> = {};
            for (const e of list) seed[e._id] = 'Present';
            setStatuses(seed);
        });
    }, []);

    const departments = React.useMemo(() => {
        const set = new Set<string>();
        for (const e of employees) {
            if (e.departmentId) set.add(String(e.departmentId));
        }
        return Array.from(set).sort();
    }, [employees]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return employees.filter((e) => {
            if (departmentFilter !== 'all' && e.departmentId !== departmentFilter) {
                return false;
            }
            if (q && !employeeName(e).toLowerCase().includes(q)) return false;
            return true;
        });
    }, [employees, search, departmentFilter]);

    const applyAll = React.useCallback(
        (status: BulkStatus) => {
            setStatuses((prev) => {
                const next = { ...prev };
                for (const e of filtered) next[e._id] = status;
                return next;
            });
        },
        [filtered],
    );

    const updateOne = React.useCallback((id: string, status: BulkStatus) => {
        setStatuses((prev) => ({ ...prev, [id]: status }));
    }, []);

    const handleSave = () => {
        startSave(async () => {
            const ids = filtered.map((e) => e._id);
            let ok = 0;
            let failed = 0;
            // Fire in parallel for speed (independent updates).
            await Promise.all(
                ids.map(async (id) => {
                    const s = statuses[id];
                    if (!s) return;
                    const res = await markCrmAttendance(id, s, new Date(dateIso));
                    if (res.success) ok++;
                    else failed++;
                }),
            );
            if (failed === 0) {
                toast({
                    title: 'Attendance saved',
                    description: `${ok} record${ok === 1 ? '' : 's'} updated for ${dateIso}.`,
                });
                router.push(`/dashboard/hrm/payroll/attendance?date=${dateIso}`);
            } else {
                toast({
                    title: 'Saved with some errors',
                    description: `${ok} ok · ${failed} failed.`,
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <EntityListShell
            title="Bulk-mark attendance"
            subtitle="Pick a date, mark each employee's status, save once."
        >

            <Card className="p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <Label>Date</Label>
                        <Input
                            type="date"
                            value={dateIso}
                            onChange={(e) => setDateIso(e.target.value)}
                            className="mt-1.5 h-10 w-[180px] rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                        />
                    </div>
                    <div>
                        <Label>Department</Label>
                        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                            <SelectTrigger className="mt-1.5 h-10 w-[200px]">
                                <SelectValue placeholder="All departments" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All departments</SelectItem>
                                {departments.map((d) => (
                                    <SelectItem key={d} value={d}>
                                        {d}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="min-w-[200px] flex-1">
                        <Label>Search</Label>
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search employees…"
                            className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                        />
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-[12px] text-[var(--st-text-secondary)]">Apply to all visible:</span>
                    {STATUS_OPTIONS.map((s) => (
                        <Button
                            key={s}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => applyAll(s)}
                        >
                            {s}
                        </Button>
                    ))}
                </div>
            </Card>

            <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                <Table>
                    <THead>
                        <Tr className="border-[var(--st-border)] hover:bg-transparent">
                            <Th className="text-[var(--st-text-secondary)]">Employee</Th>
                            <Th className="text-[var(--st-text-secondary)]">Department</Th>
                            <Th className="text-[var(--st-text-secondary)]">Status</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {isLoading && employees.length === 0 ? (
                            <Tr className="border-[var(--st-border)]">
                                <Td colSpan={3} className="h-24 text-center">
                                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                </Td>
                            </Tr>
                        ) : filtered.length === 0 ? (
                            <Tr className="border-[var(--st-border)]">
                                <Td
                                    colSpan={3}
                                    className="h-24 text-center text-[var(--st-text-secondary)]"
                                >
                                    No employees match this filter.
                                </Td>
                            </Tr>
                        ) : (
                            filtered.map((e) => {
                                const id = e._id;
                                const current = statuses[id] ?? 'Present';
                                return (
                                    <Tr key={id} className="border-[var(--st-border)]">
                                        <Td className="font-medium text-[var(--st-text)]">
                                            {employeeName(e)}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {e.departmentId ?? '—'}
                                        </Td>
                                        <Td>
                                            <Select
                                                value={current}
                                                onValueChange={(v) => updateOne(id, v as BulkStatus)}
                                            >
                                                <SelectTrigger className="h-9 w-[160px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {STATUS_OPTIONS.map((s) => (
                                                        <SelectItem key={s} value={s}>
                                                            {s}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </Td>
                                    </Tr>
                                );
                            })
                        )}
                    </TBody>
                </Table>
            </div>

            <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                    <Link href="/dashboard/hrm/payroll/attendance">Cancel</Link>
                </Button>
                <Button onClick={handleSave} disabled={isSaving || filtered.length === 0}>
                    {isSaving ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    Save attendance
                </Button>
            </div>
        </EntityListShell>
    );
}
