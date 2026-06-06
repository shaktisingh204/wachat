'use client';

import * as React from 'react';
import type { DateRange } from 'react-day-picker';
import { X } from 'lucide-react';

import { Badge, Button, DateRangePicker, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';

import type { PurchaseLeadsKpiFilter } from './purchase-leads-kpi-strip';

/**
 * Filter row for the Purchases · Vendor Leads list page.
 *
 *   Status · Owner · Source · Date range · Clear-all
 */

const STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'unqualified', label: 'Unqualified' },
    { value: 'won', label: 'Won' },
    { value: 'archived', label: 'Archived' },
];

export interface OwnerOption {
    value: string;
    label: string;
}

export interface SourceOption {
    value: string;
    label: string;
}

export interface PurchaseLeadsFiltersRowProps {
    statusFilter: PurchaseLeadsKpiFilter | string;
    onStatusChange: (v: PurchaseLeadsKpiFilter | string) => void;
    ownerFilter: string;
    onOwnerChange: (v: string) => void;
    ownerOptions: ReadonlyArray<OwnerOption>;
    sourceFilter: string;
    onSourceChange: (v: string) => void;
    sourceOptions: ReadonlyArray<SourceOption>;
    dateRange: DateRange | undefined;
    onDateRangeChange: (r: DateRange | undefined) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function PurchaseLeadsFiltersRow({
    statusFilter,
    onStatusChange,
    ownerFilter,
    onOwnerChange,
    ownerOptions,
    sourceFilter,
    onSourceChange,
    sourceOptions,
    dateRange,
    onDateRangeChange,
    hasActiveFilters,
    onClear,
}: PurchaseLeadsFiltersRowProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
                <Select
                    value={String(statusFilter || 'all')}
                    onValueChange={(v) => onStatusChange(v)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="w-56">
                <Select
                    value={ownerFilter || '__all__'}
                    onValueChange={(v) => onOwnerChange(v === '__all__' ? '' : v)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Any owner" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">Any owner</SelectItem>
                        {ownerOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="w-44">
                <Select
                    value={sourceFilter || '__all__'}
                    onValueChange={(v) => onSourceChange(v === '__all__' ? '' : v)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Any source" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">Any source</SelectItem>
                        {sourceOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="w-72">
                <DateRangePicker
                    value={dateRange}
                    onChange={(r) => onDateRangeChange(r)}
                    placeholder="Created between"
                />
            </div>

            {hasActiveFilters ? (
                <>
                    <Button variant="ghost" size="sm" onClick={onClear}>
                        <X className="h-3.5 w-3.5" /> Clear
                    </Button>
                    <Badge variant="secondary">Filters active</Badge>
                </>
            ) : null}
        </div>
    );
}

export default PurchaseLeadsFiltersRow;
