'use client';

import { Button, Input } from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  ArrowRightCircle,
  CalendarRange,
  Download,
  Search,
  Trash2,
  X,
  } from 'lucide-react';

/**
 * Presentational bits for the GRN list — KPI strip, filter toolbar,
 * bulk-bar, and CSV helpers. Extracted from `<GrnListClient>` to keep
 * the parent under the 600-line per-file cap.
 *
 * Inventory-side equivalent of `delivery-list-bits.tsx`.
 */

import * as React from 'react';

import { EntityPicker } from '@/components/crm/entity-picker';

import type { CrmGrnDoc } from '@/lib/rust-client/crm-grns';
import type { GrnKpis } from '@/app/actions/crm/grns.actions';

/* ─── Types ────────────────────────────────────────────────────── */

export type GrnStatusKey =
    | 'draft'
    | 'inspected'
    | 'posted'
    | 'rejected'
    | 'partial';

export interface GrnFilters {
    query: string;
    status: string;
    vendorId: string;
    warehouseId: string;
    qcStatus: string;
    dateFrom: string;
    dateTo: string;
}

export interface GrnRowVm {
    _id: string;
    grnNo: string;
    vendorId: string;
    warehouseId: string;
    poId?: string;
    date: string;
    status: string;
    vehicleNumber?: string;
    driverName?: string;
    /** True when `inspected` and at least one item has rejectedQty > 0. */
    partiallyAccepted?: boolean;
    /** Linked bill id, when one exists. */
    linkedBillId?: string;
}

/* ─── KPI strip ────────────────────────────────────────────────── */

interface KpiCardProps {
    label: string;
    value: number;
    active: boolean;
    onClick: () => void;
    tone: 'amber' | 'green' | 'neutral' | 'red';
}

