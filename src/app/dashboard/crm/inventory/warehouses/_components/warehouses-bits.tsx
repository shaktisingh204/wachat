'use client';

import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard } from '@/components/sabcrm/20ui/compat';
import {
  Archive,
  Download,
  Snowflake,
  Trash2,
  Warehouse,
  X } from 'lucide-react';

/**
 * Presentational bits for the §1D Warehouses list — KPI strip, filter
 * row, and bulk-bar. Extracted to keep `<WarehousesListClient>` under
 * the 600-line per-file cap.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

import type {
    CrmWarehouseFilters,
    CrmWarehouseKpis,
} from '@/app/actions/crm-warehouses.actions.types';

export type WarehouseTypeFilter =
    | ''
    | 'main'
    | 'branch'
    | 'franchise'
    | '3pl'
    | 'virtual';
export type WarehouseStatusFilter = '' | 'active' | 'inactive' | 'archived';

export const WAREHOUSE_TYPE_OPTIONS: Array<{ value: WarehouseTypeFilter; label: string }> = [
    { value: '', label: 'Any type' },
    { value: 'main', label: 'Main' },
    { value: 'branch', label: 'Branch' },
    { value: 'franchise', label: 'Franchise' },
    { value: '3pl', label: '3PL' },
    { value: 'virtual', label: 'Virtual' },
];

export const WAREHOUSE_STATUS_OPTIONS: Array<{
    value: WarehouseStatusFilter;
    label: string;
}> = [
    { value: '', label: 'Any status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'archived', label: 'Archived' },
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

export interface WarehousesKpiStripProps {
    kpis: CrmWarehouseKpis;
    typeFilter: WarehouseTypeFilter;
    statusFilter: WarehouseStatusFilter;
    climateOnly: boolean;
    onClearAll: () => void;
    onPickStatus: (s: WarehouseStatusFilter) => void;
    onToggleClimate: () => void;
    onPickType: (t: WarehouseTypeFilter) => void;
}

export function WarehousesKpiStrip({
    kpis,
    typeFilter,
    statusFilter,
    climateOnly,
    onClearAll,
    onPickStatus,
    onToggleClimate,
    onPickType,
}: WarehousesKpiStripProps) {
    const topType = kpis.byType[0];
    const topTypeLabel = topType
        ? `${topType.type} · ${topType.count}`
        : 'No data';
    const topTypeIsActive =
        !!topType && (typeFilter as string) === topType.type;
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
                label="Total"
                value={kpis.total.toLocaleString()}
                icon={<Warehouse className="h-4 w-4" />}
                active={!typeFilter && !statusFilter && !climateOnly}
                onClick={onClearAll}
            />
            <KpiCard
                label="Active"
                value={kpis.active.toLocaleString()}
                icon={<Warehouse className="h-4 w-4" />}
                active={statusFilter === 'active'}
                onClick={() => onPickStatus(statusFilter === 'active' ? '' : 'active')}
            />
            <KpiCard
                label="Climate-controlled"
                value={kpis.climateControlled.toLocaleString()}
                icon={<Snowflake className="h-4 w-4" />}
                active={climateOnly}
                onClick={onToggleClimate}
            />
            <KpiCard
                label="Top type"
                value={topTypeLabel}
                icon={<Warehouse className="h-4 w-4" />}
                active={topTypeIsActive}
                onClick={() =>
                    topType
                        ? onPickType(
                              topTypeIsActive
                                  ? ''
                                  : (topType.type as WarehouseTypeFilter),
                          )
                        : undefined
                }
            />
        </div>
    );
}

/* ─── Filter row ──────────────────────────────────────────────────── */

export interface WarehousesFiltersRowProps {
    filters: CrmWarehouseFilters;
    onChange: (next: Partial<CrmWarehouseFilters>) => void;
    onClear: () => void;
    hasActiveFilters: boolean;
}

