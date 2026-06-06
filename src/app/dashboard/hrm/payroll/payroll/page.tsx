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
  Button,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  Edit,
  Plus,
  Trash2,
} from 'lucide-react';

/**
 * Payroll Runs — list page.
 *
 * Upgraded to use spreadsheet-style `<CrmBulkyGrid>` and `useCrmBulkyState`
 * with double-click inline status editing.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import {
    deletePayrollRun,
    listPayrollRuns,
    updatePayrollRunStatus,
} from '@/app/actions/crm-payroll-runs.actions';
import type { CrmPayrollRunDoc } from '@/app/actions/crm-payroll-runs.actions.types';
import type { CrmPayrollRunStatus } from '@/app/actions/crm-payroll-runs.actions.types';
const BASE = '/dashboard/hrm/payroll/payroll';

const STATUS_TONE: Record<CrmPayrollRunStatus, StatusTone> = {
    draft: 'amber',
    in_progress: 'blue',
    processed: 'green',
    paid: 'green',
    archived: 'neutral',
};

const MONTH_LABELS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

function periodLabel(r: CrmPayrollRunDoc): string {
    const m = MONTH_LABELS[(r.period_month ?? 1) - 1] ?? '—';
    return `${m} ${r.period_year ?? ''}`.trim();
}



function statusLabel(s: string): string {
    return s.replace(/_/g, ' ');
}

export default function PayrollRunsListPage() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<
        CrmPayrollRunStatus | 'all'
    >('all');
    const [yearFilter, setYearFilter] = React.useState<string>('all');
    const [pendingDelete, setPendingDelete] =
        React.useState<CrmPayrollRunDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

    const bulky = useCrmBulkyState<CrmPayrollRunDoc>({
        initialData: [],
    });

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await listPayrollRuns({
                status: statusFilter === 'all' ? undefined : statusFilter,
                year: yearFilter === 'all' ? undefined : Number(yearFilter),
                limit: 200,
            });
            bulky.setData(res);
        } catch {
            bulky.setData([]);
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter, yearFilter, bulky]);

    React.useEffect(() => {
        const t = window.setTimeout(() => {
            void refresh();
        }, 250);
        return () => window.clearTimeout(t);
    }, [refresh]);

    const yearOptions = React.useMemo(() => {
        const ys = new Set<number>();
        for (const r of bulky.data) if (r.period_year) ys.add(r.period_year);
        if (ys.size === 0) ys.add(new Date().getFullYear());
        return Array.from(ys).sort((a, b) => b - a);
    }, [bulky.data]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return bulky.data;
        return bulky.data.filter((r) =>
            periodLabel(r).toLowerCase().includes(q) ||
            (r.notes ?? '').toLowerCase().includes(q),
        );
    }, [bulky.data, search]);

    const chartData = React.useMemo(() => {
        const sorted = [...filtered].sort((a, b) => {
            if (a.period_year !== b.period_year) return (a.period_year || 0) - (b.period_year || 0);
            return (a.period_month || 0) - (b.period_month || 0);
        });

        return sorted.map(r => ({
            name: periodLabel(r),
            Gross: r.total_gross || 0,
            Deductions: r.total_deductions || 0,
            Net: r.total_net || 0,
        }));
    }, [filtered]);

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const result = await deletePayrollRun(id);
            if (result.success) {
                toast({ title: 'Payroll run deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete run.',
                    variant: 'destructive',
                });
            }
        });
    };

    const handleSaveInlineEdit = async (id: string, updatedFields: Partial<CrmPayrollRunDoc>) => {
        if (!updatedFields.status) return;
        try {
            const res = await updatePayrollRunStatus(id, updatedFields.status);
            if (res.success) {
                toast({
                    title: 'Saved inline',
                    description: `Payroll run status updated to ${updatedFields.status.replace(/_/g, ' ')}.`,
                });
                bulky.setData((prev) =>
                    prev.map((row) => (row._id === id ? { ...row, ...updatedFields } : row))
                );
                bulky.cancelInlineEdit();
            } else {
                toast({
                    title: 'Update failed',
                    description: res.error ?? 'Could not update payroll run status.',
                    variant: 'destructive',
                });
            }
        } catch (err: any) {
            toast({
                title: 'Update failed',
                description: err.message,
                variant: 'destructive',
            });
        }
    };

    const columns = React.useMemo<ColumnDef<CrmPayrollRunDoc>[]>(() => [
        {
            key: 'period_month',
            header: 'Period',
            sortable: true,
            render: (row) => {
                const id = row._id;
                return (
                    <Link
                        href={`${BASE}/${id}`}
                        className="hover:underline font-medium text-[var(--st-text)]"
                    >
                        {periodLabel(row)}
                    </Link>
                );
            },
        },
        {
            key: 'run_date',
            header: 'Run date',
            sortable: true,
            render: (row) => <span className="text-[var(--st-text)]">{fmtDate(row.run_date)}</span>,
        },
        {
            key: 'total_employees',
            header: 'Employees',
            sortable: true,
            render: (row) => (
                <span className="font-mono text-[var(--st-text)]">{row.total_employees ?? 0}</span>
            ),
        },
        {
            key: 'total_gross',
            header: 'Gross',
            sortable: true,
            render: (row) => (
                <span className="font-mono text-[var(--st-text)]">{inr.format(row.total_gross ?? 0)}</span>
            ),
        },
        {
            key: 'total_deductions',
            header: 'Deductions',
            sortable: true,
            render: (row) => (
                <span className="font-mono text-[var(--st-text)]">{inr.format(row.total_deductions ?? 0)}</span>
            ),
        },
        {
            key: 'total_net',
            header: 'Net',
            sortable: true,
            render: (row) => (
                <span className="font-mono text-[var(--st-text)]">{inr.format(row.total_net ?? 0)}</span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (row) => {
                const status = (row.status ?? 'draft') as CrmPayrollRunStatus;
                const tone = STATUS_TONE[status] ?? 'neutral';
                return <StatusPill label={statusLabel(status)} tone={tone} />;
            },
            editRender: (row, value, onChange) => (
                <select
                    className="bg-[var(--st-bg-muted)] border border-[var(--st-border)] rounded px-1.5 py-0.5 text-xs text-[var(--st-text)] focus:outline-none"
                    value={value || 'draft'}
                    onChange={(e) => onChange(e.target.value as any)}
                >
                    <option value="draft">Draft</option>
                    <option value="in_progress">In Progress</option>
                    <option value="processed">Processed</option>
                    <option value="paid">Paid</option>
                    <option value="archived">Archived</option>
                </select>
            ),
        },
        {
            key: 'actions',
            header: '',
            render: (row) => {
                return (
                    <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href={`${BASE}/${row._id}/edit`}>
                                <Edit className="h-4 w-4" />
                            </Link>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPendingDelete(row)}
                        >
                            <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                        </Button>
                    </div>
                );
            },
        },
    ], []);

    return (
        <>
            <EntityListShell
                title="Payroll runs"
                subtitle="One run per pay period — generate, finalize, and archive."
                primaryAction={
                    <Button asChild>
                        <Link href={`${BASE}/new`}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> New payroll run
                        </Link>
                    </Button>
                }
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search by period…',
                }}
                filters={
                    <>
                        <EnumFilterField
                            enumName="payrollRunStatus"
                            value={statusFilter}
                            onChange={(v) =>
                                setStatusFilter(v as CrmPayrollRunStatus | 'all')
                            }
                            placeholder="All statuses"
                        />
                        <Select
                            value={yearFilter}
                            onValueChange={setYearFilter}
                        >
                            <ZoruSelectTrigger className="h-9 w-[140px]">
                                <ZoruSelectValue placeholder="Year" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All years</ZoruSelectItem>
                                {yearOptions.map((y) => (
                                    <ZoruSelectItem key={y} value={String(y)}>
                                        {y}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </>
                }
                loading={isLoading && bulky.data.length === 0}
            >
                {chartData.length > 0 && (
                    <div className="mb-6 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
                        <h3 className="mb-4 text-sm font-medium text-[var(--st-text)]">Payroll Expenses Overview</h3>
                        <div className="h-64 w-full text-xs">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--zoru-line))" />
                                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--zoru-ink-subtle))' }} axisLine={{ stroke: 'hsl(var(--zoru-line))' }} tickLine={false} />
                                    <YAxis tickFormatter={(val) => `₹${(val / 1000)}k`} tick={{ fill: 'hsl(var(--zoru-ink-subtle))' }} axisLine={false} tickLine={false} />
                                    <Tooltip 
                                        formatter={(value: number) => inr.format(value)}
                                        contentStyle={{ backgroundColor: 'hsl(var(--zoru-surface))', borderColor: 'hsl(var(--zoru-line))', borderRadius: '6px' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                    <Bar dataKey="Gross" fill="#18181b" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Net" fill="#71717a" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Deductions" fill="#d4d4d8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                <div className="overflow-hidden rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                    <CrmBulkyGrid<CrmPayrollRunDoc>
                        columns={columns}
                        data={filtered}
                        selectedIds={bulky.selected}
                        onSelectOne={bulky.toggleSelectOne}
                        onSelectAll={(checked) =>
                            bulky.toggleSelectAll(
                                filtered.map((d) => String(d._id)),
                                checked
                            )
                        }
                        density="comfortable"
                        inlineEditRowId={bulky.inlineEditRowId}
                        editBuffer={bulky.editBuffer}
                        onStartInlineEdit={bulky.startInlineEdit}
                        onCancelInlineEdit={bulky.cancelInlineEdit}
                        onSaveInlineEdit={handleSaveInlineEdit}
                        onUpdateEditBuffer={bulky.updateEditBuffer}
                        isLoading={isLoading}
                    />
                </div>
            </EntityListShell>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete payroll run?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting the {pendingDelete ? periodLabel(pendingDelete) : ''}{' '}
                            run removes its metadata. Generated payslips remain in the
                            payslips collection.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
