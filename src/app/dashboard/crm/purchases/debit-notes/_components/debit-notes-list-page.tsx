'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * Debit Notes — list page (client).
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

import {
    deleteDebitNote,
    getDebitNotes,
} from '@/app/actions/crm-debit-notes-v2.actions';
import type {
    CrmDebitNoteDoc,
    DebitNoteStatus,
} from '@/lib/rust-client/crm-debit-notes';

const BASE = '/dashboard/crm/purchases/debit-notes';


const STATUS_TONE: Record<DebitNoteStatus, StatusTone> = {
    draft: 'amber',
    issued: 'blue',
    refunded: 'green',
    cancelled: 'red',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(amount: number | undefined, currency: string | undefined): string {
    if (amount == null || !Number.isFinite(amount)) return '—';
    return `${currency ?? ''} ${amount.toFixed(2)}`.trim();
}

export function DebitNotesListPage() {
    const [notes, setNotes] = React.useState<CrmDebitNoteDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<DebitNoteStatus | 'all'>('all');
    const [pendingDelete, setPendingDelete] = React.useState<CrmDebitNoteDoc | null>(
        null,
    );
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getDebitNotes({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                limit: 100,
            });
            setNotes(res.items ?? []);
        } catch {
            setNotes([]);
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
            const result = await deleteDebitNote(id);
            if (result.success) {
                toast({ title: 'Debit note deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete note.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Debit Notes"
                    subtitle="Adjustments to vendor bills — returns, discounts, cancellations."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New debit note
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search debit notes…',
                    }}
                    filters={
                        <EnumFilterField
                            enumName="debitNoteStatusV2"
                            value={statusFilter}
                            onChange={(v) => setStatusFilter(v as DebitNoteStatus | 'all')}
                            allLabel="All statuses"
                        />
                    }
                    loading={isLoading && notes.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">DN no.</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Vendor</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Date</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Reason</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Total</Th>
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
                                ) : notes.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={7}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No debit notes match this filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    notes.map((n) => {
                                        const status = (n.status ?? 'draft') as DebitNoteStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <Tr key={n._id} className="border-[var(--st-border)]">
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${n._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {n.dnNo || n._id}
                                                    </Link>
                                                </Td>
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {n.vendorId}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(n.date)}
                                                </Td>
                                                <Td className="capitalize text-[var(--st-text)]">
                                                    {(n.reason ?? '').replace(/_/g, ' ')}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtMoney(n.totals?.total, n.currency)}
                                                </Td>
                                                <Td>
                                                    <StatusPill label={status} tone={tone} />
                                                </Td>
                                                <Td className="text-right">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${n._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(n)}
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
                        <AlertDialogTitle>Delete debit note?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting this note will remove it from the active list.
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
