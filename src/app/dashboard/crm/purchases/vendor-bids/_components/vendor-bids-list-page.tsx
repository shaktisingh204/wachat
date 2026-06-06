'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * Vendor Bids — list page (client).
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

import {
    deleteVendorBid,
    getVendorBids,
} from '@/app/actions/crm-vendor-bids-v2.actions';
import type {
    CrmVendorBidDoc,
    CrmVendorBidStatus,
} from '@/lib/rust-client/crm-vendor-bids';

const BASE = '/dashboard/crm/purchases/vendor-bids';


const STATUS_TONE: Record<CrmVendorBidStatus, StatusTone> = {
    submitted: 'blue',
    shortlisted: 'amber',
    awarded: 'green',
    rejected: 'red',
    withdrawn: 'neutral',
};

function fmtMoney(amount: number | undefined, currency: string | undefined): string {
    if (amount == null || !Number.isFinite(amount)) return '—';
    return `${currency ?? ''} ${amount.toFixed(2)}`.trim();
}

export function VendorBidsListPage() {
    const [bids, setBids] = React.useState<CrmVendorBidDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmVendorBidStatus | 'all'>(
        'all',
    );
    const [pendingDelete, setPendingDelete] = React.useState<CrmVendorBidDoc | null>(
        null,
    );
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getVendorBids({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                limit: 100,
            });
            setBids(res.items ?? []);
        } catch {
            setBids([]);
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
            const result = await deleteVendorBid(id);
            if (result.success) {
                toast({ title: 'Vendor bid deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete bid.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Vendor Bids"
                    subtitle="Bids submitted by vendors in response to RFQs."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New bid
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search vendor bids…',
                    }}
                    filters={
                        <EnumFilterField
                            enumName="vendorBidStatus"
                            value={statusFilter}
                            onChange={(v) => setStatusFilter(v as CrmVendorBidStatus | 'all')}
                            allLabel="All statuses"
                        />
                    }
                    loading={isLoading && bids.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Vendor</Th>
                                    <Th className="text-[var(--st-text-secondary)]">RFQ id</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Items</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Amount</Th>
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
                                ) : bids.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={6}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No vendor bids match this filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    bids.map((b) => {
                                        const status = (b.status ?? 'submitted') as CrmVendorBidStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <Tr key={b._id} className="border-[var(--st-border)]">
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${b._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {b.vendorName ?? b.vendorId}
                                                    </Link>
                                                </Td>
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {b.rfqId}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {Array.isArray(b.items) ? b.items.length : 0}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtMoney(b.totals?.total, b.currency)}
                                                </Td>
                                                <Td>
                                                    <StatusPill label={status} tone={tone} />
                                                </Td>
                                                <Td className="text-right">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${b._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(b)}
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
                        <AlertDialogTitle>Delete vendor bid?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting this bid will hide it from the active list.
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
