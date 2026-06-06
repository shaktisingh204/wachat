'use client';

import { Button, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Factory,
  Layers,
  Plus } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

/**
 * <BomListClient> — orchestrates the §1D BOM list page.
 *
 * Composition:
 *   • KPI strip (4 cards)
 *   • Filters row (5 controls) + free-text search
 *   • Bulk action bar (archive · delete · export · activate · deactivate)
 *   • <BomTable /> with 10 cols + per-row dropdown
 */

import * as React from 'react';
import Link from 'next/link';

import {
    bulkBomAction,
    deleteBom,
    duplicateBom,
    setBomStatus,
} from '@/app/actions/crm-bom.actions';
import type { CrmBomDoc, CrmBomKpis } from '@/app/actions/crm-bom.actions.types';

import { BomKpiStrip } from './bom-kpi-strip';
import { BomFiltersRow, BomBulkBar, type BomStatusFilter } from './bom-filters';
import { BomTable } from './bom-table';
import { useBomWebsocket } from './use-bom-websocket';

export interface BomListClientProps {
    initialBoms: (CrmBomDoc & { _id: string })[];
    initialKpis: CrmBomKpis;
}

function toCsv(rows: (CrmBomDoc & { _id: string })[]): string {
    const head = [
        'bomNo',
        'finishedGood',
        'version',
        'outputQty',
        'unit',
        'componentsCount',
        'totalCost',
        'effectiveDate',
        'status',
        'createdAt',
    ];
    const lines = rows.map((r) =>
        [
            r.bomNo,
            r.finishedGoodName,
            r.version,
            r.outputQty,
            r.unit,
            Array.isArray(r.components) ? r.components.length : 0,
            r.totalCost ?? '',
            r.effectiveDate,
            r.status,
            r.createdAt,
        ]
            .map((cell) => {
                const v = String(cell ?? '');
                return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
            })
            .join(','),
    );
    return [head.join(','), ...lines].join('\n');
}

