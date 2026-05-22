'use client';

/**
 * Client shell for the e-way bills list page.
 *
 * Responsibilities:
 *  - Filter row (search by EWB no / GSTIN, status select, date range)
 *  - Checkbox row selection + select-all
 *  - Bulk cancel with confirm dialog
 *  - Export CSV / XLSX
 *  - Delegates per-row mutations to <EWayBillRowActions>
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, X, Loader2 } from 'lucide-react';

import {
    Button,
    Badge,
    Checkbox,
    Input,
} from '@/components/zoruui';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { downloadCsv, downloadXlsx, dateStamp, type ExportRow } from '@/lib/crm-list-export';
import { cancelEWayBill } from '@/app/actions/crm-india-eway.actions';
import { EWayBillRowActions } from './row-actions';
import type { EWayBillSummary } from '@/app/actions/crm-india-eway.actions';

/* ─── helpers ─────────────────────────────────────────────────────── */

function fmtMoney(n: number) {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(n);
    } catch {
        return `₹${n}`;
    }
}

function fmtDate(iso: string) {
    try {
        return new Date(iso).toISOString().slice(0, 10);
    } catch {
        return iso;
    }
}

function statusVariant(s: string): 'success' | 'danger' | 'warning' {
    if (s === 'cancelled') return 'danger';
    if (s === 'expired') return 'warning';
    return 'success';
}

type StatusFilter = 'all' | 'active' | 'expired' | 'cancelled';

/* ─── component ───────────────────────────────────────────────────── */

interface Props {
    bills: EWayBillSummary[];
}

