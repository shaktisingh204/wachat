'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * RFQs — list page (client).
 *
 * Search + status filter, table + delete confirm. The "New RFQ" CTA
 * links to the dedicated `/new` page (the form is large enough that a
 * dialog would feel cramped).
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { deleteRfq, getRfqs } from '@/app/actions/crm-rfqs-v2.actions';
import type { CrmRfqDoc, CrmRfqStatus } from '@/lib/rust-client/crm-rfqs';

const BASE = '/dashboard/crm/purchases/rfqs';


const STATUS_TONE: Record<CrmRfqStatus, StatusTone> = {
    draft: 'amber',
    open: 'blue',
    closed: 'neutral',
    awarded: 'green',
    cancelled: 'red',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function RfqsListPage() {
    const [rfqs, setRfqs] = React.useState<CrmRfqDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmRfqStatus | 'all'>('all');
    const [pendingDelete, setPendingDelete] = React.useState<CrmRfqDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getRfqs({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                limit: 100,
            });
            setRfqs(res.items ?? []);
        } catch {
            setRfqs([]);
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
            const result = await deleteRfq(id);
            if (result.success) {
                toast({ title: 'RFQ deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete RFQ.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Request for Quotations"
                    subtitle="Issue RFQs and collect vendor bids."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New RFQ
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search RFQs…',
                    }}
                    filters={
                        <EnumFilterField
                            enumName="rfqStatus"
                            value={statusFilter}
                            onChange={(v) => setStatusFilter(v as CrmRfqStatus | 'all')}
                            allLabel="All statuses"
                        />
                    }
                    loading={isLoading && rfqs.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Title</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Items</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Vendors</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Deadline</Th>
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
                                ) : rfqs.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={6}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No RFQs match this filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    rfqs.map((r) => {
                                        const status = (r.status ?? 'draft') as CrmRfqStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <Tr key={r._id} className="border-[var(--st-border)]">
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${r._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {r.title || 'Untitled'}
                                                    </Link>
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {Array.isArray(r.items) ? r.items.length : 0}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {Array.isArray(r.vendorsInvited)
                                                        ? r.vendorsInvited.length
                                                        : 0}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(r.deadline)}
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
                        <AlertDialogTitle>Delete RFQ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.title}&rdquo; will hide it from
                            the active list.
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
