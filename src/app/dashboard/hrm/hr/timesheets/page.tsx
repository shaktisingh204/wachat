'use client';
import { fmtDate } from '@/lib/utils';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
import {
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
    const { toast } = useToast();

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
            <EntityListShell
                    title="Weekly Timesheets"
                    subtitle="Weekly time records per employee with submit / approve workflow."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New timesheet
                            </Link>
                        </Button>
                    }
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
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Employee</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Week</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Total Hrs</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Status</Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td colSpan={5} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </Td>
                                    </Tr>
                                ) : timesheets.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={5}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No timesheets match this filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    timesheets.map((t) => {
                                        const tone = STATUS_TONE[t.status] ?? 'neutral';
                                        return (
                                            <Tr key={t._id} className="border-[var(--st-border)]">
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${t._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {t.employeeName || t.employeeId}
                                                    </Link>
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(t.weekStartDate)} → {fmtDate(t.weekEndDate)}
                                                </Td>
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {t.totalHours.toFixed(2)}
                                                </Td>
                                                <Td>
                                                    <StatusPill label={t.status} tone={tone} />
                                                </Td>
                                                <Td className="text-right">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${t._id}`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(t)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                                    </Button>
                                                </Td>
                                            </Tr>
                                        );
                                    })
                                )}
                            </TBody>
                        </Table>
                    </div>
            </EntityListShell>

            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete timesheet?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting this timesheet for &ldquo;
                            {pendingDelete?.employeeName || pendingDelete?.employeeId}&rdquo; cannot
                            be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
