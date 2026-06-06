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
} from '@/components/sabcrm/20ui/compat';
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
    const { toast } = useZoruToast();

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
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Vendor</ZoruTableHead>
                                    <ZoruTableHead className="text-[var(--st-text-secondary)]">RFQ id</ZoruTableHead>
                                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Items</ZoruTableHead>
                                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Amount</ZoruTableHead>
                                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Status</ZoruTableHead>
                                    <ZoruTableHead className="text-[var(--st-text-secondary)] text-right">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-[var(--st-border)]">
                                        <ZoruTableCell colSpan={6} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : bids.length === 0 ? (
                                    <ZoruTableRow className="border-[var(--st-border)]">
                                        <ZoruTableCell
                                            colSpan={6}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No vendor bids match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    bids.map((b) => {
                                        const status = (b.status ?? 'submitted') as CrmVendorBidStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <ZoruTableRow key={b._id} className="border-[var(--st-border)]">
                                                <ZoruTableCell className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${b._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {b.vendorName ?? b.vendorId}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {b.rfqId}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-[var(--st-text)]">
                                                    {Array.isArray(b.items) ? b.items.length : 0}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-[var(--st-text)]">
                                                    {fmtMoney(b.totals?.total, b.currency)}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={status} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
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
                        <ZoruAlertDialogTitle>Delete vendor bid?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting this bid will hide it from the active list.
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
