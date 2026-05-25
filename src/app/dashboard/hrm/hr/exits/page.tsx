import { fmtDate } from '@/lib/utils';
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
  Table,
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

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { EnumFilterField } from '@/components/crm/enum-filter-field';

import { deleteExit, getExits } from '@/app/actions/crm-exits.actions';
import type {
    CrmExitDoc,
    CrmExitStatus,
    CrmExitType,
} from '@/lib/rust-client/crm-exits';

const BASE = '/dashboard/hrm/hr/exits';

const STATUS_TONE: Record<CrmExitStatus, StatusTone> = {
    open: 'amber',
    complete: 'green',
    cancelled: 'red',
    archived: 'neutral',
};

function pretty(s: string): string {
    return s.replace(/_/g, ' ');
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
            <EntityListShell
                    title="Exits"
                    subtitle="Offboarding, resignations, F&F clearance and exit interviews."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New exit
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search by employee…',
                    }}
                    filters={
                        <>
                            <EnumFilterField
                                enumName="exitStatus"
                                value={statusFilter}
                                onChange={(v) => setStatusFilter(v as CrmExitStatus | 'all')}
                                allLabel="All statuses"
                            />
                            <EnumFilterField
                                enumName="exitType"
                                value={typeFilter}
                                onChange={(v) => setTypeFilter(v as CrmExitType | 'all')}
                                allLabel="All types"
                            />
                        </>
                    }
                    loading={isLoading && exits.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <Table>
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
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${e._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(e)}
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
