'use client';

import { ZoruButton, ZoruInput, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KpiCard
                label="Pending QC"
                value={kpis.pendingQcCount}
                tone="amber"
                active={currentBucket === 'draft'}
                onClick={() => onPick('draft')}
            />
            <KpiCard
                label="Accepted"
                value={kpis.acceptedCount}
                tone="green"
                active={currentBucket === 'posted'}
                onClick={() => onPick('posted')}
            />
            <KpiCard
                label="Partially accepted"
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
        </div>
    );
}

/* ─── Filters toolbar ──────────────────────────────────────────── */

const STATUS_OPTIONS: { value: '' | string; label: string }[] = [
    { value: '', label: 'All statuses' },
    { value: 'draft', label: 'Draft (pending QC)' },
    { value: 'inspected', label: 'Inspected' },
    { value: 'posted', label: 'Posted (accepted)' },
    { value: 'rejected', label: 'Rejected' },
];

const QC_OPTIONS: { value: '' | string; label: string }[] = [
    { value: '', label: 'Any QC state' },
    { value: 'pending', label: 'Pending QC' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'partial', label: 'Partially accepted' },
    { value: 'rejected', label: 'Rejected' },
];

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
                <ZoruInput
                    value={filters.query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Search by GRN #, PO ref, vehicle, driver…"
                    className="h-9 pl-9 text-[13px]"
                />
            </div>
            <ZoruSelect
                value={filters.status || '__all'}
                onValueChange={(v) =>
                    onUpdate({ status: v === '__all' ? undefined : v, page: '1' })
                }
            >
                <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
                    <ZoruSelectValue placeholder="Status" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    {STATUS_OPTIONS.map((o) => (
                        <ZoruSelectItem key={o.value || '__all'} value={o.value || '__all'}>
                            {o.label}
                        </ZoruSelectItem>
                    ))}
                </ZoruSelectContent>
            </ZoruSelect>
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
            <ZoruSelect
                value={filters.qcStatus || '__any'}
                onValueChange={(v) =>
                    onUpdate({ qcStatus: v === '__any' ? undefined : v, page: '1' })
                }
            >
                <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
                    <ZoruSelectValue placeholder="QC state" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    {QC_OPTIONS.map((o) => (
                        <ZoruSelectItem key={o.value || '__any'} value={o.value || '__any'}>
                            {o.label}
                        </ZoruSelectItem>
                    ))}
                </ZoruSelectContent>
            </ZoruSelect>
            <details className="relative">
                <summary className="list-none">
                    <ZoruButton variant="outline" size="sm" className="h-9 text-[12.5px]">
                        <CalendarRange className="h-3.5 w-3.5" /> Date range
                    </ZoruButton>
                </summary>
                <div className="absolute right-0 z-20 mt-2 grid w-[280px] gap-2 rounded-md border border-zoru-line bg-zoru-surface p-3 shadow-md">
                    <label className="text-[11px] text-zoru-ink-muted">Receipt date — from</label>
                    <ZoruInput
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) =>
                            onUpdate({ dateFrom: e.target.value || undefined, page: '1' })
                        }
                        className="h-8 text-[12.5px]"
                    />
                    <label className="text-[11px] text-zoru-ink-muted">Receipt date — to</label>
                    <ZoruInput
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
                <ZoruButton
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="ml-auto text-[12px] text-zoru-ink-muted"
                >
                    <X className="h-3.5 w-3.5" /> Clear
                </ZoruButton>
            ) : null}
        </div>
    );
}

/* ─── Bulk bar ────────────────────────────────────────────────── */

export function GrnBulkBar({
    count,
    onClear,
    onExport,
    onConvertToBill,
    onDelete,
}: {
    count: number;
    onClear: () => void;
    onExport: () => void;
    onConvertToBill: () => void;
    onDelete: () => void;
}) {
    if (count === 0) return null;
    return (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-zoru-line bg-zoru-surface px-3 py-2 text-[12.5px]">
            <span className="font-medium text-zoru-ink">{count} selected</span>
            <ZoruButton variant="ghost" size="sm" onClick={onClear}>
                <X className="h-3.5 w-3.5" /> Clear
            </ZoruButton>
            <span className="mx-1 h-4 w-px bg-zoru-line" />
            <ZoruButton variant="outline" size="sm" onClick={onExport}>
                <Download className="h-3.5 w-3.5" /> Export
            </ZoruButton>
            <ZoruButton variant="outline" size="sm" onClick={onConvertToBill}>
                <ArrowRightCircle className="h-3.5 w-3.5" /> Convert to Bill
            </ZoruButton>
            <ZoruButton
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="text-zoru-danger-ink"
            >
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </ZoruButton>
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
