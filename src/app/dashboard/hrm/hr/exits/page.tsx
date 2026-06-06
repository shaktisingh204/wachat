'use client';
import { fmtDate } from '@/lib/utils';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
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
    const { toast } = useToast();

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
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Employee</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Type</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Last day</Th>
                                    <Th className="text-[var(--st-text-secondary)]">F&F</Th>
                                    <Th className="text-[var(--st-text-secondary)]">NOC</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Status</Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td colSpan={7} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </Td>
                                    </Tr>
                                ) : exits.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={7}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No exits match this filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    exits.map((e) => {
                                        const status = (e.status ?? 'open') as CrmExitStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <Tr key={e._id} className="border-[var(--st-border)]">
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${e._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {e.employeeName || e.employeeId || '—'}
                                                    </Link>
                                                </Td>
                                                <Td className="capitalize text-[var(--st-text)]">
                                                    {pretty(String(e.type ?? '—'))}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(e.lastDay)}
                                                </Td>
                                                <Td className="capitalize text-[var(--st-text)]">
                                                    {pretty(String(e.fnfStatus ?? '—'))}
                                                </Td>
                                                <Td className="capitalize text-[var(--st-text)]">
                                                    {pretty(String(e.nocStatus ?? '—'))}
                                                </Td>
                                                <Td>
                                                    <StatusPill label={status} tone={tone} />
                                                </Td>
                                                <Td className="text-right">
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
                        <AlertDialogTitle>Delete exit?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will hide the exit from the active list. Audit history
                            is preserved.
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
