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
  Card,
  Checkbox,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
} from '@/components/zoruui';
import {
  useRouter,
  useSearchParams,
  usePathname } from 'next/navigation';
import {
    AlertCircle,
  ArrowRightCircle,
  LoaderCircle,
  Pencil,
  Trash2,
  MoreVertical,
  Activity,
  Printer,
  } from 'lucide-react';

/**
 * §1D list client for GRNs — table + KPI strip + filter toolbar +
 * bulk-bar + active-filter chips + delete dialogs.
 *
 * 10 columns per §1D.1:
 *   select · GRN no · Vendor · PO ref · Date · Vehicle · Driver ·
 *   Status · Linked Bill · Actions
 *
 * Inventory-side equivalent of `<DeliveryListClient>`. Presentational
 * bits live in `./grn-list-bits.tsx`.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { deleteGrnAction } from '@/app/actions/crm/grns.actions';
import type { GrnKpis } from '@/app/actions/crm/grns.actions.types';
import type { CrmGrnDoc } from '@/lib/rust-client/crm-grns';
import {
    dateStamp,
    downloadXlsx,
    type ExportRow,
} from '@/lib/crm-list-export';
import { fmtDate } from '@/lib/utils';
import {
    GrnBulkBar,
    GrnFiltersBar,
    GrnKpiStrip,
    grnsToCsv,
    type GrnFilters,
    type GrnStatusKey,
} from './grn-list-bits';



export interface GrnListClientProps {
    grns: CrmGrnDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
    initialQuery: string;
    initialStatus: string;
    initialVendorId: string;
    initialWarehouseId: string;
    initialQcStatus: string;
    initialDateFrom: string;
    initialDateTo: string;
    kpis: GrnKpis;
    error?: string;
}

export function GrnListClient({
    grns,
    page,
    limit,
    hasMore,
    initialQuery,
    initialStatus,
    initialVendorId,
    initialWarehouseId,
    initialQcStatus,
    initialDateFrom,
    initialDateTo,
    kpis,
    error,
}: GrnListClientProps) {
    const { toast } = useZoruToast();
    const router = useRouter();
    const pathname = usePathname();
    const sp = useSearchParams();

    const [query, setQuery] = React.useState(initialQuery);
    const [pendingDelete, setPendingDelete] = React.useState<CrmGrnDoc | null>(null);
    const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);
    const [busy, startBusy] = React.useTransition();
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    const filters: GrnFilters = {
        query,
        status: initialStatus,
        vendorId: initialVendorId,
        warehouseId: initialWarehouseId,
        qcStatus: initialQcStatus,
        dateFrom: initialDateFrom,
        dateTo: initialDateTo,
    };

    React.useEffect(() => {
        if (query === initialQuery) return;
        const t = setTimeout(() => {
            pushParams({ q: query.trim() || undefined, page: '1' });
        }, 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    // WebSocket for real-time updates
    React.useEffect(() => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/api/ws';
        const ws = new WebSocket(wsUrl);
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'inventory_update' || data.type === 'grn_update') {
                    toast({
                        title: 'Live Update',
                        description: 'New inventory activity detected. Refreshing...',
                    });
                    router.refresh();
                }
            } catch (err) {
                // Ignore parse errors
            }
        };

        return () => {
            ws.close();
        };
    }, [router, toast]);

    function pushParams(updates: Record<string, string | undefined>) {
        const params = new URLSearchParams(sp?.toString() ?? '');
        for (const [k, v] of Object.entries(updates)) {
            if (v == null || v === '') params.delete(k);
            else params.set(k, v);
        }
        const qs = params.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
    }

    function clearAllFilters() {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        const qs = params.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
    }

    const allIds = React.useMemo(() => grns.map((g) => String(g._id)), [grns]);
    const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

    function toggleOne(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }
    function toggleAll() {
        setSelected(allSelected ? new Set() : new Set(allIds));
    }
    function clearSelection() {
        setSelected(new Set());
    }

    function confirmDelete() {
        if (!pendingDelete) return;
        const id = String(pendingDelete._id);
        const label = pendingDelete.grnNo || id;
        startBusy(async () => {
            const res = await deleteGrnAction(id);
            if (res.success) {
                toast({ title: 'Deleted', description: `${label} removed.` });
                setPendingDelete(null);
                router.refresh();
            } else {
                toast({
                    title: 'Delete failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    }

    function confirmBulkDelete() {
        if (selected.size === 0) return;
        startBusy(async () => {
            let ok = 0;
            let fail = 0;
            for (const id of selected) {
                const res = await deleteGrnAction(id);
                if (res.success) ok++;
                else fail++;
            }
            toast({
                title: `Deleted ${ok}`,
                description: fail > 0 ? `${fail} failed.` : 'All selected removed.',
                variant: fail > 0 ? 'destructive' : undefined,
            });
            clearSelection();
            setPendingBulkDelete(false);
            router.refresh();
        });
    }

    function bulkExport() {
        const sel = grns.filter((g) => selected.has(String(g._id)));
        const csv = grnsToCsv(sel);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `grns-${dateStamp()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async function bulkExportXlsx() {
        const sel = grns.filter((g) => selected.has(String(g._id)));
        const headers = ['GRN #', 'Vendor ID', 'PO ref', 'Date', 'Warehouse', 'Status'];
        const rows: ExportRow[] = sel.map((g) => ({
            'GRN #': g.grnNo ?? '',
            'Vendor ID': g.vendorId ?? '',
            'PO ref': g.poId ?? '',
            Date: g.date ?? '',
            Warehouse: g.warehouseId ?? '',
            Status: typeof g.status === 'string' ? g.status : '',
        }));
        await downloadXlsx(`grns-${dateStamp()}.xlsx`, headers, rows, 'GRNs');
    }

    function bulkConvertToBill() {
        for (const id of selected) {
            window.open(
                `/dashboard/crm/purchases/expenses/new?fromKind=grn&fromId=${id}`,
                '_blank',
            );
        }
    }

    // Map the KPI buckets back into the `status` URL param. "Partial"
    // is filter-only (no first-class status), so it sets a synthetic
    // `qcStatus=partial` chip instead.
    function pickKpiBucket(bucket: GrnStatusKey) {
        if (bucket === 'partial') {
            pushParams({
                qcStatus: filters.qcStatus === 'partial' ? undefined : 'partial',
                status: undefined,
                page: '1',
            });
            return;
        }
        const next = filters.status === bucket ? undefined : bucket;
        pushParams({ status: next, qcStatus: undefined, page: '1' });
    }

    const currentBucket: GrnStatusKey | '' = filters.qcStatus === 'partial'
        ? 'partial'
        : (filters.status as GrnStatusKey | '') || '';

    const hasActive =
        !!initialStatus ||
        !!initialVendorId ||
        !!initialWarehouseId ||
        !!initialQcStatus ||
        !!initialDateFrom ||
        !!initialDateTo;

    return (
        <div className="flex flex-col gap-4">
            <GrnKpiStrip
                kpis={kpis}
                currentBucket={currentBucket}
                onPick={pickKpiBucket}
            />

            <Card className="overflow-hidden p-0">
                <GrnFiltersBar
                    filters={filters}
                    onQueryChange={setQuery}
                    onUpdate={pushParams}
                    hasActive={hasActive}
                    onClear={clearAllFilters}
                />

                {error ? (
                    <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {error}
                    </div>
                ) : null}

                <GrnBulkBar
                    count={selected.size}
                    onClear={clearSelection}
                    onExport={bulkExport}
                    onExportXlsx={bulkExportXlsx}
                    onConvertToBill={bulkConvertToBill}
                    onDelete={() => setPendingBulkDelete(true)}
                />

                <Table>
                    <ZoruTableHeader>
                        <ZoruTableRow>
                            <ZoruTableHead className="w-[36px]">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={toggleAll}
                                    aria-label="Select all"
                                />
                            </ZoruTableHead>
                            <ZoruTableHead>GRN #</ZoruTableHead>
                            <ZoruTableHead>Vendor</ZoruTableHead>
                            <ZoruTableHead>PO ref</ZoruTableHead>
                            <ZoruTableHead>Date</ZoruTableHead>
                            <ZoruTableHead>Vehicle</ZoruTableHead>
                            <ZoruTableHead>Driver</ZoruTableHead>
                            <ZoruTableHead>Status</ZoruTableHead>
                            <ZoruTableHead>Linked Bill</ZoruTableHead>
                            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {grns.length === 0 ? (
                            <ZoruTableRow>
                                <ZoruTableCell
                                    colSpan={10}
                                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                >
                                    {initialQuery || hasActive
                                        ? 'No GRNs match these filters.'
                                        : 'No GRNs yet — click "New GRN" to add one.'}
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ) : (
                            grns.map((grn) => {
                                const id = String(grn._id);
                                const isSelected = selected.has(id);
                                const statusLabel = typeof grn.status === 'string'
                                    ? grn.status
                                    : '—';
                                // Surface forward-link bill if the GRN's
                                // lineage has one. Backwards-compat: also
                                // check loose `linkedBillId` on the doc.
                                const lineageBill = (grn.lineage ?? []).find(
                                    (l) => l.kind === 'bill',
                                )?.id;
                                const linkedBillId =
                                    lineageBill ??
                                    (grn as unknown as { linkedBillId?: string })
                                        .linkedBillId;
                                const tx = (grn as unknown as {
                                    transportDetails?: {
                                        vehicleNumber?: string;
                                        driverName?: string;
                                    };
                                }).transportDetails;
                                return (
                                    <ZoruTableRow
                                        key={id}
                                        data-state={isSelected ? 'selected' : undefined}
                                    >
                                        <ZoruTableCell>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => toggleOne(id)}
                                                aria-label={`Select ${grn.grnNo}`}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <EntityRowLink
                                                href={`/dashboard/crm/inventory/grn/${id}`}
                                                label={grn.grnNo || id.slice(-6)}
                                                subtitle={grn.poId ? `PO ${grn.poId.slice(-6)}` : undefined}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[12.5px]">
                                            {grn.vendorId ? (
                                                <EntityPickerChip
                                                    entity="vendor"
                                                    id={grn.vendorId}
                                                />
                                            ) : (
                                                <span className="text-zoru-ink-muted">—</span>
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                            {grn.poId ? (
                                                <Link
                                                    href={`/dashboard/crm/purchases/orders/${grn.poId}`}
                                                    className="hover:underline"
                                                >
                                                    {grn.poId.slice(-6)}
                                                </Link>
                                            ) : (
                                                '—'
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                            {fmtDate(grn.date)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                                            {tx?.vehicleNumber || '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                                            {tx?.driverName || '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {statusLabel ? (
                                                <StatusPill
                                                    label={statusLabel}
                                                    tone={statusToTone(statusLabel)}
                                                />
                                            ) : (
                                                <span className="text-[12.5px] text-zoru-ink-muted">
                                                    —
                                                </span>
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                            {linkedBillId ? (
                                                <Link
                                                    href={`/dashboard/crm/purchases/expenses/${linkedBillId}`}
                                                    className="hover:underline"
                                                >
                                                    {linkedBillId.slice(-6)}
                                                </Link>
                                            ) : (
                                                '—'
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    asChild
                                                    title="Convert to Bill"
                                                >
                                                    <Link
                                                        href={`/dashboard/crm/purchases/expenses/new?fromKind=grn&fromId=${id}`}
                                                    >
                                                        <ArrowRightCircle className="h-3.5 w-3.5" />
                                                    </Link>
                                                </Button>
                                                <Button size="sm" variant="ghost" asChild>
                                                    <Link
                                                        href={`/dashboard/crm/inventory/grn/${id}/edit`}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Link>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setPendingDelete(grn)}
                                                    className="text-zoru-danger-ink hidden md:flex"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                                <ZoruDropdownMenu>
                                                    <ZoruDropdownMenuTrigger asChild>
                                                        <Button size="sm" variant="ghost">
                                                            <MoreVertical className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </ZoruDropdownMenuTrigger>
                                                    <ZoruDropdownMenuContent align="end">
                                                        <ZoruDropdownMenuItem asChild>
                                                            <Link href={`/dashboard/crm/inventory/grn/${id}`}>
                                                                View Details
                                                            </Link>
                                                        </ZoruDropdownMenuItem>
                                                        <ZoruDropdownMenuItem asChild>
                                                            <Link href={`/dashboard/crm/inventory/grn/${id}/activity`}>
                                                                <Activity className="mr-2 h-3.5 w-3.5" /> Activity
                                                            </Link>
                                                        </ZoruDropdownMenuItem>
                                                        <ZoruDropdownMenuItem disabled>
                                                            <Printer className="mr-2 h-3.5 w-3.5" /> Print
                                                        </ZoruDropdownMenuItem>
                                                        <ZoruDropdownMenuItem
                                                            onClick={() => setPendingDelete(grn)}
                                                            className="text-zoru-danger-ink"
                                                        >
                                                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                                        </ZoruDropdownMenuItem>
                                                    </ZoruDropdownMenuContent>
                                                </ZoruDropdownMenu>
                                            </div>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                );
                            })
                        )}
                    </ZoruTableBody>
                </Table>

                <PaginationBar page={page} limit={limit} hasMore={hasMore} />

                <ZoruAlertDialog
                    open={pendingDelete !== null}
                    onOpenChange={(o) => !o && setPendingDelete(null)}
                >
                    <ZoruAlertDialogContent>
                        <ZoruAlertDialogHeader>
                            <ZoruAlertDialogTitle>Delete GRN?</ZoruAlertDialogTitle>
                            <ZoruAlertDialogDescription>
                                This permanently removes{' '}
                                <strong>{pendingDelete?.grnNo ?? ''}</strong> from the
                                database. The action cannot be undone.
                            </ZoruAlertDialogDescription>
                        </ZoruAlertDialogHeader>
                        <ZoruAlertDialogFooter>
                            <ZoruAlertDialogCancel disabled={busy}>
                                Cancel
                            </ZoruAlertDialogCancel>
                            <ZoruAlertDialogAction
                                onClick={(e) => {
                                    e.preventDefault();
                                    confirmDelete();
                                }}
                                disabled={busy}
                                className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
                            >
                                {busy ? (
                                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                Delete permanently
                            </ZoruAlertDialogAction>
                        </ZoruAlertDialogFooter>
                    </ZoruAlertDialogContent>
                </ZoruAlertDialog>

                <ZoruAlertDialog
                    open={pendingBulkDelete}
                    onOpenChange={(o) => !o && setPendingBulkDelete(false)}
                >
                    <ZoruAlertDialogContent>
                        <ZoruAlertDialogHeader>
                            <ZoruAlertDialogTitle>
                                Delete {selected.size} GRN{selected.size === 1 ? '' : 's'}?
                            </ZoruAlertDialogTitle>
                            <ZoruAlertDialogDescription>
                                This permanently removes the selected GRNs. The
                                action cannot be undone.
                            </ZoruAlertDialogDescription>
                        </ZoruAlertDialogHeader>
                        <ZoruAlertDialogFooter>
                            <ZoruAlertDialogCancel disabled={busy}>
                                Cancel
                            </ZoruAlertDialogCancel>
                            <ZoruAlertDialogAction
                                onClick={(e) => {
                                    e.preventDefault();
                                    confirmBulkDelete();
                                }}
                                disabled={busy}
                                className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
                            >
                                {busy ? (
                                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                Delete permanently
                            </ZoruAlertDialogAction>
                        </ZoruAlertDialogFooter>
                    </ZoruAlertDialogContent>
                </ZoruAlertDialog>
            </Card>
        </div>
    );
}
