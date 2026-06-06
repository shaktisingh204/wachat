'use client';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruDateRangePicker,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/sabcrm/20ui/compat';
import type { DateRange } from 'react-day-picker';
import {
  Archive,
  Download,
  FileSpreadsheet,
  Tag,
  X } from 'lucide-react';

/**
 * Filter row + bulk action bar for the accounts list page (§1D.1).
 * Pure presentation — concrete filter values are owned by `page.tsx`.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

export type AccountStatusFilter = 'all' | 'active' | 'archived';
export type AccountCategoryFilter =
    | 'all'
    | 'new'
    | 'strategic'
    | 'key'
    | 'regular';

export interface AccountsFiltersRowProps {
    statusFilter: AccountStatusFilter;
    onStatusChange: (v: AccountStatusFilter) => void;
    categoryFilter: AccountCategoryFilter;
    onCategoryChange: (v: AccountCategoryFilter) => void;
    industryFilter: string;
    onIndustryChange: (v: string) => void;
    countryFilter: string;
    onCountryChange: (v: string) => void;
    currencyFilter: string;
    onCurrencyChange: (v: string) => void;
    dateRange?: DateRange;
    onDateRangeChange?: (range: DateRange | undefined) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function AccountsFiltersRow(props: AccountsFiltersRowProps) {
    return (
        <Card>
            <ZoruCardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3 lg:grid-cols-5">
                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Status
                    </Label>
                    <Select
                        value={props.statusFilter}
                        onValueChange={(v) =>
                            props.onStatusChange(v as AccountStatusFilter)
                        }
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">All</ZoruSelectItem>
                            <ZoruSelectItem value="active">Active</ZoruSelectItem>
                            <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                        </ZoruSelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Category
                    </Label>
                    <Select
                        value={props.categoryFilter}
                        onValueChange={(v) =>
                            props.onCategoryChange(v as AccountCategoryFilter)
                        }
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">All categories</ZoruSelectItem>
                            <ZoruSelectItem value="new">New</ZoruSelectItem>
                            <ZoruSelectItem value="strategic">Strategic</ZoruSelectItem>
                            <ZoruSelectItem value="key">Key</ZoruSelectItem>
                            <ZoruSelectItem value="regular">Regular</ZoruSelectItem>
                        </ZoruSelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Industry
                    </Label>
                    <EntityFormField
                        entity="industry"
                        name="filter_industry"
                        initialId={props.industryFilter || null}
                        onChange={(id) => props.onIndustryChange(id ?? '')}
                        placeholder="Any industry"
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Country
                    </Label>
                    <EntityFormField
                        entity="country"
                        name="filter_country"
                        initialId={props.countryFilter || null}
                        onChange={(id) => props.onCountryChange(id ?? '')}
                        placeholder="Any country"
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Currency
                    </Label>
                    <EntityFormField
                        entity="currency"
                        name="filter_currency"
                        initialId={props.currencyFilter || null}
                        onChange={(id) => props.onCurrencyChange(id ?? '')}
                        placeholder="Any currency"
                    />
                </div>

                {props.onDateRangeChange ? (
                    <div className="space-y-1 lg:col-span-2">
                        <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                            Created
                        </Label>
                        <ZoruDateRangePicker
                            value={props.dateRange}
                            onChange={props.onDateRangeChange}
                            placeholder="Any time"
                        />
                    </div>
                ) : null}

                {props.hasActiveFilters ? (
                    <div className="flex items-end lg:col-span-5">
                        <Button variant="ghost" size="sm" onClick={props.onClear}>
                            <X className="h-3.5 w-3.5" /> Clear filters
                        </Button>
                    </div>
                ) : null}
            </ZoruCardContent>
        </Card>
    );
}

export interface AccountsBulkBarProps {
    count: number;
    onClear: () => void;
    onArchive: () => void;
    onCategoryChange: (next: 'new' | 'strategic' | 'key' | 'regular') => void;
    onExport: () => void;
    onExportXlsx?: () => void;
    onMerge?: () => void;
}

export function AccountsBulkBar({
    count,
    onClear,
    onArchive,
    onCategoryChange,
    onExport,
    onExportXlsx,
    onMerge,
}: AccountsBulkBarProps) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
                <Badge variant="info">{count} selected</Badge>
                <button
                    type="button"
                    onClick={onClear}
                    className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                >
                    Clear
                </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {onMerge && count === 2 ? (
                    <Button variant="outline" size="sm" onClick={onMerge}>
                        <Tag className="h-3.5 w-3.5 mr-1" /> Merge
                    </Button>
                ) : null}
                <Select onValueChange={(v) => onCategoryChange(v as 'new' | 'strategic' | 'key' | 'regular')}>
                    <ZoruSelectTrigger className="h-8 w-[180px] text-[12px]">
                        <Tag className="mr-1.5 h-3.5 w-3.5" />
                        <ZoruSelectValue placeholder="Set category…" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="new">Mark as New</ZoruSelectItem>
                        <ZoruSelectItem value="strategic">Mark as Strategic</ZoruSelectItem>
                        <ZoruSelectItem value="key">Mark as Key</ZoruSelectItem>
                        <ZoruSelectItem value="regular">Mark as Regular</ZoruSelectItem>
                    </ZoruSelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={onExport}>
                    <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
                {onExportXlsx ? (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onExportXlsx}
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Export XLSX
                    </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={onArchive}>
                    <Archive className="h-3.5 w-3.5" /> Archive
                </Button>
            </div>
        </div>
    );
}
