'use client';

import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard } from '@/components/sabcrm/20ui';
import {
  BadgeCheck,
  CheckCircle2,
  CircleX,
  Download,
  HourglassIcon,
  Trash2,
  Wallet,
  X,
  } from 'lucide-react';

/**
 * Presentational bits for the §1D Stock Adjustments list — KPI strip,
 * filter row and bulk-bar. Kept separate so the list client stays
 * under the 600-line scope cap.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

import type {
    CrmStockAdjustmentFilters,
    CrmStockAdjustmentKpis,
} from '@/app/actions/crm-inventory.actions.types';

export type AdjustmentStatusFilter =
    | ''
    | 'pending'
    | 'approved'
    | 'rejected';

export const REASON_OPTIONS: Array<{ value: string; label: string }> = [
    { value: '', label: 'Any reason' },
    { value: 'Stock Received', label: 'Stock Received' },
    { value: 'Inventory Count', label: 'Inventory Count' },
    { value: 'Damage', label: 'Damage' },
    { value: 'Theft', label: 'Theft' },
    { value: 'Loss', label: 'Loss' },
    { value: 'Return', label: 'Return' },
    { value: 'Correction', label: 'Correction' },
    { value: 'Found', label: 'Found' },
    { value: 'Transfer In', label: 'Transfer In' },
    { value: 'Transfer Out', label: 'Transfer Out' },
    { value: 'Other', label: 'Other' },
];

/* ─── KPI strip ───────────────────────────────────────────────────── */

interface KpiCardProps {
    label: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
}

function KpiCard({ label, value, icon, active, onClick }: KpiCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]',
                active
                    ? 'ring-1 ring-[var(--st-text)] rounded-[var(--st-radius-lg)]'
                    : '',
            ].join(' ')}
        >
            <StatCard label={label} value={value} icon={icon} />
        </button>
    );
}

export interface AdjustmentsKpiStripProps {
    kpis: CrmStockAdjustmentKpis;
    statusFilter: AdjustmentStatusFilter;
    onClearAll: () => void;
    onPickStatus: (s: AdjustmentStatusFilter) => void;
}

function formatINR(n: number): string {
    try {
        return n.toLocaleString('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        });
    } catch {
        return `₹ ${n.toLocaleString('en-IN')}`;
    }
}

export function AdjustmentsKpiStrip({
    kpis,
    statusFilter,
    onClearAll,
    onPickStatus,
}: AdjustmentsKpiStripProps) {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
                label="Pending"
                value={kpis.pending.toLocaleString()}
                icon={<HourglassIcon className="h-4 w-4" />}
                active={statusFilter === 'pending'}
                onClick={() =>
                    onPickStatus(statusFilter === 'pending' ? '' : 'pending')
                }
            />
            <KpiCard
                label="Approved"
                value={kpis.approved.toLocaleString()}
                icon={<CheckCircle2 className="h-4 w-4" />}
                active={statusFilter === 'approved'}
                onClick={() =>
                    onPickStatus(statusFilter === 'approved' ? '' : 'approved')
                }
            />
            <KpiCard
                label="Rejected"
                value={kpis.rejected.toLocaleString()}
                icon={<CircleX className="h-4 w-4" />}
                active={statusFilter === 'rejected'}
                onClick={() =>
                    onPickStatus(statusFilter === 'rejected' ? '' : 'rejected')
                }
            />
            <KpiCard
                label="Total impact"
                value={formatINR(kpis.totalImpactValue)}
                icon={<Wallet className="h-4 w-4" />}
                active={!statusFilter}
                onClick={onClearAll}
            />
        </div>
    );
}

/* ─── Filter row ──────────────────────────────────────────────────── */

export interface AdjustmentsFiltersRowProps {
    filters: CrmStockAdjustmentFilters;
    onChange: (next: Partial<CrmStockAdjustmentFilters>) => void;
    onClear: () => void;
    hasActiveFilters: boolean;
}