function KpiCard({ label, value, active, onClick, tone }: KpiCardProps) {
    const ring =
        tone === 'amber'
            ? 'border-amber-500/40'
            : tone === 'green'
                ? 'border-emerald-500/40'
                : tone === 'red'
                    ? 'border-rose-500/40'
                    : 'border-zoru-line';
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex flex-1 flex-col gap-1 rounded-md border px-3 py-2.5 text-left transition-colors ${ring} ${
                active
                    ? 'bg-zoru-surface ring-1 ring-zoru-primary/40'
                    : 'bg-zoru-surface-2 hover:bg-zoru-surface'
            }`}
        >
            <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                {label}
            </span>
            <span className="text-[18px] font-semibold tabular-nums text-zoru-ink">
                {value}
            </span>
        </button>
    );
}

/**
 * Read-only KPI tile — for metrics that aren't filterable (MTD / units).
 * Mirrors `<KpiCard>` visually but skips the button affordance.
 */
function KpiStatic({ label, value, tone }: { label: string; value: string; tone: 'amber' | 'green' | 'neutral' | 'red' }) {
    const ring =
        tone === 'amber'
            ? 'border-amber-500/40'
            : tone === 'green'
                ? 'border-emerald-500/40'
                : tone === 'red'
                    ? 'border-rose-500/40'
                    : 'border-zoru-line';
    return (
        <div
            className={`flex flex-1 flex-col gap-1 rounded-md border bg-zoru-surface-2 px-3 py-2.5 text-left ${ring}`}
        >
            <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                {label}
            </span>
            <span className="text-[18px] font-semibold tabular-nums text-zoru-ink">
                {value}
            </span>
        </div>
    );
}

export function GrnKpiStrip({
    kpis,
    currentBucket,
    onPick,
}: {
    kpis: GrnKpis;
    currentBucket: GrnStatusKey | '';
    onPick: (b: GrnStatusKey) => void;
}) {
    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <KpiStatic
                label="MTD GRNs"
                value={kpis.mtdCount.toLocaleString()}
                tone="neutral"
            />
            <KpiCard
                label="Pending"
                value={kpis.pendingQcCount}
                tone="amber"
                active={currentBucket === 'draft'}
                onClick={() => onPick('draft')}
            />
            <KpiCard
                label="Completed"
                value={kpis.acceptedCount}
                tone="green"
                active={currentBucket === 'posted'}
                onClick={() => onPick('posted')}
            />
            <KpiCard
                label="Partial"
                value={kpis.partiallyAcceptedCount}
                tone="amber"
                active={currentBucket === 'partial'}
                onClick={() => onPick('partial')}
            />
            <KpiCard
                label="Rejected"
                value={kpis.rejectedCount}
                tone="red"
                active={currentBucket === 'rejected'}
                onClick={() => onPick('rejected')}
            />
            <KpiStatic
                label="Units received"
                value={kpis.totalReceivedValue.toLocaleString()}
                tone="neutral"
            />
        </div>
    );
}

/* ─── Filters toolbar ──────────────────────────────────────────── */


export function GrnFiltersBar({
    filters,
    onQueryChange,
    onUpdate,
    onClear,
    hasActive,
}: {
    filters: GrnFilters;
    onQueryChange: (v: string) => void;
    onUpdate: (updates: Record<string, string | undefined>) => void;
    onClear: () => void;
    hasActive: boolean;
}) {
    return (
        <div className="flex flex-wrap items-center gap-3 border-b border-zoru-line p-3">
            <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
                <Input
                    value={filters.query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Search by GRN #, PO ref, vehicle, driver…"
                    className="h-9 pl-9 text-[13px]"
                />
            </div>
            <EnumFilterField
                enumName="grnStatus"
                value={filters.status || 'all'}
                onChange={(v) =>
                    onUpdate({ status: v === 'all' ? undefined : v, page: '1' })
                }
                allLabel="All statuses"
            />
            <div className="w-[200px]">
                <EntityPicker
                    entity="vendor"
                    value={filters.vendorId || null}
                    placeholder="Vendor…"
                    onChange={(next) => {
                        const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                        onUpdate({ vendorId: id || undefined, page: '1' });
                    }}
                />
            </div>
            <div className="w-[200px]">
                <EntityPicker
                    entity="warehouse"
                    value={filters.warehouseId || null}
                    placeholder="Dispatch warehouse…"
                    onChange={(next) => {
                        const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                        onUpdate({ warehouseId: id || undefined, page: '1' });
                    }}
                />
            </div>
            <EnumFilterField
                enumName="grnQcStatus"
                value={filters.qcStatus || 'all'}
                onChange={(v) =>
                    onUpdate({ qcStatus: v === 'all' ? undefined : v, page: '1' })
                }
                allLabel="Any QC state"
            />
            <details className="relative">
                <summary className="list-none">
                    <Button variant="outline" size="sm" className="h-9 text-[12.5px]">
                        <CalendarRange className="h-3.5 w-3.5" /> Date range
                    </Button>
                </summary>
                <div className="absolute right-0 z-20 mt-2 grid w-[280px] gap-2 rounded-md border border-zoru-line bg-zoru-surface p-3 shadow-md">
                    <label className="text-[11px] text-zoru-ink-muted">Receipt date — from</label>
                    <Input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) =>
                            onUpdate({ dateFrom: e.target.value || undefined, page: '1' })
                        }
                        className="h-8 text-[12.5px]"
                    />
                    <label className="text-[11px] text-zoru-ink-muted">Receipt date — to</label>
                    <Input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) =>
                            onUpdate({ dateTo: e.target.value || undefined, page: '1' })
                        }
                        className="h-8 text-[12.5px]"
                    />
                </div>
            </details>
            {hasActive ? (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="ml-auto text-[12px] text-zoru-ink-muted"
                >
                    <X className="h-3.5 w-3.5" /> Clear
                </Button>
            ) : null}
        </div>
    );
}

/* ─── Bulk bar ────────────────────────────────────────────────── */

export function GrnBulkBar({
    count,
    onClear,
    onExport,
    onExportXlsx,
    onConvertToBill,
    onDelete,
}: {
    count: number;
    onClear: () => void;
    onExport: () => void;
    /** Optional XLSX export — hidden when omitted. */
    onExportXlsx?: () => void;
    onConvertToBill: () => void;
    onDelete: () => void;
}) {
    if (count === 0) return null;
    return (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-zoru-line bg-zoru-surface px-3 py-2 text-[12.5px]">
            <span className="font-medium text-zoru-ink">{count} selected</span>
            <Button variant="ghost" size="sm" onClick={onClear}>
                <X className="h-3.5 w-3.5" /> Clear
            </Button>
            <span className="mx-1 h-4 w-px bg-zoru-line" />
            <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            {onExportXlsx ? (
                <Button variant="outline" size="sm" onClick={onExportXlsx}>
                    <Download className="h-3.5 w-3.5" /> Export XLSX
                </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={onConvertToBill}>
                <ArrowRightCircle className="h-3.5 w-3.5" /> Convert to Bill
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="text-zoru-danger-ink"
            >
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
        </div>
    );
}

/* ─── CSV helpers ─────────────────────────────────────────────── */

function csvCell(v: unknown): string {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

export function grnsToCsv(rows: CrmGrnDoc[]): string {
    const headers = [
        'GRN #',
        'Vendor ID',
        'PO ref',
        'Date',
        'Warehouse',
        'Status',
    ];
    const lines = [headers.join(',')];
    for (const g of rows) {
        lines.push(
            [g.grnNo, g.vendorId, g.poId, g.date, g.warehouseId, g.status]
                .map(csvCell)
                .join(','),
        );
    }
    return lines.join('\n');
}
