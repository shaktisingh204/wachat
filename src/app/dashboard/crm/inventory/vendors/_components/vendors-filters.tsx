'use client';

import * as React from 'react';
import type { DateRange } from 'react-day-picker';
import { X } from 'lucide-react';

import {
    Badge,
    Button,
    ZoruDateRangePicker,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
} from '@/components/zoruui';

import type { VendorsKpiFilter } from './vendors-kpi-strip';

/**
 * Filter row for the Inventory · Vendors list page.
 *
 *   Status · Vendor type (category) · Date range · Clear-all
 *
 * Search lives on <EntityListShell />; this strip handles the structured
 * predicates. All callbacks are stable from the parent.
 */

const STATUS_OPTIONS: ReadonlyArray<{ value: VendorsKpiFilter; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'active', label: 'Active (12mo)' },
    { value: 'inactive', label: 'Inactive' },
];

export interface VendorTypeOption {
    value: string;
    label: string;
}

export interface VendorsFiltersRowProps {
    statusFilter: VendorsKpiFilter;
    onStatusChange: (v: VendorsKpiFilter) => void;
    vendorTypeFilter: string;
    onVendorTypeChange: (v: string) => void;
    vendorTypeOptions: ReadonlyArray<VendorTypeOption>;
    dateRange: DateRange | undefined;
    onDateRangeChange: (r: DateRange | undefined) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function VendorsFiltersRow({
    statusFilter,
    onStatusChange,
    vendorTypeFilter,
    onVendorTypeChange,
    vendorTypeOptions,
    dateRange,
    onDateRangeChange,
    hasActiveFilters,
    onClear,
}: VendorsFiltersRowProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
                <Select
                    value={statusFilter}
                    onValueChange={(v) => onStatusChange(v as VendorsKpiFilter)}
                >
                    <ZoruSelectTrigger>
                        <ZoruSelectValue placeholder="All statuses" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                            <ZoruSelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </Select>
            </div>

            <div className="w-56">
                <Select
                    value={vendorTypeFilter || '__all__'}
                    onValueChange={(v) => onVendorTypeChange(v === '__all__' ? '' : v)}
                >
                    <ZoruSelectTrigger>
                        <ZoruSelectValue placeholder="All categories" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="__all__">All categories</ZoruSelectItem>
                        {vendorTypeOptions.map((opt) => (
                            <ZoruSelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </Select>
            </div>

            <div className="w-72">
                <ZoruDateRangePicker
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

export default VendorsFiltersRow;
