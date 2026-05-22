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
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2,
  } from 'lucide-react';

/**
 * Payroll Runs — list page.
 *
 * Backend: `crm-payroll-runs.actions` (legacy Mongo on top of the
 * existing `generatePayrollData` / `processPayroll` / `getPayslips`
 * pipeline). One row per (period_month, period_year).
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deletePayrollRun,
    listPayrollRuns,
} from '@/app/actions/crm-payroll-runs.actions';
import type {
    CrmPayrollRunDoc,
    CrmPayrollRunStatus,
} from '@/app/actions/crm-payroll-runs.actions';

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

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function statusLabel(s: string): string {
    return s.replace(/_/g, ' ');
}

export default function PayrollRunsListPage() {
    const [rows, setRows] = React.useState<CrmPayrollRunDoc[]>([]);
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

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await listPayrollRuns({
                status: statusFilter === 'all' ? undefined : statusFilter,
                year: yearFilter === 'all' ? undefined : Number(yearFilter),
                limit: 200,
            });
            setRows(res);
        } catch {
            setRows([]);
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter, yearFilter]);

    React.useEffect(() => {
        const t = window.setTimeout(() => {
            void refresh();
        }, 250);
        return () => window.clearTimeout(t);
    }, [refresh]);

    const yearOptions = React.useMemo(() => {
        const ys = new Set<number>();
        for (const r of rows) if (r.period_year) ys.add(r.period_year);
        if (ys.size === 0) ys.add(new Date().getFullYear());
        return Array.from(ys).sort((a, b) => b - a);
    }, [rows]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) =>
            periodLabel(r).toLowerCase().includes(q) ||
            (r.notes ?? '').toLowerCase().includes(q),
        );
    }, [rows, search]);

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
                    loading={isLoading && rows.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Period</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Run date</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">Employees</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">Gross</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">Deductions</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">Net</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={8} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : filtered.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={8} className="h-24 text-center text-zoru-ink-muted">
                                            No payroll runs match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    filtered.map((r) => {
                                        const status = (r.status ?? 'draft') as CrmPayrollRunStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <ZoruTableRow key={r._id} className="border-zoru-line">
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    <Link href={`${BASE}/${r._id}`} className="hover:underline">
                                                        {periodLabel(r)}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtDate(r.run_date)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                                    {r.total_employees ?? 0}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                                    {inr.format(r.total_gross ?? 0)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                                    {inr.format(r.total_deductions ?? 0)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                                    {inr.format(r.total_net ?? 0)}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={statusLabel(status)} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${r._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(r)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })
                                )}
                            </ZoruTableBody>
                        </Table>
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
