'use client';

/**
 * Filter row + bulk action bar for the tasks list page.
 *
 * Extracted to keep `page.tsx` under the 600-line scope cap.
 * Pure presentation — every concrete filter value is supplied by the
 * parent. The bulk bar emits semantic callbacks the parent maps onto
 * `bulkCrmTaskAction(...)` calls.
 */

import * as React from 'react';
import type { DateRange } from 'react-day-picker';
import { CheckCircle2, Clock, MoonStar, Trash2, UserPlus, X } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruCardContent,
    ZoruDateRangePicker,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import type { TaskLinkedKind } from '@/app/actions/crm-tasks.actions';

export type TaskStatusFilter =
    | 'all'
    | 'To-Do'
    | 'In Progress'
    | 'Completed';

export type TaskPriorityFilter = '' | 'Low' | 'Medium' | 'High';

export type TaskTypeFilter =
    | ''
    | 'Call'
    | 'Email'
    | 'Meeting'
    | 'Follow-up'
    | 'Demo'
    | 'Other';

export interface TasksFiltersRowProps {
    statusFilter: TaskStatusFilter;
    onStatusChange: (v: TaskStatusFilter) => void;
    priorityFilter: TaskPriorityFilter;
    onPriorityChange: (v: TaskPriorityFilter) => void;
    typeFilter: TaskTypeFilter;
    onTypeChange: (v: TaskTypeFilter) => void;
    assigneeFilter: string;
    onAssigneeChange: (v: string) => void;
    linkedKindFilter: TaskLinkedKind | '';
    onLinkedKindChange: (v: TaskLinkedKind | '') => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (r: DateRange | undefined) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function TasksFiltersRow(props: TasksFiltersRowProps) {
    return (
        <ZoruCard>
            <ZoruCardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3 lg:grid-cols-6">
                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Status
                    </ZoruLabel>
                    <ZoruSelect
                        value={props.statusFilter}
                        onValueChange={(v) => props.onStatusChange(v as TaskStatusFilter)}
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">All</ZoruSelectItem>
                            <ZoruSelectItem value="To-Do">To-Do</ZoruSelectItem>
                            <ZoruSelectItem value="In Progress">In Progress</ZoruSelectItem>
                            <ZoruSelectItem value="Completed">Completed</ZoruSelectItem>
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Priority
                    </ZoruLabel>
                    <ZoruSelect
                        value={props.priorityFilter || 'all'}
                        onValueChange={(v) =>
                            props.onPriorityChange((v === 'all' ? '' : v) as TaskPriorityFilter)
                        }
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">Any</ZoruSelectItem>
                            <ZoruSelectItem value="High">High</ZoruSelectItem>
                            <ZoruSelectItem value="Medium">Medium</ZoruSelectItem>
                            <ZoruSelectItem value="Low">Low</ZoruSelectItem>
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Type
                    </ZoruLabel>
                    <ZoruSelect
                        value={props.typeFilter || 'all'}
                        onValueChange={(v) =>
                            props.onTypeChange((v === 'all' ? '' : v) as TaskTypeFilter)
                        }
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">Any</ZoruSelectItem>
                            <ZoruSelectItem value="Call">Call</ZoruSelectItem>
                            <ZoruSelectItem value="Email">Email</ZoruSelectItem>
                            <ZoruSelectItem value="Meeting">Meeting</ZoruSelectItem>
                            <ZoruSelectItem value="Follow-up">Follow-up</ZoruSelectItem>
                            <ZoruSelectItem value="Demo">Demo</ZoruSelectItem>
                            <ZoruSelectItem value="Other">Other</ZoruSelectItem>
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Assignee
                    </ZoruLabel>
                    <EntityFormField
                        entity="user"
                        name="assigneeFilter"
                        initialId={props.assigneeFilter || null}
                        placeholder="Any assignee"
                        onChange={(next) => props.onAssigneeChange(next ?? '')}
                    />
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Linked to
                    </ZoruLabel>
                    <ZoruSelect
                        value={props.linkedKindFilter || 'all'}
                        onValueChange={(v) =>
                            props.onLinkedKindChange(
                                (v === 'all' ? '' : v) as TaskLinkedKind | '',
                            )
                        }
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">Any</ZoruSelectItem>
                            <ZoruSelectItem value="lead">Leads</ZoruSelectItem>
                            <ZoruSelectItem value="deal">Deals</ZoruSelectItem>
                            <ZoruSelectItem value="client">Clients</ZoruSelectItem>
                            <ZoruSelectItem value="contact">Contacts</ZoruSelectItem>
                            <ZoruSelectItem value="ticket">Tickets</ZoruSelectItem>
                            <ZoruSelectItem value="invoice">Invoices</ZoruSelectItem>
                            <ZoruSelectItem value="none">No link</ZoruSelectItem>
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Due
                    </ZoruLabel>
                    <ZoruDateRangePicker
                        value={props.dateRange}
                        onChange={(r) => props.onDateRangeChange(r)}
                    />
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

export interface TasksBulkBarProps {
    count: number;
    onClear: () => void;
    onComplete: () => void;
    onSnoozeDay: () => void;
    onSnoozeWeek: () => void;
    onAssignTo: (userId: string) => void;
    onDelete: () => void;
    onExport: () => void;
}

export function TasksBulkBar({
    count,
    onClear,
    onComplete,
    onSnoozeDay,
    onSnoozeWeek,
    onAssignTo,
    onDelete,
    onExport,
}: TasksBulkBarProps) {
    const [assignOpen, setAssignOpen] = React.useState(false);
    const [assignTarget, setAssignTarget] = React.useState<string>('');

    return (
        <div className="flex flex-wrap items-center gap-2">
            <ZoruBadge variant="info">{count} selected</ZoruBadge>
            <ZoruButton size="sm" variant="outline" onClick={onComplete}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark complete
            </ZoruButton>
            <ZoruButton size="sm" variant="outline" onClick={onSnoozeDay}>
                <Clock className="h-3.5 w-3.5" /> Snooze +1d
            </ZoruButton>
            <ZoruButton size="sm" variant="outline" onClick={onSnoozeWeek}>
                <MoonStar className="h-3.5 w-3.5" /> Snooze +1w
            </ZoruButton>
            {assignOpen ? (
                <div className="flex items-center gap-1">
                    <div className="w-48">
                        <EntityFormField
                            entity="user"
                            name="assignTarget"
                            initialId={assignTarget || null}
                            placeholder="Pick user…"
                            onChange={(next) => setAssignTarget(next ?? '')}
                        />
                    </div>
                    <ZoruButton
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            if (assignTarget) {
                                onAssignTo(assignTarget);
                                setAssignOpen(false);
                                setAssignTarget('');
                            }
                        }}
                    >
                        Assign
                    </ZoruButton>
                    <ZoruButton size="sm" variant="ghost" onClick={() => setAssignOpen(false)}>
                        <X className="h-3.5 w-3.5" />
                    </ZoruButton>
                </div>
            ) : (
                <ZoruButton size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                    <UserPlus className="h-3.5 w-3.5" /> Assign to…
                </ZoruButton>
            )}
            <ZoruButton size="sm" variant="outline" onClick={onExport}>
                Export CSV
            </ZoruButton>
            <ZoruButton size="sm" variant="destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </ZoruButton>
            <ZoruButton size="sm" variant="ghost" onClick={onClear}>
                Clear
            </ZoruButton>
        </div>
    );
}
