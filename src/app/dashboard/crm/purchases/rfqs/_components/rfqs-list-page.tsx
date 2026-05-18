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
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  ClipboardList,
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

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
    const { toast } = useZoruToast();

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
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    breadcrumbs={[
                        { label: 'CRM', href: '/dashboard/crm' },
                        { label: 'Purchases', href: '/dashboard/crm/purchases' },
                        { label: 'RFQs' },
                    ]}
                    title="Request for Quotations"
                    subtitle="Issue RFQs and collect vendor bids."
                    icon={ClipboardList}
                    actions={
                        <ZoruButton asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New RFQ
                            </Link>
                        </ZoruButton>
                    }
                />

                <EntityListShell
                    title=""
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
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Items</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Vendors</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Deadline</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={6} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : rfqs.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={6}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No RFQs match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    rfqs.map((r) => {
                                        const status = (r.status ?? 'draft') as CrmRfqStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <ZoruTableRow key={r._id} className="border-zoru-line">
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    <Link
                                                        href={`${BASE}/${r._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {r.title || 'Untitled'}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {Array.isArray(r.items) ? r.items.length : 0}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {Array.isArray(r.vendorsInvited)
                                                        ? r.vendorsInvited.length
                                                        : 0}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtDate(r.deadline)}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={status} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <ZoruButton variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${r._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(r)}
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
                        <ZoruAlertDialogTitle>Delete RFQ?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.title}&rdquo; will hide it from
                            the active list.
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