export function EWayBillsClient({ bills }: Props) {
    const router = useRouter();

    // ── filter state ──────────────────────────────────────────────
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [dateFrom, setDateFrom] = React.useState('');
    const [dateTo, setDateTo] = React.useState('');

    // ── selection ─────────────────────────────────────────────────
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    // ── bulk cancel state ─────────────────────────────────────────
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [cancelReason, setCancelReason] = React.useState('');
    const [cancelling, setCancelling] = React.useState(false);
    const [cancelError, setCancelError] = React.useState<string | null>(null);

    // ── derived filtered list ─────────────────────────────────────
    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return bills.filter((b) => {
            if (q) {
                const haystack =
                    `${b.ewbNo} ${b.fromGstin} ${b.toGstin ?? ''} ${b.vehicleNumber ?? ''}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            if (statusFilter !== 'all' && b.status !== statusFilter) return false;
            if (dateFrom && fmtDate(b.ewbDate) < dateFrom) return false;
            if (dateTo && fmtDate(b.ewbDate) > dateTo) return false;
            return true;
        });
    }, [bills, search, statusFilter, dateFrom, dateTo]);

    // keep selection pruned to only IDs present in filtered
    const filteredIds = React.useMemo(() => new Set(filtered.map((b) => b._id)), [filtered]);

    // ── select-all ────────────────────────────────────────────────
    const allSelected =
        filtered.length > 0 && filtered.every((b) => selected.has(b._id));
    const someSelected = !allSelected && filtered.some((b) => selected.has(b._id));

    function toggleAll() {
        if (allSelected) {
            setSelected((prev) => {
                const next = new Set(prev);
                filtered.forEach((b) => next.delete(b._id));
                return next;
            });
        } else {
            setSelected((prev) => {
                const next = new Set(prev);
                filtered.forEach((b) => next.add(b._id));
                return next;
            });
        }
    }

    function toggleRow(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    const selectedInView = filtered.filter((b) => selected.has(b._id));
    const selectionCount = selectedInView.length;

    // ── export ────────────────────────────────────────────────────
    const HEADERS = [
        'EWB No',
        'Date',
        'From GSTIN',
        'To GSTIN',
        'Goods Value (INR)',
        'Distance (km)',
        'Vehicle',
        'Valid Till',
        'Status',
    ];

    function toExportRow(b: EWayBillSummary): ExportRow {
        return {
            'EWB No': b.ewbNo,
            'Date': fmtDate(b.ewbDate),
            'From GSTIN': b.fromGstin,
            'To GSTIN': b.toGstin ?? '',
            'Goods Value (INR)': b.totalValue,
            'Distance (km)': b.distanceKm,
            'Vehicle': b.vehicleNumber ?? '',
            'Valid Till': fmtDate(b.validUpto),
            'Status': b.status,
        };
    }

    function exportRows() {
        return selectionCount > 0
            ? selectedInView.map(toExportRow)
            : filtered.map(toExportRow);
    }

    function handleCsv() {
        downloadCsv(`eway-bills-${dateStamp()}.csv`, HEADERS, exportRows());
    }

    async function handleXlsx() {
        await downloadXlsx(
            `eway-bills-${dateStamp()}.xlsx`,
            HEADERS,
            exportRows(),
            'E-Way Bills',
        );
    }

    // ── bulk cancel ───────────────────────────────────────────────
    const cancelableSelected = selectedInView.filter((b) => b.status === 'active');

    function openBulkCancel() {
        setCancelReason('');
        setCancelError(null);
        setConfirmOpen(true);
    }

    async function executeBulkCancel() {
        const reason = cancelReason.trim();
        if (!reason) {
            setCancelError('A cancellation reason is required.');
            return;
        }
        setCancelling(true);
        setCancelError(null);
        const results = await Promise.all(
            cancelableSelected.map((b) => cancelEWayBill(b._id, reason)),
        );
        setCancelling(false);
        const failed = results.filter((r) => !r.ok);
        if (failed.length > 0) {
            const first = failed[0];
            setCancelError(
                `${failed.length} bill(s) failed: ${'error' in first ? first.error : 'unknown error'}`,
            );
            return;
        }
        setConfirmOpen(false);
        setSelected(new Set());
        router.refresh();
    }

    // ── render ────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-3">
            {/* Filter row */}
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <Input
                    placeholder="Search EWB no, GSTIN, vehicle…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 w-56"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
                >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <label className="flex flex-col gap-0.5">
                    <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                        From
                    </span>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
                    />
                </label>
                <label className="flex flex-col gap-0.5">
                    <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                        To
                    </span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
                    />
                </label>
                {(search || statusFilter !== 'all' || dateFrom || dateTo) && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSearch('');
                            setStatusFilter('all');
                            setDateFrom('');
                            setDateTo('');
                        }}
                    >
                        <X className="h-3.5 w-3.5" />
                        Clear
                    </Button>
                )}
            </div>

            {/* Bulk action bar */}
            {selectionCount > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13px]">
                    <span className="font-medium">{selectionCount} selected</span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCsv}
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleXlsx}
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export XLSX
                    </Button>
                    {cancelableSelected.length > 0 && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={openBulkCancel}
                        >
                            Cancel {cancelableSelected.length} active
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(new Set())}
                    >
                        <X className="h-3.5 w-3.5" />
                        Clear selection
                    </Button>
                </div>
            )}

            {/* Export all (no selection) */}
            {selectionCount === 0 && filtered.length > 0 && (
                <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={handleCsv}>
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleXlsx}>
                        <Download className="h-3.5 w-3.5" />
                        Export XLSX
                    </Button>
                </div>
            )}

            {/* Table */}
            {filtered.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                    {bills.length === 0
                        ? 'No e-way bills yet. Generate one for a consignment greater than ₹50,000.'
                        : 'No bills match the current filters.'}
                </p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="min-w-full text-[13px]">
                        <thead>
                            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                                <th className="px-2 py-2">
                                    <Checkbox
                                        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                        onCheckedChange={toggleAll}
                                        aria-label="Select all"
                                    />
                                </th>
                                <th className="px-2 py-2">EWB No</th>
                                <th className="px-2 py-2">From GSTIN → To GSTIN</th>
                                <th className="px-2 py-2">Value</th>
                                <th className="px-2 py-2">Vehicle</th>
                                <th className="px-2 py-2">Valid till</th>
                                <th className="px-2 py-2">Status</th>
                                <th className="px-2 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((b) => (
                                <tr
                                    key={b._id}
                                    className={`border-b border-border/60 ${selected.has(b._id) ? 'bg-muted/30' : ''}`}
                                >
                                    <td className="px-2 py-2">
                                        <Checkbox
                                            checked={selected.has(b._id)}
                                            onCheckedChange={() => toggleRow(b._id)}
                                            aria-label={`Select ${b.ewbNo}`}
                                        />
                                    </td>
                                    <td className="px-2 py-2 font-mono text-[12px]">
                                        <EntityRowLink
                                            href={`/dashboard/crm/tax/eway-bills/${b._id}`}
                                            label={b.ewbNo}
                                            subtitle={fmtDate(b.ewbDate)}
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <span className="font-mono text-[11px]">{b.fromGstin}</span>
                                        {' → '}
                                        <span className="font-mono text-[11px]">{b.toGstin ?? 'URP'}</span>
                                    </td>
                                    <td className="px-2 py-2">{fmtMoney(b.totalValue)}</td>
                                    <td className="px-2 py-2 font-mono text-[12px]">
                                        {b.vehicleNumber ?? '—'}
                                    </td>
                                    <td className="px-2 py-2">{fmtDate(b.validUpto)}</td>
                                    <td className="px-2 py-2">
                                        <Badge variant={statusVariant(b.status)}>
                                            {b.status}
                                        </Badge>
                                    </td>
                                    <td className="px-2 py-2">
                                        <EWayBillRowActions id={b._id} status={b.status} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Bulk cancel confirm dialog */}
            {confirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
                        <h2 className="text-[15px] font-semibold text-foreground">
                            Cancel {cancelableSelected.length} e-way bill{cancelableSelected.length !== 1 ? 's' : ''}
                        </h2>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                            This will cancel all selected active bills. Cancelled bills cannot be
                            reactivated.
                        </p>
                        <label className="mt-4 flex flex-col gap-1">
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Cancellation reason (required)
                            </span>
                            <Input
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="e.g. Incorrect consignment details"
                                autoFocus
                            />
                        </label>
                        {cancelError && (
                            <p className="mt-2 text-[12.5px] text-destructive">{cancelError}</p>
                        )}
                        <div className="mt-4 flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setConfirmOpen(false)}
                                disabled={cancelling}
                            >
                                Back
                            </Button>
                            <Button
                                onClick={executeBulkCancel}
                                disabled={cancelling || !cancelReason.trim()}
                            >
                                {cancelling ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : null}
                                Confirm cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
