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
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  Clock,
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * Weekly Timesheets — list page.
 *
 * Reads from the new `getCrmTimesheets` server action (Mongo-backed,
 * `crm_timesheets` collection — distinct from `crm_time_logs`).
 *
 * Settings-style list with search + status filter + employee filter
 * and a 7-day-grid summary row per timesheet.
 */

import * as React from 'react';
import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { EnumFilterField } from '@/components/crm/enum-filter-field';

import {
    deleteCrmTimesheet,
    getCrmTimesheets,
    type CrmTimesheetDoc,
    type CrmTimesheetStatus,
} from '@/app/actions/crm-timesheets.actions';

const BASE = '/dashboard/hrm/hr/timesheets';

const STATUS_TONE: Record<CrmTimesheetStatus, StatusTone> = {
    draft: 'neutral',
    submitted: 'amber',
    approved: 'green',
    rejected: 'red',
    archived: 'neutral',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function TimesheetsListPage(): React.JSX.Element {
    const [timesheets, setTimesheets] = React.useState<CrmTimesheetDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmTimesheetStatus | 'all'>(
        'all',
    );
    const [pendingDelete, setPendingDelete] = React.useState<CrmTimesheetDoc | null>(
        null,
    );
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getCrmTimesheets({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                limit: 100,
            });
            setTimesheets(res ?? []);
        } catch {
            setTimesheets([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter]);

    React.useEffect(() => {
        const t = window.setTimeout(() => {
            void refresh();
        }, 250);
        return () => window.clearTimeout(t);
    }, [refresh]);

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const result = await deleteCrmTimesheet(id);
            if (result.success) {
                toast({ title: 'Timesheet deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete timesheet.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    breadcrumbs={[
                        { label: 'HR', href: '/dashboard/hrm/hr' },
                        { label: 'Timesheets' },
                    ]}
                    title="Weekly Timesheets"
                    subtitle="Weekly time records per employee with submit / approve workflow."
                    icon={Clock}
                    actions={
                        <ZoruButton asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New timesheet
                            </Link>
                        </ZoruButton>
                    }
                />

                <EntityListShell
                    title=""
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search by employee, notes…',
                    }}
                    filters={
                        <EnumFilterField
                            enumName="timesheetStatus"
                            value={statusFilter}
                            onChange={(v) => setStatusFilter(v as CrmTimesheetStatus | 'all')}
                            allLabel="All statuses"
                        />
                    }
                    loading={isLoading && timesheets.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Week</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Total Hrs</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={5} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : timesheets.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={5}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No timesheets match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    timesheets.map((t) => {
                                        const tone = STATUS_TONE[t.status] ?? 'neutral';
                                        return (
                                            <ZoruTableRow key={t._id} className="border-zoru-line">
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    <Link
                                                        href={`${BASE}/${t._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {t.employeeName || t.employeeId}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtDate(t.weekStartDate)} → {fmtDate(t.weekEndDate)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    {t.totalHours.toFixed(2)}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={t.status} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <ZoruButton variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${t._id}`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(t)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
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
            </div>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete timesheet?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting this timesheet for &ldquo;
                            {pendingDelete?.employeeName || pendingDelete?.employeeId}&rdquo; cannot
                            be undone.
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
