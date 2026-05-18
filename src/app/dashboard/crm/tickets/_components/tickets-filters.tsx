'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruDateRangePicker,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruLabel,
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  ChevronDown,
  ListChecks,
  UserPlus,
  X,
  } from 'lucide-react';

/**
 * Filter row + bulk bar + saved-view preset menu for the Tickets list
 * page (§1D.1).
 *
 * 8 filters: status, priority, severity, channel, category, assignee,
 * requester-type, date range.
 *
 * Bulk operations: assign · change priority · change status · merge ·
 * delete · export.
 *
 * Saved presets: All · My tickets · Overdue SLA · High priority
 * unassigned · Resolved last 30d.
 */

import * as React from 'react';
import type { DateRange } from 'react-day-picker';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

export type TicketRequesterKind = 'client' | 'lead' | 'employee';
export type TicketStatusFilter =
    | 'all'
    | 'open'
    | 'pending'
    | 'on_hold'
    | 'resolved'
    | 'closed'
    | 'reopened';

export const CHANNEL_OPTIONS = [
    { value: 'email', label: 'Email' },
    { value: 'web', label: 'Web' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'chat', label: 'Chat' },
    { value: 'phone', label: 'Phone' },
    { value: 'portal', label: 'Portal' },
] as const;

export const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
] as const;

export const SEVERITY_OPTIONS = [
    { value: 'sev1', label: 'Sev 1' },
    { value: 'sev2', label: 'Sev 2' },
    { value: 'sev3', label: 'Sev 3' },
    { value: 'sev4', label: 'Sev 4' },
] as const;

