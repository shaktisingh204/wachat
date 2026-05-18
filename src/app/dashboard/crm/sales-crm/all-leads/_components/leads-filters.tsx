'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruDateRangePicker,
  ZoruInput,
  ZoruLabel,
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from '@/components/zoruui';
import {
  Archive,
  ChevronDown,
  ListChecks,
  Tag,
  UserPlus,
  X } from 'lucide-react';

/**
 * Filter row + bulk action bar for the leads list page.
 *
 * Extracted here to keep `page.tsx` under the 600-line scope cap.
 * Pure presentation — every concrete filter value is passed in by the
 * parent. The bulk bar emits semantic callbacks the parent translates
 * into `bulkLeadAction(...)` calls.
 *
 * §1D follow-up additions:
 *  - Inline bulk-assign + bulk-tag pickers (popover-backed).
 *  - `<LeadsViewsMenu>` saved-filter preset launcher.
 */

import * as React from 'react';
import type { DateRange } from 'react-day-picker';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityMultiFormField } from '@/components/crm/entity-multi-form-field';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

export type LeadsStatusFilter =
    | 'all'
    | 'New'
    | 'Contacted'
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
                    <EnumFilterField
                        enumName="leadStatusListFilter"
                        value={props.statusFilter}
                        onChange={(v) => props.onStatusChange(v as LeadsStatusFilter)}
                        allLabel="All statuses"
                    />
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

/* ─── Bulk bar ───────────────────────────────────────────────────────── */

export interface LeadsBulkBarProps {
    count: number;
    onClear: () => void;
    onArchive: () => void;
    onDelete: () => void;
    onStatusChange: (s: string) => void;
    onAssign: (userId: string | null) => void;
    onAddTags: (tagIds: string[]) => void;
    onExport: () => void;
}

export function LeadsBulkBar({
    count,
    onClear,
    onArchive,
    onDelete,
    onStatusChange,
    onAssign,
    onAddTags,
    onExport,
}: LeadsBulkBarProps) {
    const [assignOpen, setAssignOpen] = React.useState(false);
    const [tagsOpen, setTagsOpen] = React.useState(false);

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

            {/* Bulk assign owner */}
            <ZoruPopover open={assignOpen} onOpenChange={setAssignOpen}>
                <ZoruPopoverTrigger asChild>
                    <ZoruButton size="sm" variant="outline">
                        <UserPlus className="h-3.5 w-3.5" /> Assign…
                    </ZoruButton>
                </ZoruPopoverTrigger>
                <ZoruPopoverContent align="start" className="w-72 space-y-2">
                    <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Assign to user
                    </p>
                    <EntityFormField
                        entity="user"
                        name="bulkAssign"
                        initialId={null}
                        placeholder="Pick a user…"
                        onChange={(next) => {
                            setAssignOpen(false);
                            onAssign(next);
                        }}
                    />
                    <button
                        type="button"
                        className="text-[12px] text-zoru-ink-muted hover:underline"
                        onClick={() => {
                            setAssignOpen(false);
                            onAssign(null);
                        }}
                    >
                        Unassign
                    </button>
                </ZoruPopoverContent>
            </ZoruPopover>

            {/* Bulk add tag */}
            <ZoruPopover open={tagsOpen} onOpenChange={setTagsOpen}>
                <ZoruPopoverTrigger asChild>
                    <ZoruButton size="sm" variant="outline">
                        <Tag className="h-3.5 w-3.5" /> Add tag…
                    </ZoruButton>
                </ZoruPopoverTrigger>
                <ZoruPopoverContent align="start" className="w-80 space-y-2">
                    <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Add tags to selected
                    </p>
                    <BulkTagPicker
                        onApply={(ids) => {
                            setTagsOpen(false);
                            onAddTags(ids);
                        }}
                        onCancel={() => setTagsOpen(false)}
                    />
                </ZoruPopoverContent>
            </ZoruPopover>

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
        </div>
    );
}

/**
 * Internal picker reused for the bulk add-tag popover. We need to capture
 * the multi-select id list locally before the user explicitly applies it
 * — otherwise every keystroke fires the parent action.
 */
