'use client';

/**
 * Filter row + bulk action bar for the leads list page.
 *
 * Extracted here to keep `page.tsx` under the 600-line scope cap.
 * Pure presentation — every concrete filter value is passed in by the
 * parent. The bulk bar emits semantic callbacks the parent translates
 * into `bulkLeadAction(...)` calls.
 */

import * as React from 'react';
import type { DateRange } from 'react-day-picker';
import { Archive, X } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruCardContent,
    ZoruDateRangePicker,
    ZoruInput,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';

export type LeadsStatusFilter =
    | 'all'
    | 'New'
    | 'Qualified'
    | 'Won'
    | 'Converted'
    | 'archived';

export interface LeadsFiltersRowProps {
    statusFilter: LeadsStatusFilter;
    onStatusChange: (v: LeadsStatusFilter) => void;
    sourceFilter: string;
    onSourceChange: (v: string) => void;
    pipelineFilter: string;
    onPipelineChange: (v: string) => void;
    ownerFilter: string;
    onOwnerChange: (v: string) => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (r: DateRange | undefined) => void;
    minValue: string;
    maxValue: string;
    onMinChange: (v: string) => void;
    onMaxChange: (v: string) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function LeadsFiltersRow(props: LeadsFiltersRowProps) {
    return (
        <ZoruCard>
            <ZoruCardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3 lg:grid-cols-6">
                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Status
                    </ZoruLabel>
                    <ZoruSelect
                        value={props.statusFilter}
                        onValueChange={(v) => props.onStatusChange(v as LeadsStatusFilter)}
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">All</ZoruSelectItem>
                            <ZoruSelectItem value="New">New</ZoruSelectItem>
                            <ZoruSelectItem value="Qualified">Qualified</ZoruSelectItem>
                            <ZoruSelectItem value="Won">Won</ZoruSelectItem>
                            <ZoruSelectItem value="Converted">Converted</ZoruSelectItem>
                            <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Source
                    </ZoruLabel>
                    <EntityFormField
                        entity="leadSource"
                        name="sourceFilter"
                        initialId={props.sourceFilter || null}
                        placeholder="Any source"
                        onChange={(next) => props.onSourceChange(next ?? '')}
                    />
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Pipeline
                    </ZoruLabel>
                    <EntityFormField
                        entity="pipeline"
                        name="pipelineFilter"
                        initialId={props.pipelineFilter || null}
                        placeholder="Any pipeline"
                        onChange={(next) => props.onPipelineChange(next ?? '')}
                    />
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Owner
                    </ZoruLabel>
                    <EntityFormField
                        entity="user"
                        name="ownerFilter"
                        initialId={props.ownerFilter || null}
                        placeholder="Any owner"
                        onChange={(next) => props.onOwnerChange(next ?? '')}
                    />
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Created
                    </ZoruLabel>
                    <ZoruDateRangePicker
                        value={props.dateRange}
                        onChange={(r) => props.onDateRangeChange(r)}
                    />
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Value
                    </ZoruLabel>
                    <div className="flex items-center gap-1">
                        <ZoruInput
                            type="number"
                            min={0}
                            placeholder="Min"
                            value={props.minValue}
                            onChange={(e) => props.onMinChange(e.target.value)}
                        />
                        <ZoruInput
                            type="number"
                            min={0}
                            placeholder="Max"
                            value={props.maxValue}
                            onChange={(e) => props.onMaxChange(e.target.value)}
                        />
                    </div>
                </div>

                {props.hasActiveFilters ? (
                    <div className="flex items-end md:col-span-3 lg:col-span-6">
                        <ZoruButton variant="ghost" size="sm" onClick={props.onClear}>
                            <X className="h-3.5 w-3.5" /> Clear filters
                        </ZoruButton>
                    </div>
                ) : null}
            </ZoruCardContent>
        </ZoruCard>
    );
}

export interface LeadsBulkBarProps {
    count: number;
    onClear: () => void;
    onArchive: () => void;
    onDelete: () => void;
    onStatusChange: (s: string) => void;
    onExport: () => void;
}

export function LeadsBulkBar({
    count,
    onClear,
    onArchive,
    onDelete,
    onStatusChange,
    onExport,
}: LeadsBulkBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <ZoruBadge variant="info">{count} selected</ZoruBadge>
            <ZoruSelect onValueChange={onStatusChange}>
                <ZoruSelectTrigger className="h-8 w-[160px]">
                    <ZoruSelectValue placeholder="Set status…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="New">New</ZoruSelectItem>
                    <ZoruSelectItem value="Contacted">Contacted</ZoruSelectItem>
                    <ZoruSelectItem value="Qualified">Qualified</ZoruSelectItem>
                    <ZoruSelectItem value="Unqualified">Unqualified</ZoruSelectItem>
                    <ZoruSelectItem value="Converted">Converted</ZoruSelectItem>
                </ZoruSelectContent>
            </ZoruSelect>
            <ZoruButton size="sm" variant="outline" onClick={onArchive}>
                <Archive className="h-3.5 w-3.5" /> Archive
            </ZoruButton>
            <ZoruButton size="sm" variant="outline" onClick={onExport}>
                Export CSV
            </ZoruButton>
            <ZoruButton size="sm" variant="destructive" onClick={onDelete}>
                Delete
            </ZoruButton>
            <ZoruButton size="sm" variant="ghost" onClick={onClear}>
                Clear
            </ZoruButton>
            {/* TODO 1D.1: bulk assign-to-user picker + tag-add deferred — both depend on a dialog wrapper we haven't shipped here. */}
        </div>
    );
}
