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
 * Payouts — list page (client).
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

import {
    deletePayout,
    getPayouts,
} from '@/app/actions/crm-payouts-v2.actions';
import type {
    CrmPayoutDoc,
    CrmPayoutStatus,
} from '@/lib/rust-client/crm-payouts';

const BASE = '/dashboard/crm/purchases/payouts';

const STATUS_TONE: Record<CrmPayoutStatus, StatusTone> = {
    sent: 'blue',
    cleared: 'green',
    failed: 'red',
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

export function PayoutsListPage() {
    const [payouts, setPayouts] = React.useState<CrmPayoutDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmPayoutStatus | 'all'>(
        'all',
    );
    const [pendingDelete, setPendingDelete] = React.useState<CrmPayoutDoc | null>(
        null,
    );
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getPayouts({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                limit: 100,
            });
            setPayouts(res.items ?? []);
        } catch {
            setPayouts([]);
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
            const result = await deletePayout(id);
            if (result.success) {
                toast({ title: 'Payout deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete payout.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Payouts"
                    subtitle="Outgoing vendor payments — cash, cheque, UPI, NEFT, etc."
                    primaryAction={
                        <ZoruButton asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New payout
                            </Link>
                        </ZoruButton>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search payouts…',
                    }}
                    filters={
                        <EnumFilterField
                            enumName="payoutStatus"
                            value={statusFilter}
                            onChange={(v) =>
                                setStatusFilter(v as CrmPayoutStatus | 'all')
                            }
                            placeholder="All statuses"
                        />
                    }
                    loading={isLoading && payouts.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Payout no.</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Vendor</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Amount</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Method</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
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
                                ) : payouts.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={7}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No payouts match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    payouts.map((p) => {
                                        const status = (p.status ?? 'sent') as CrmPayoutStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <ZoruTableRow key={p._id} className="border-zoru-line">
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    <EntityRowLink
                                                        href={`${BASE}/${p._id}`}
                                                        label={<span className="font-mono">{p.paymentNo}</span>}
                                                        subtitle={p.vendorId || undefined}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    {p.vendorId}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtMoney(p.amount, p.currency)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="uppercase text-[12px] text-zoru-ink">
                                                    {p.mode}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtDate(p.date)}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={status} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <ZoruButton variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${p._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(p)}
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

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete payout?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting this payout will remove it from the active list.
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