export function BomListClient({ initialBoms, initialKpis }: BomListClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { toast } = useToast();

    const { boms } = useBomWebsocket(initialBoms);
    const [kpis] = React.useState(initialKpis);

    /* Filters */
    const [search, setSearch] = React.useState('');
    const [status, setStatusRaw] = React.useState<BomStatusFilter>((searchParams.get('tab') as BomStatusFilter) || 'all');
    
    const setStatus = React.useCallback((newStatus: BomStatusFilter) => {
        setStatusRaw(newStatus);
        const params = new URLSearchParams(searchParams.toString());
        if (newStatus === 'all') params.delete('tab');
        else params.set('tab', newStatus);
        router.push(`${pathname}?${params.toString()}`);
    }, [pathname, router, searchParams]);
    const [finishedGoodId, setFinishedGoodId] = React.useState('');
    const [versionMin, setVersionMin] = React.useState('');
    const [versionMax, setVersionMax] = React.useState('');
    const [effectiveFrom, setEffectiveFrom] = React.useState('');
    const [effectiveTo, setEffectiveTo] = React.useState('');
    const [activeOnly, setActiveOnly] = React.useState(false);

    /* Selection */
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    /* Dialogs */
    const [archiveTargetId, setArchiveTargetId] = React.useState<string | null>(null);
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [bulkOp, setBulkOp] = React.useState<
        null | 'archive' | 'delete' | 'activate' | 'deactivate'
    >(null);

    const hasActiveFilters =
        Boolean(search) ||
        status !== 'all' ||
        Boolean(finishedGoodId) ||
        Boolean(versionMin) ||
        Boolean(versionMax) ||
        Boolean(effectiveFrom) ||
        Boolean(effectiveTo) ||
        activeOnly;

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        const verCmp = (a: string, b: string) => {
            const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
            const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
            const len = Math.max(pa.length, pb.length);
            for (let i = 0; i < len; i++) {
                const da = pa[i] ?? 0;
                const db_ = pb[i] ?? 0;
                if (da !== db_) return da - db_;
            }
            return 0;
        };
        const fromTs = effectiveFrom ? new Date(effectiveFrom).getTime() : null;
        const toTs = effectiveTo ? new Date(effectiveTo).getTime() : null;
        return boms.filter((b) => {
            if (q) {
                const hay = `${b.bomNo ?? ''} ${b.finishedGoodName ?? ''} ${b.version ?? ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (status !== 'all') {
                if ((b.status ?? '').toLowerCase() !== status) return false;
            }
            if (finishedGoodId) {
                const fgKey =
                    typeof b.finishedGoodId === 'string'
                        ? b.finishedGoodId
                        : (b.finishedGoodId as { toString?: () => string })?.toString?.();
                if (fgKey !== finishedGoodId) return false;
            }
            if (versionMin && verCmp(String(b.version ?? ''), versionMin) < 0) return false;
            if (versionMax && verCmp(String(b.version ?? ''), versionMax) > 0) return false;
            if (fromTs && b.effectiveDate) {
                const t = new Date(b.effectiveDate as string).getTime();
                if (!Number.isNaN(t) && t < fromTs) return false;
            }
            if (toTs && b.effectiveDate) {
                const t = new Date(b.effectiveDate as string).getTime();
                if (!Number.isNaN(t) && t > toTs) return false;
            }
            if (activeOnly && !(b.active === true || b.status === 'active')) {
                return false;
            }
            return true;
        });
    }, [
        boms,
        search,
        status,
        finishedGoodId,
        versionMin,
        versionMax,
        effectiveFrom,
        effectiveTo,
        activeOnly,
    ]);

    /* Row actions */
    const toggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleAll = React.useCallback(
        (all: boolean) => {
            setSelected(all ? new Set(filtered.map((b) => String(b._id))) : new Set());
        },
        [filtered],
    );

    const clearFilters = React.useCallback(() => {
        setSearch('');
        setStatus('all');
        setFinishedGoodId('');
        setVersionMin('');
        setVersionMax('');
        setEffectiveFrom('');
        setEffectiveTo('');
        setActiveOnly(false);
    }, []);

    const exportCsv = React.useCallback(() => {
        const rows =
            selected.size > 0
                ? boms.filter((b) => selected.has(String(b._id)))
                : filtered;
        if (rows.length === 0) {
            toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
            return;
        }
        const csv = toCsv(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `boms-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: 'Exported', description: `${rows.length} BOMs saved to CSV.` });
    }, [boms, filtered, selected, toast]);

    const handleArchiveConfirm = React.useCallback(async () => {
        if (!archiveTargetId) return;
        const res = await setBomStatus(archiveTargetId, 'archived');
        if (res.success) {
            toast({ title: 'BOM archived' });
            router.refresh();
        } else {
            toast({
                title: 'Archive failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setArchiveTargetId(null);
    }, [archiveTargetId, router, toast]);

    const handleDeleteConfirm = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteBom(deleteTargetId);
        if (res.success) {
            toast({ title: 'BOM deleted' });
            router.refresh();
        } else {
            toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setDeleteTargetId(null);
    }, [deleteTargetId, router, toast]);

    const handleDuplicate = React.useCallback(
        async (id: string) => {
            const res = await duplicateBom(id);
            if (res.success && res.id) {
                toast({ title: 'BOM duplicated' });
                router.push(`/dashboard/crm/inventory/bom/${res.id}/edit`);
            } else {
                toast({
                    title: 'Duplicate failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [router, toast],
    );

    const handleToggleStatus = React.useCallback(
        async (id: string, makeActive: boolean) => {
            const res = await setBomStatus(id, makeActive ? 'active' : 'inactive');
            if (res.success) {
                toast({ title: makeActive ? 'BOM activated' : 'BOM deactivated' });
                router.refresh();
            } else {
                toast({
                    title: 'Status update failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [router, toast],
    );

    const runBulkConfirm = React.useCallback(async () => {
        if (!bulkOp || selected.size === 0) return;
        const ids = Array.from(selected);
        const res = await bulkBomAction(ids, bulkOp);
        if (res.success) {
            toast({ title: `${res.processed} BOMs updated` });
            setSelected(new Set());
            router.refresh();
        } else {
            toast({
                title: 'Bulk action failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setBulkOp(null);
    }, [bulkOp, router, selected, toast]);

    return (
        <>
            <EntityListShell
                title="Bill of Materials"
                subtitle="Recipes mapping finished goods to their component inputs and costs."
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search BOM code, finished good, version…',
                }}
                primaryAction={
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/dashboard/crm/inventory/production-orders">
                                <Factory className="h-4 w-4" /> Production orders
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href="/dashboard/crm/inventory/bom/new">
                                <Plus className="h-4 w-4" /> New BOM
                            </Link>
                        </Button>
                    </div>
                }
                filters={
                    <BomFiltersRow
                        status={status}
                        onStatusChange={setStatus}
                        finishedGoodId={finishedGoodId}
                        onFinishedGoodChange={setFinishedGoodId}
                        versionMin={versionMin}
                        versionMax={versionMax}
                        onVersionMinChange={setVersionMin}
                        onVersionMaxChange={setVersionMax}
                        effectiveFrom={effectiveFrom}
                        effectiveTo={effectiveTo}
                        onEffectiveFromChange={setEffectiveFrom}
                        onEffectiveToChange={setEffectiveTo}
                        activeOnly={activeOnly}
                        onActiveOnlyChange={setActiveOnly}
                        hasActiveFilters={hasActiveFilters}
                        onClear={clearFilters}
                    />
                }
                bulkBar={
                    selected.size > 0 ? (
                        <BomBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onArchive={() => setBulkOp('archive')}
                            onDelete={() => setBulkOp('delete')}
                            onActivate={() => setBulkOp('activate')}
                            onDeactivate={() => setBulkOp('deactivate')}
                            onExport={exportCsv}
                        />
                    ) : null
                }
                empty={
                    filtered.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Layers className="h-8 w-8 text-[var(--st-text-secondary)]" />
                            <h3 className="text-base font-medium text-[var(--st-text)]">No BOMs yet</h3>
                            <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                                Define a Bill of Materials to start manufacturing planned outputs from
                                raw components.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/inventory/bom/new">
                                    <Plus className="h-4 w-4" /> Create your first BOM
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    <BomKpiStrip
                        kpis={kpis}
                        activeFilter={
                            status === 'active' ? 'active' : status === 'archived' ? 'archived' : 'all'
                        }
                        onPickActive={() => setStatus(status === 'active' ? 'all' : 'active')}
                        onClear={clearFilters}
                    />
                    <BomTable
                        boms={filtered}
                        loading={false}
                        selectedIds={selected}
                        onToggleOne={toggleOne}
                        onToggleAll={toggleAll}
                        onArchive={(id) => setArchiveTargetId(id)}
                        onDelete={(id) => setDeleteTargetId(id)}
                        onDuplicate={handleDuplicate}
                        onToggleStatus={handleToggleStatus}
                    />
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!archiveTargetId}
                onOpenChange={(o) => !o && setArchiveTargetId(null)}
                title="Archive this BOM?"
                description="Archived BOMs are hidden from default views. You can restore later."
                confirmLabel="Archive"
                confirmTone="primary"
                onConfirm={handleArchiveConfirm}
            />
            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this BOM permanently?"
                description="This permanently removes the BOM. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleDeleteConfirm}
            />
            <ConfirmDialog
                open={!!bulkOp}
                onOpenChange={(o) => !o && setBulkOp(null)}
                title={
                    bulkOp === 'delete'
                        ? `Delete ${selected.size} BOM${selected.size === 1 ? '' : 's'}?`
                        : bulkOp === 'archive'
                          ? `Archive ${selected.size} BOM${selected.size === 1 ? '' : 's'}?`
                          : `Update ${selected.size} BOM${selected.size === 1 ? '' : 's'}?`
                }
                description={
                    bulkOp === 'delete'
                        ? 'This permanently removes the selected BOMs. This action cannot be undone.'
                        : bulkOp === 'archive'
                          ? 'Archived BOMs are hidden from default views. You can restore later.'
                          : 'The selected BOMs will be updated.'
                }
                requireTyped={bulkOp === 'delete' ? 'DELETE' : undefined}
                confirmLabel={
                    bulkOp === 'delete'
                        ? 'Delete'
                        : bulkOp === 'archive'
                          ? 'Archive'
                          : bulkOp === 'activate'
                            ? 'Activate'
                            : 'Deactivate'
                }
                confirmTone={bulkOp === 'delete' ? 'danger' : 'primary'}
                onConfirm={runBulkConfirm}
            />
        </>
    );
}

export default BomListClient;