export const STATUS_OPTIONS = [
    { value: 'open', label: 'Open' },
    { value: 'pending', label: 'Pending' },
    { value: 'on_hold', label: 'On hold' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
    { value: 'reopened', label: 'Reopened' },
] as const;

/* ─── Filter row ─────────────────────────────────────────────────────── */

export interface TicketsFiltersRowProps {
    statusFilter: TicketStatusFilter;
    onStatusChange: (v: TicketStatusFilter) => void;
    priorityFilter: string;
    onPriorityChange: (v: string) => void;
    severityFilter: string;
    onSeverityChange: (v: string) => void;
    channelFilter: string;
    onChannelChange: (v: string) => void;
    categoryFilter: string;
    onCategoryChange: (v: string) => void;
    assigneeFilter: string;
    onAssigneeChange: (v: string) => void;
    requesterKindFilter: TicketRequesterKind | 'all';
    onRequesterKindChange: (v: TicketRequesterKind | 'all') => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (r: DateRange | undefined) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function TicketsFiltersRow(props: TicketsFiltersRowProps) {
    return (
        <ZoruCard>
            <ZoruCardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-4 lg:grid-cols-8">
                <FilterField label="Status">
                    <EnumFilterField
                        enumName="ticketStatus"
                        value={props.statusFilter}
                        onChange={(v) => props.onStatusChange(v as TicketStatusFilter)}
                        allLabel="All"
                    />
                </FilterField>

                <FilterField label="Priority">
                    <EnumFilterField
                        enumName="ticketPriority"
                        value={props.priorityFilter || 'all'}
                        onChange={(v) => props.onPriorityChange(v === 'all' ? '' : v)}
                        allLabel="Any priority"
                    />
                </FilterField>

                <FilterField label="Severity">
                    <EnumFilterField
                        enumName="ticketSeverity"
                        value={props.severityFilter || 'all'}
                        onChange={(v) => props.onSeverityChange(v === 'all' ? '' : v)}
                        allLabel="Any severity"
                    />
                </FilterField>

                <FilterField label="Channel">
                    <EnumFilterField
                        enumName="ticketChannel"
                        value={props.channelFilter || 'all'}
                        onChange={(v) => props.onChannelChange(v === 'all' ? '' : v)}
                        allLabel="Any channel"
                    />
                </FilterField>

                <FilterField label="Category">
                    <EntityFormField
                        entity="category"
                        name="categoryFilter"
                        initialId={props.categoryFilter || null}
                        placeholder="Any"
                        onChange={(next) => props.onCategoryChange(next ?? '')}
                    />
                </FilterField>

                <FilterField label="Assignee">
                    <EntityFormField
                        entity="user"
                        name="assigneeFilter"
                        initialId={props.assigneeFilter || null}
                        placeholder="Any"
                        onChange={(next) => props.onAssigneeChange(next ?? '')}
                    />
                </FilterField>

                <FilterField label="Requester">
                    <EnumFilterField
                        enumName="requesterKind"
                        value={props.requesterKindFilter}
                        onChange={(v) =>
                            props.onRequesterKindChange(v as TicketRequesterKind | 'all')
                        }
                        allLabel="Any requester"
                    />
                </FilterField>

                <FilterField label="Created">
                    <ZoruDateRangePicker
                        value={props.dateRange}
                        onChange={(r) => props.onDateRangeChange(r)}
                    />
                </FilterField>

                {props.hasActiveFilters ? (
                    <div className="flex items-end md:col-span-4 lg:col-span-8">
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

export interface TicketsBulkBarProps {
    count: number;
    onClear: () => void;
    onAssign: (userId: string | null) => void;
    onPriority: (p: string) => void;
    onStatus: (s: string) => void;
    onMerge: () => void;
    onDelete: () => void;
    onExport: () => void;
}

export function TicketsBulkBar({
    count,
    onClear,
    onAssign,
    onPriority,
    onStatus,
    onMerge,
    onDelete,
    onExport,
}: TicketsBulkBarProps) {
    const [assignOpen, setAssignOpen] = React.useState(false);
    return (
        <div className="flex flex-wrap items-center gap-2">
            <ZoruBadge variant="info">{count} selected</ZoruBadge>

            <ZoruSelect onValueChange={onStatus}>
                <ZoruSelectTrigger className="h-8 w-[150px]">
                    <ZoruSelectValue placeholder="Set status…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    {STATUS_OPTIONS.map((o) => (
                        <ZoruSelectItem key={o.value} value={o.value}>
                            {o.label}
                        </ZoruSelectItem>
                    ))}
                </ZoruSelectContent>
            </ZoruSelect>

            <ZoruSelect onValueChange={onPriority}>
                <ZoruSelectTrigger className="h-8 w-[150px]">
                    <ZoruSelectValue placeholder="Set priority…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    {PRIORITY_OPTIONS.map((o) => (
                        <ZoruSelectItem key={o.value} value={o.value}>
                            {o.label}
                        </ZoruSelectItem>
                    ))}
                </ZoruSelectContent>
            </ZoruSelect>

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

            <ZoruButton size="sm" variant="outline" onClick={onMerge}>
                Merge
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

/* ─── Saved views ────────────────────────────────────────────────────── */

export interface TicketsViewPreset {
    id: string;
    label: string;
    description?: string;
}

export const TICKETS_VIEW_PRESETS: TicketsViewPreset[] = [
    { id: 'all', label: 'All tickets', description: 'Default (no filters)' },
    {
        id: 'my-tickets',
        label: 'My tickets',
        description: 'Assigned to me',
    },
    {
        id: 'overdue',
        label: 'Overdue SLA',
        description: 'Due-by < now & not resolved',
    },
    {
        id: 'high-unassigned',
        label: 'High-priority unassigned',
        description: 'Priority ≥ high, no agent',
    },
    {
        id: 'resolved-30',
        label: 'Resolved (30d)',
        description: 'Resolved in last 30 days',
    },
];

export interface TicketsViewState {
    statusFilter: TicketStatusFilter;
    priorityFilter: string;
    severityFilter: string;
    channelFilter: string;
    categoryFilter: string;
    assigneeFilter: string;
    requesterKindFilter: TicketRequesterKind | 'all';
    dateRange?: DateRange;
    /** Filter callback layered on top of the server filter set. */
    clientPredicate?: (t: Record<string, unknown>) => boolean;
}

export function buildTicketsViewState(
    presetId: string,
    currentUserId: string | undefined,
): TicketsViewState {
    const base: TicketsViewState = {
        statusFilter: 'all',
        priorityFilter: '',
        severityFilter: '',
        channelFilter: '',
        categoryFilter: '',
        assigneeFilter: '',
        requesterKindFilter: 'all',
        dateRange: undefined,
    };

    switch (presetId) {
        case 'my-tickets':
            return {
                ...base,
                assigneeFilter: currentUserId ?? '',
            };
        case 'overdue':
            return {
                ...base,
                clientPredicate: (t) => {
                    const due = (t as { dueBy?: string }).dueBy;
                    const status = String((t as { status?: string }).status ?? '').toLowerCase();
                    if (!due) return false;
                    if (status === 'resolved' || status === 'closed') return false;
                    return new Date(due).getTime() < Date.now();
                },
            };
        case 'high-unassigned':
            return {
                ...base,
                clientPredicate: (t) => {
                    const p = String((t as { priority?: string }).priority ?? '').toLowerCase();
                    const a = (t as { assigneeId?: string }).assigneeId;
                    return (p === 'high' || p === 'critical') && !a;
                },
            };
        case 'resolved-30': {
            const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
            return {
                ...base,
                statusFilter: 'resolved',
                clientPredicate: (t) => {
                    const ts =
                        (t as { updatedAt?: string }).updatedAt ??
                        (t as { audit?: { updatedAt?: string } }).audit?.updatedAt;
                    if (!ts) return false;
                    return new Date(ts).getTime() >= cutoff;
                },
            };
        }
        default:
            return base;
    }
}

export interface TicketsViewsMenuProps {
    activePresetId?: string;
    onSelect: (presetId: string) => void;
}

export function TicketsViewsMenu({ activePresetId, onSelect }: TicketsViewsMenuProps) {
    const active =
        TICKETS_VIEW_PRESETS.find((p) => p.id === activePresetId) ??
        TICKETS_VIEW_PRESETS[0];
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
                {TICKETS_VIEW_PRESETS.map((preset) => (
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
