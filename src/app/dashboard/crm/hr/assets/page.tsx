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
  Plus,
  Trash2 } from 'lucide-react';

/**
 * HR Assets — list page.
 *
 * Operational IT/office asset register (laptops, phones, monitors). For
 * the accounting view of capital assets, see /dashboard/crm/accounting/fixed-assets.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { deleteAsset, getAssets } from '@/app/actions/crm-assets.actions';
import type {
    CrmAssetCategory,
    CrmAssetDoc,
    CrmAssetStatus,
} from '@/lib/rust-client/crm-assets';

const BASE = '/dashboard/crm/hr/assets';

const STATUS_OPTIONS: Array<{ value: CrmAssetStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'available', label: 'Available' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'in_repair', label: 'In repair' },
    { value: 'retired', label: 'Retired' },
    { value: 'archived', label: 'Archived' },
];

const CATEGORY_OPTIONS: Array<{ value: CrmAssetCategory | 'all'; label: string }> = [
    { value: 'all', label: 'All categories' },
    { value: 'laptop', label: 'Laptop' },
    { value: 'phone', label: 'Phone' },
    { value: 'monitor', label: 'Monitor' },
    { value: 'badge', label: 'Badge' },
    { value: 'keys', label: 'Keys' },
    { value: 'vehicle', label: 'Vehicle' },
    { value: 'other', label: 'Other' },
];

const STATUS_TONE: Record<CrmAssetStatus, StatusTone> = {
    available: 'green',
    assigned: 'blue',
    in_repair: 'amber',
    retired: 'neutral',
    archived: 'neutral',
};

function statusLabel(s: string): string {
    return s.replace(/_/g, ' ');
}

export default function AssetsListPage() {
    const [assets, setAssets] = React.useState<CrmAssetDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmAssetStatus | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = React.useState<CrmAssetCategory | 'all'>('all');
    const [pendingDelete, setPendingDelete] = React.useState<CrmAssetDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getAssets({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                category: categoryFilter === 'all' ? undefined : categoryFilter,
                limit: 100,
            });
            setAssets(res.items ?? []);
        } catch {
            setAssets([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter, categoryFilter]);

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
            const result = await deleteAsset(id);
            if (result.success) {
                toast({ title: 'Asset deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete asset.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Assets"
                    subtitle="Operational IT and office asset register."
                    primaryAction={
                        <ZoruButton asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New asset
                            </Link>
                        </ZoruButton>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search assets…',
                    }}
                    filters={
                        <>
                            <ZoruSelect
                                value={statusFilter}
                                onValueChange={(v) =>
                                    setStatusFilter(v as CrmAssetStatus | 'all')
                                }
                            >
                                <ZoruSelectTrigger className="h-9 w-[180px]">
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
                                value={categoryFilter}
                                onValueChange={(v) =>
                                    setCategoryFilter(v as CrmAssetCategory | 'all')
                                }
                            >
                                <ZoruSelectTrigger className="h-9 w-[180px]">
                                    <ZoruSelectValue placeholder="Category" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {CATEGORY_OPTIONS.map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </>
                    }
                    loading={isLoading && assets.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Tag</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Assignee</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Condition</ZoruTableHead>
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
                                ) : assets.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={7}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No assets match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    assets.map((a) => {
                                        const status = (a.status ?? 'available') as CrmAssetStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <ZoruTableRow key={a._id} className="border-zoru-line">
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    <EntityRowLink
                                                        href={`${BASE}/${a._id}`}
                                                        label={a.assetTag}
                                                        subtitle={a.name}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    {a.name}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="capitalize text-zoru-ink">
                                                    {a.category ?? '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {a.currentAssigneeName ?? a.currentAssigneeId ?? '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="capitalize text-zoru-ink">
                                                    {a.condition ?? '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={statusLabel(status)} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <ZoruButton variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${a._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(a)}
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
                        <ZoruAlertDialogTitle>Delete asset?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will remove it from
                            the active register. Assignment history remains in audit.
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
