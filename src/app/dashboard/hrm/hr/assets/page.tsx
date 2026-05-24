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
  UserPlus,
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
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { EnumFilterField } from '@/components/crm/enum-filter-field';

import { deleteAsset, getAssets } from '@/app/actions/crm-assets.actions';
import type {
    CrmAssetCategory,
    CrmAssetDoc,
    CrmAssetStatus,
} from '@/lib/rust-client/crm-assets';
import { QuickAssignDialog } from './_components/quick-assign-dialog';

const BASE = '/dashboard/hrm/hr/assets';

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
    const [quickAssign, setQuickAssign] = React.useState<CrmAssetDoc | null>(null);
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
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New asset
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search assets…',
                    }}
                    filters={
                        <>
                            <EnumFilterField
                                enumName="assetStatus"
                                value={statusFilter}
                                onChange={(v) => setStatusFilter(v as CrmAssetStatus | 'all')}
                                allLabel="All statuses"
                            />
                            <EnumFilterField
                                enumName="assetCategory"
                                value={categoryFilter}
                                onChange={(v) => setCategoryFilter(v as CrmAssetCategory | 'all')}
                                allLabel="All categories"
                            />
                        </>
                    }
                    loading={isLoading && assets.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <Table>
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
                                                    <Link
                                                        href={`${BASE}/${a._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {a.assetTag}
                                                    </Link>
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
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${a._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => setQuickAssign(a)} title="Quick Assign">
                                                        <UserPlus className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(a)}
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

            <QuickAssignDialog
                asset={quickAssign}
                open={!!quickAssign}
                onOpenChange={(open) => !open && setQuickAssign(null)}
                onSuccess={refresh}
            />
        </>
    );
}