function BulkTagPicker({
    onApply,
    onCancel,
}: {
    onApply: (ids: string[]) => void;
    onCancel: () => void;
}) {
    const [ids, setIds] = React.useState<string[]>([]);
    return (
        <div className="space-y-2">
            <EntityMultiFormField
                entity="tag"
                name="bulkTags"
                initialIds={[]}
                placeholder="Pick tags…"
                onChange={setIds}
            />
            <div className="flex items-center justify-end gap-1.5 pt-1">
                <ZoruButton size="sm" variant="ghost" onClick={onCancel}>
                    Cancel
                </ZoruButton>
                <ZoruButton
                    size="sm"
                    onClick={() => onApply(ids)}
                    disabled={ids.length === 0}
                >
                    Apply
                </ZoruButton>
            </div>
        </div>
    );
}

/* ─── Saved filter presets ───────────────────────────────────────────── */

export interface LeadsViewPreset {
    id: string;
    label: string;
    description?: string;
}

export interface LeadsViewState {
    statusFilter: LeadsStatusFilter;
    sourceFilter: string;
    pipelineFilter: string;
    ownerFilter: string;
    dateRange?: DateRange;
    minValue: string;
    maxValue: string;
    /** Filter callback layered on top of the server filter set. */
    clientPredicate?: (lead: Record<string, unknown>) => boolean;
}

export const LEADS_VIEW_PRESETS: LeadsViewPreset[] = [
    { id: 'all', label: 'All leads', description: 'Default view (no filters)' },
    {
        id: 'my-hot-leads',
        label: 'My hot leads',
        description: 'Mine, score ≥ 70, in active funnel',
    },
    {
        id: 'overdue-followup',
        label: 'Overdue follow-up',
        description: 'Next activity date in the past',
    },
    {
        id: 'stale-30',
        label: 'Stale > 30 days',
        description: 'Untouched for the last 30 days',
    },
];

/**
 * Materialise a preset id into a partial view state. `currentUserId` is
 * passed in so "my" presets can scope to the active session.
 */
export function buildLeadsViewState(
    presetId: string,
    currentUserId: string | undefined,
): LeadsViewState {
    const base: LeadsViewState = {
        statusFilter: 'all',
        sourceFilter: '',
        pipelineFilter: '',
        ownerFilter: '',
        dateRange: undefined,
        minValue: '',
        maxValue: '',
    };

    switch (presetId) {
        case 'my-hot-leads':
            return {
                ...base,
                ownerFilter: currentUserId ?? '',
                clientPredicate: (lead) => {
                    const score = Number((lead as any).leadScore ?? 0);
                    const status = String((lead as any).status ?? '').toLowerCase();
                    const active = ['new', 'contacted', 'qualified'].includes(status);
                    return active && score >= 70;
                },
            };
        case 'overdue-followup':
            return {
                ...base,
                clientPredicate: (lead) => {
                    const ts =
                        (lead as any).nextActivityDate ??
                        (lead as any).nextFollowUp ??
                        null;
                    if (!ts) return false;
                    return new Date(ts).getTime() < Date.now();
                },
            };
        case 'stale-30': {
            const thirtyAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
            return {
                ...base,
                clientPredicate: (lead) => {
                    const last = (lead as any).lastActivity ?? (lead as any).updatedAt;
                    if (!last) return true;
                    return new Date(last).getTime() < thirtyAgo;
                },
            };
        }
        default:
            return base;
    }
}

export interface LeadsViewsMenuProps {
    activePresetId?: string;
    onSelect: (presetId: string) => void;
}

export function LeadsViewsMenu({ activePresetId, onSelect }: LeadsViewsMenuProps) {
    const active = LEADS_VIEW_PRESETS.find((p) => p.id === activePresetId) ?? LEADS_VIEW_PRESETS[0];
    return (
        <ZoruDropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="sm">
                    <ListChecks className="h-3.5 w-3.5" /> {active.label}
                    <ChevronDown className="h-3.5 w-3.5 text-zoru-ink-subtle" />
                </ZoruButton>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="start" className="w-64">
                <ZoruDropdownMenuLabel>Saved views</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuSeparator />
                {LEADS_VIEW_PRESETS.map((preset) => (
                    <ZoruDropdownMenuItem
                        key={preset.id}
                        onClick={() => onSelect(preset.id)}
                    >
                        <div className="flex flex-col">
                            <span className="text-[13px] font-medium">{preset.label}</span>
                            {preset.description ? (
                                <span className="text-[11.5px] text-zoru-ink-muted">
                                    {preset.description}
                                </span>
                            ) : null}
                        </div>
                    </ZoruDropdownMenuItem>
                ))}
            </ZoruDropdownMenuContent>
        </ZoruDropdownMenu>
    );
}
