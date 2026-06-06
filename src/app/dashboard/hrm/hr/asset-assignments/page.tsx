'use client';
import { fmtDate } from '@/lib/utils';


import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * HR Asset Assignments — list page.
 *
 * Tracks the active and historic mapping between assets and employees.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deleteAssetAssignment,
    getAssetAssignments,
} from '@/app/actions/crm-asset-assignments.actions';
import type { CrmAssetAssignmentDoc } from '@/app/actions/crm-asset-assignments.actions.types';
import type { CrmAssetAssignmentStatus } from '@/app/actions/crm-asset-assignments.actions.types';
const BASE = '/dashboard/hrm/hr/asset-assignments';

// §1E.sweep: assetAssignmentStatus Select kept — filter uses 'assigned' slug but enum uses 'active'; resolve Rust DTO first.
const STATUS_OPTIONS: Array<{ value: CrmAssetAssignmentStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'returned', label: 'Returned' },
    { value: 'lost', label: 'Lost' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<CrmAssetAssignmentStatus, StatusTone> = {
    assigned: 'blue',
    returned: 'green',
    lost: 'red',
    damaged: 'red',
    archived: 'neutral',
};



export default function AssetAssignmentsListPage() {
    const [rows, setRows] = React.useState<CrmAssetAssignmentDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmAssetAssignmentStatus | 'all'>('all');
    const [pendingDelete, setPendingDelete] = React.useState<CrmAssetAssignmentDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const items = await getAssetAssignments({
                q: search.trim() || undefined,
                status: statusFilter,
            });
            setRows(items);
        } catch {
            setRows([]);
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
            const result = await deleteAssetAssignment(id);
            if (result.success) {
                toast({ title: 'Assignment deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Asset assignments"
                    subtitle="Issue / return events between assets and employees."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New assignment
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search by asset or employee…',
                    }}
                    filters={
                        <Select
                            value={statusFilter}
                            onValueChange={(v) =>
                                setStatusFilter(v as CrmAssetAssignmentStatus | 'all')
                            }
                        >
                            <SelectTrigger className="h-9 w-[180px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    }
                    loading={isLoading && rows.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Asset</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Employee</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Assigned</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Returned</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Status</Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td colSpan={6} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </Td>
                                    </Tr>
                                ) : rows.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={6}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No assignments match this filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    rows.map((r) => {
                                        const status = (r.status ?? 'assigned') as CrmAssetAssignmentStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <Tr key={r._id} className="border-[var(--st-border)]">
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${r._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {r.asset_name || r.asset_id}
                                                    </Link>
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {r.employee_name || r.employee_id}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(r.assigned_at)}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(r.returned_at)}
                                                </Td>
                                                <Td>
                                                    <StatusPill label={status} tone={tone} />
                                                </Td>
                                                <Td className="text-right">
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
                        <AlertDialogTitle>Delete assignment?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the assignment record. The audit entry remains.
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