export function WarehousesFiltersRow({
    filters,
    onChange,
    onClear,
    hasActiveFilters,
}: WarehousesFiltersRowProps) {
    return (
        <div className="grid grid-cols-1 gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1">
                <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Type
                </Label>
                <Select
                    value={filters.type || '__any'}
                    onValueChange={(v) =>
                        onChange({
                            type:
                                v === '__any'
                                    ? ''
                                    : (v as WarehouseTypeFilter),
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {WAREHOUSE_TYPE_OPTIONS.map((o) => (
                            <SelectItem
                                key={o.value || '__any'}
                                value={o.value || '__any'}
                            >
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

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
                                    : (v as WarehouseStatusFilter),
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {WAREHOUSE_STATUS_OPTIONS.map((o) => (
                            <SelectItem
                                key={o.value || '__any'}
                                value={o.value || '__any'}
                            >
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1">
                <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Manager
                </Label>
                <EntityFormField
                    entity="employee"
                    name="managerFilter"
                    initialId={filters.managerId || null}
                    placeholder="Any manager"
                    onChange={(next) => onChange({ managerId: next ?? '' })}
                />
            </div>

            <div className="space-y-1">
                <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Country
                </Label>
                <EntityFormField
                    entity="country"
                    name="countryFilter"
                    initialId={filters.country || null}
                    placeholder="Any country"
                    onChange={(next) =>
                        onChange({
                            country: next ?? '',
                            state: '',
                            city: '',
                        })
                    }
                />
            </div>

            <div className="space-y-1">
                <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    State
                </Label>
                <EntityFormField
                    entity="state"
                    name="stateFilter"
                    initialId={filters.state || null}
                    filter={filters.country ? { countryCode: filters.country } : undefined}
                    disabled={!filters.country}
                    placeholder="Any state"
                    onChange={(next) =>
                        onChange({ state: next ?? '', city: '' })
                    }
                />
            </div>

            <div className="space-y-1">
                <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    City / Default
                </Label>
                <div className="flex items-center gap-1">
                    <EntityFormField
                        entity="city"
                        name="cityFilter"
                        initialId={filters.city || null}
                        filter={
                            filters.country
                                ? {
                                      countryCode: filters.country,
                                      ...(filters.state
                                          ? { stateCode: filters.state.includes(':') ? filters.state.split(':')[1] : filters.state }
                                          : {}),
                                  }
                                : undefined
                        }
                        disabled={!filters.country}
                        placeholder="Any city"
                        onChange={(next) => onChange({ city: next ?? '' })}
                    />
                    <Select
                        value={filters.isDefault || '__any'}
                        onValueChange={(v) =>
                            onChange({
                                isDefault:
                                    v === '__any'
                                        ? ''
                                        : (v as 'yes' | 'no'),
                            })
                        }
                    >
                        <SelectTrigger className="w-[110px]">
                            <SelectValue placeholder="Default" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__any">Default: any</SelectItem>
                            <SelectItem value="yes">Default only</SelectItem>
                            <SelectItem value="no">Non-default</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {hasActiveFilters ? (
                <div className="md:col-span-3 lg:col-span-6">
                    <Button variant="ghost" size="sm" onClick={onClear}>
                        <X className="h-3.5 w-3.5" /> Clear filters
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

/* ─── Bulk bar ────────────────────────────────────────────────────── */

export interface WarehousesBulkBarProps {
    count: number;
    onClear: () => void;
    onArchive: () => void;
    onDelete: () => void;
    onExport: () => void;
}

export function WarehousesBulkBar({
    count,
    onClear,
    onArchive,
    onDelete,
    onExport,
}: WarehousesBulkBarProps) {
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
            <Button variant="outline" size="sm" onClick={onArchive}>
                <Archive className="h-3.5 w-3.5" /> Archive
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

export function warehousesToCsv(
    rows: Array<{
        name?: string;
        code?: string;
        type?: string;
        city?: string;
        managerName?: string;
        capacityUnits?: number;
        capacitySqft?: number;
        isDefault?: boolean;
        status?: string;
    }>,
): string {
    const headers = [
        'Code',
        'Name',
        'Type',
        'City',
        'Manager',
        'Capacity (units)',
        'Capacity (sqft)',
        'Default',
        'Status',
    ];
    const lines = [headers.join(',')];
    for (const w of rows) {
        lines.push(
            [
                w.code,
                w.name,
                w.type,
                w.city,
                w.managerName,
                w.capacityUnits,
                w.capacitySqft,
                w.isDefault ? 'yes' : 'no',
                w.status || 'active',
            ]
                .map(csvCell)
                .join(','),
        );
    }
    return lines.join('\n');
}

/* ─── Type/status helpers ─────────────────────────────────────────── */

export function warehouseTypeLabel(type?: string): string {
    switch (type) {
        case 'main':
            return 'Main';
        case 'branch':
            return 'Branch';
        case 'franchise':
            return 'Franchise';
        case '3pl':
            return '3PL';
        case 'virtual':
            return 'Virtual';
        default:
            return type || 'Main';
    }
}
