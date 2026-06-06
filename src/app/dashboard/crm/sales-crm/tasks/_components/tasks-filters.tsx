'use client';

import { Badge, Button, Card, CardBody, DateRangePicker, Label } from '@/components/sabcrm/20ui/compat';
import {
  CheckCircle2,
  Clock,
  MoonStar,
  Trash2,
  UserPlus,
  X } from 'lucide-react';

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

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import type { TaskLinkedKind } from '@/app/actions/crm-tasks.actions.types';

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
        <Card>
            <CardBody className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3 lg:grid-cols-6">
                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Status
                    </Label>
                    <EnumFilterField
                        enumName="taskStatusLegacy"
                        value={props.statusFilter}
                        onChange={(v) => props.onStatusChange(v as TaskStatusFilter)}
                        allLabel="All statuses"
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Priority
                    </Label>
                    <EnumFilterField
                        enumName="priorityLegacy"
                        value={props.priorityFilter || 'all'}
                        onChange={(v) =>
                            props.onPriorityChange((v === 'all' ? '' : v) as TaskPriorityFilter)
                        }
                        allLabel="Any priority"
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Type
                    </Label>
                    <EnumFilterField
                        enumName="taskType"
                        value={props.typeFilter || 'all'}
                        onChange={(v) =>
                            props.onTypeChange((v === 'all' ? '' : v) as TaskTypeFilter)
                        }
                        allLabel="Any type"
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Assignee
                    </Label>
                    <EntityFormField
                        entity="user"
                        name="assigneeFilter"
                        initialId={props.assigneeFilter || null}
                        placeholder="Any assignee"
                        onChange={(next) => props.onAssigneeChange(next ?? '')}
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Linked to
                    </Label>
                    <EnumFilterField
                        enumName="linkedEntityKind"
                        value={props.linkedKindFilter || 'all'}
                        onChange={(v) =>
                            props.onLinkedKindChange(
                                (v === 'all' ? '' : v) as TaskLinkedKind | '',
                            )
                        }
                        allLabel="Any link"
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Due
                    </Label>
                    <DateRangePicker
                        value={props.dateRange}
                        onChange={(r) => props.onDateRangeChange(r)}
                    />
                </div>

                {props.hasActiveFilters ? (
                    <div className="flex items-end md:col-span-3 lg:col-span-6">
                        <Button variant="ghost" size="sm" onClick={props.onClear}>
                            <X className="h-3.5 w-3.5" /> Clear filters
                        </Button>
                    </div>
                ) : null}
            </CardBody>
        </Card>
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
            <Badge variant="info">{count} selected</Badge>
            <Button size="sm" variant="outline" onClick={onComplete}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark complete
            </Button>
            <Button size="sm" variant="outline" onClick={onSnoozeDay}>
                <Clock className="h-3.5 w-3.5" /> Snooze +1d
            </Button>
            <Button size="sm" variant="outline" onClick={onSnoozeWeek}>
                <MoonStar className="h-3.5 w-3.5" /> Snooze +1w
            </Button>
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
                    <Button
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
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAssignOpen(false)}>
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ) : (
                <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                    <UserPlus className="h-3.5 w-3.5" /> Assign to…
                </Button>
            )}
            <Button size="sm" variant="outline" onClick={onExport}>
                Export CSV
            </Button>
            <Button size="sm" variant="destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={onClear}>
                Clear
            </Button>
        </div>
    );
}
