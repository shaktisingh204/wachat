'use client';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruDateRangePicker,
  Label,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  X } from 'lucide-react';

/**
 * Filter row + bulk bar for the Knowledge Base list (§1D.1).
 *
 * 6 filters: status, category (entity), visibility, tag, owner (user),
 * updated date range.
 *
 * Bulk: publish · unpublish · delete · export.
 */

import * as React from 'react';
import type { DateRange } from 'react-day-picker';

import { EntityFormField } from '@/components/crm/entity-form-field';

export type KbStatusFilter = 'all' | 'draft' | 'published' | 'archived';
export type KbVisibilityFilter = 'all' | 'public' | 'portal' | 'internal';

export interface KbFiltersRowProps {
    statusFilter: KbStatusFilter;
    onStatusChange: (v: KbStatusFilter) => void;
    categoryFilter: string;
    onCategoryChange: (v: string) => void;
    visibilityFilter: KbVisibilityFilter;
    onVisibilityChange: (v: KbVisibilityFilter) => void;
    tagFilter: string;
    onTagChange: (v: string) => void;
    ownerFilter: string;
    onOwnerChange: (v: string) => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (r: DateRange | undefined) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function KbFiltersRow(props: KbFiltersRowProps) {
    return (
        <ZoruCard>
            <ZoruCardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3 lg:grid-cols-6">
                <FilterField label="Status">
                    <EnumFilterField
                        enumName="kbStatus"
                        value={props.statusFilter}
                        onChange={(v) => props.onStatusChange(v as KbStatusFilter)}
                        allLabel="All"
                    />
                </FilterField>

                <FilterField label="Category">
                    <EntityFormField
                        entity="category"
                        name="kbCategoryFilter"
                        initialId={props.categoryFilter || null}
                        placeholder="Any"
                        onChange={(next) => props.onCategoryChange(next ?? '')}
                    />
                </FilterField>

                <FilterField label="Visibility">
                    <EnumFilterField
                        enumName="kbVisibility"
                        value={props.visibilityFilter}
                        onChange={(v) => props.onVisibilityChange(v as KbVisibilityFilter)}
                        allLabel="Any"
                    />
                </FilterField>

                <FilterField label="Tag">
                    <EntityFormField
                        entity="tag"
                        name="kbTagFilter"
                        initialId={props.tagFilter || null}
                        placeholder="Any"
                        onChange={(next) => props.onTagChange(next ?? '')}
                    />
                </FilterField>

                <FilterField label="Owner">
                    <EntityFormField
                        entity="user"
                        name="kbOwnerFilter"
                        initialId={props.ownerFilter || null}
                        placeholder="Any"
                        onChange={(next) => props.onOwnerChange(next ?? '')}
                    />
                </FilterField>

                <FilterField label="Updated">
                    <ZoruDateRangePicker
                        value={props.dateRange}
                        onChange={(r) => props.onDateRangeChange(r)}
                    />
                </FilterField>

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

function FilterField({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1">
            <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                {label}
            </ZoruLabel>
            {children}
        </div>
    );
}

/* ─── Bulk bar ───────────────────────────────────────────────────────── */

export interface KbBulkBarProps {
    count: number;
    onClear: () => void;
    onPublish: () => void;
    onUnpublish: () => void;
    onDelete: () => void;
    onExport: () => void;
}

export function KbBulkBar({
    count,
    onClear,
    onPublish,
    onUnpublish,
    onDelete,
    onExport,
}: KbBulkBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <ZoruBadge variant="info">{count} selected</ZoruBadge>
            <ZoruButton size="sm" variant="outline" onClick={onPublish}>
                Publish
            </ZoruButton>
            <ZoruButton size="sm" variant="outline" onClick={onUnpublish}>
                Unpublish
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
        </div>
    );
}
