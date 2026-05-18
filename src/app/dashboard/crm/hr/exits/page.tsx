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
  Edit,
  LoaderCircle,
  LogOut,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * HR Exits — list page.
 *
 * Settings-style list with search + status + type filters. Backed by
 * the Rust `crmExitsApi` via `getExits`.
 */

import * as React from 'react';
import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { deleteExit, getExits } from '@/app/actions/crm-exits.actions';
import type {
    CrmExitDoc,
    CrmExitStatus,
    CrmExitType,
} from '@/lib/rust-client/crm-exits';

const BASE = '/dashboard/crm/hr/exits';

const STATUS_OPTIONS: Array<{ value: CrmExitStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'open', label: 'Open' },
    { value: 'complete', label: 'Complete' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS: Array<{ value: CrmExitType | 'all'; label: string }> = [
    { value: 'all', label: 'All types' },
    { value: 'resignation', label: 'Resignation' },
    { value: 'termination', label: 'Termination' },
    { value: 'end_of_contract', label: 'End of contract' },
    { value: 'retirement', label: 'Retirement' },
    { value: 'other', label: 'Other' },
];

const STATUS_TONE: Record<CrmExitStatus, StatusTone> = {
    open: 'amber',
    complete: 'green',
    cancelled: 'red',
    archived: 'neutral',
};

function pretty(s: string): string {
    return s.replace(/_/g, ' ');
}

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function ExitsListPage() {
    const [exits, setExits] = React.useState<CrmExitDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmExitStatus | 'all'>(
        'all',
    );
    const [typeFilter, setTypeFilter] = React.useState<CrmExitType | 'all'>('all');
    const [pendingDelete, setPendingDelete] = React.useState<CrmExitDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getExits({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                type: typeFilter === 'all' ? undefined : typeFilter,
                limit: 100,
            });
            setExits(res.items ?? []);
        } catch {
            setExits([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter, typeFilter]);

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
            const result = await deleteExit(id);
            if (result.success) {
                toast({ title: 'Exit deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete exit.',
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
                        { label: 'HR', href: '/dashboard/crm/hr' },
                        { label: 'Exits' },
                    ]}
                    title="Exits"
                    subtitle="Offboarding, resignations, F&F clearance and exit interviews."
                    icon={LogOut}
                    actions={
                        <ZoruButton asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New exit
                            </Link>
                        </ZoruButton>
                    }
                />

                <EntityListShell
                    title=""
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search by employee…',
                    }}
                    filters={
                        <>
                            <ZoruSelect
                                value={statusFilter}
                                onValueChange={(v) =>
                                    setStatusFilter(v as CrmExitStatus | 'all')
                                }
                            >
                                <ZoruSelectTrigger className="h-9 w-[160px]">
                                    <ZoruSelectValue placeholder="Status" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {STATUS_OPTIONS.map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                            <ZoruSelect
                                value={typeFilter}
                                onValueChange={(v) =>
                                    setTypeFilter(v as CrmExitType | 'all')
                                }
                            >
                                <ZoruSelectTrigger className="h-9 w-[180px]">
                                    <ZoruSelectValue placeholder="Type" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {TYPE_OPTIONS.map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </>
                    }
                    loading={isLoading && exits.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Last day</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">F&F</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">NOC</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={7} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : exits.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={7}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No exits match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    exits.map((e) => {
                                        const status = (e.status ?? 'open') as CrmExitStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <ZoruTableRow key={e._id} className="border-zoru-line">
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    <Link
                                                        href={`${BASE}/${e._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {e.employeeName || e.employeeId || '—'}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="capitalize text-zoru-ink">
                                                    {pretty(String(e.type ?? '—'))}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtDate(e.lastDay)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="capitalize text-zoru-ink">
                                                    {pretty(String(e.fnfStatus ?? '—'))}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="capitalize text-zoru-ink">
                                                    {pretty(String(e.nocStatus ?? '—'))}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={status} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <ZoruButton variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${e._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(e)}
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
                        <ZoruAlertDialogTitle>Delete exit?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            This will hide the exit from the active list. Audit history
                            is preserved.
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