export function AdjustmentsFiltersRow({
    filters,
    onChange,
    onClear,
    hasActiveFilters,
}: AdjustmentsFiltersRowProps) {
    return (
        <div className="grid grid-cols-1 gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 md:grid-cols-3 lg:grid-cols-5">
            <div className="space-y-1">
                <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Status
                </Label>
                <Select
                    value={filters.status || '__any'}
                    onValueChange={(v) =>
                        onChange({
                            status:
                                v === '__any'
                                    ? ''
                                    : (v as AdjustmentStatusFilter),
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__any">Any status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1">
                <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Warehouse
                </Label>
                <EntityFormField
                    entity="warehouse"
                    name="warehouseFilter"
                    initialId={filters.warehouseId || null}
                    placeholder="Any warehouse"
                    onChange={(next) => onChange({ warehouseId: next ?? '' })}
                />
            </div>

            <div className="space-y-1">
                <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Reason
                </Label>
                <Select
                    value={filters.reason || '__any'}
                    onValueChange={(v) =>
                        onChange({ reason: v === '__any' ? '' : v })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {REASON_OPTIONS.map((r) => (
                            <SelectItem
                                key={r.value || '__any'}
                                value={r.value || '__any'}
                            >
                                {r.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1">
                <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Approver
                </Label>
                <EntityFormField
                    entity="user"
                    name="approverFilter"
                    initialId={filters.approverId || null}
                    placeholder="Any approver"
                    onChange={(next) => onChange({ approverId: next ?? '' })}
                />
            </div>

            <div className="space-y-1">
                <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Date range
                </Label>
                <div className="flex items-center gap-1">
                    <Input
                        type="date"
                        value={filters.dateFrom || ''}
                        onChange={(e) =>
                            onChange({ dateFrom: e.target.value || '' })
                        }
                        className="h-9 text-[12.5px]"
                    />
                    <Input
                        type="date"
                        value={filters.dateTo || ''}
                        onChange={(e) =>
                            onChange({ dateTo: e.target.value || '' })
                        }
                        className="h-9 text-[12.5px]"
                    />
                </div>
            </div>

            {hasActiveFilters ? (
                <div className="md:col-span-3 lg:col-span-5">
                    <Button variant="ghost" size="sm" onClick={onClear}>
                        <X className="h-3.5 w-3.5" /> Clear filters
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

/* ─── Bulk bar ────────────────────────────────────────────────────── */

export interface AdjustmentsBulkBarProps {
    count: number;
    onClear: () => void;
    onApprove: () => void;
    onReject: () => void;
    onDelete: () => void;
    onExport: () => void;
}

export function AdjustmentsBulkBar({
    count,
    onClear,
    onApprove,
    onReject,
    onDelete,
    onExport,
}: AdjustmentsBulkBarProps) {
    if (count === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[var(--st-text)]">
                {count} selected
            </span>
            <Button variant="ghost" size="sm" onClick={onClear}>
                <X className="h-3.5 w-3.5" /> Clear
            </Button>
            <span className="mx-1 h-4 w-px bg-[var(--st-border)]" />
            <Button variant="outline" size="sm" onClick={onApprove}>
                <BadgeCheck className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button variant="outline" size="sm" onClick={onReject}>
                <CircleX className="h-3.5 w-3.5" /> Reject
            </Button>
            <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="text-[var(--st-danger)]"
            >
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
        </div>
    );
}

/* ─── CSV ─────────────────────────────────────────────────────────── */

function csvCell(v: unknown): string {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

export interface AdjustmentCsvRow {
    adjustmentNumber?: string;
    date?: string | Date;
    warehouseName?: string;
    reason?: string;
    linesCount?: number;
    impact?: number;
    status?: string;
    approvedByName?: string;
}

export function adjustmentsToCsv(rows: AdjustmentCsvRow[]): string {
    const headers = [
        'Adjustment #',
        'Date',
        'Warehouse',
        'Reason',
        'Lines',
        'Total impact',
        'Status',
        'Approved by',
    ];
    const lines = [headers.join(',')];
    for (const r of rows) {
        lines.push(
            [
                r.adjustmentNumber,
                r.date
                    ? new Date(r.date).toISOString().slice(0, 10)
                    : '',
                r.warehouseName,
                r.reason,
                r.linesCount ?? 1,
                r.impact ?? 0,
                r.status || 'pending',
                r.approvedByName ?? '',
            ]
                .map(csvCell)
                .join(','),
        );
    }
    return lines.join('\n');
}
