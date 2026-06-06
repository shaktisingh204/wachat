'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/sabcrm/20ui/compat';
import {
  Activity,
  Archive,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit,
  LoaderCircle,
  Mail,
  Trash2,
  UserPlus,
  } from 'lucide-react';

/**
 * Header action group for the task detail page (extracted to keep
 * `[id]/page.tsx` under the 600-line scope cap).
 *
 * Eight clickable affordances plus a destructive delete:
 *   Edit · Complete · Snooze (dropdown) · Reassign · Email assignee ·
 *   Archive · Activity · Delete.
 */

import * as React from 'react';
import Link from 'next/link';

export interface TaskDetailActionsProps {
    taskId: string;
    completed: boolean;
    archived: boolean;
    completing: boolean;
    snoozing: boolean;
    assigneeEmail?: string | null;
    onComplete: () => void;
    onSnooze: (hours: number) => void;
    onReassign: () => void;
    onArchive: () => void;
    onDelete: () => void;
}

export function TaskDetailActions({
    taskId,
    completed,
    archived,
    completing,
    snoozing,
    assigneeEmail,
    onComplete,
    onSnooze,
    onReassign,
    onArchive,
    onDelete,
}: TaskDetailActionsProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/sales-crm/tasks/${taskId}/edit`}>
                    <Edit className="h-3.5 w-3.5" /> Edit
                </Link>
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={onComplete}
                disabled={completing || completed}
            >
                {completing ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Complete
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={snoozing}>
                        {snoozing ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Clock className="h-3.5 w-3.5" />
                        )}
                        Snooze <ChevronDown className="h-3 w-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Push the due date forward</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onSnooze(1)}>
                        +1 hour
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSnooze(24)}>
                        +1 day
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSnooze(24 * 3)}>
                        +3 days
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSnooze(24 * 7)}>
                        +1 week
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/sales-crm/tasks/${taskId}/edit`}>
                            Custom date in editor
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={onReassign}>
                <UserPlus className="h-3.5 w-3.5" /> Reassign
            </Button>
            {assigneeEmail ? (
                <Button asChild variant="outline" size="sm">
                    <a href={`mailto:${assigneeEmail}`}>
                        <Mail className="h-3.5 w-3.5" /> Email assignee
                    </a>
                </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={onArchive}>
                <Archive className="h-3.5 w-3.5" /> {archived ? 'Restore' : 'Archive'}
            </Button>
            <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/sales-crm/tasks/${taskId}/activity`}>
                    <Activity className="h-3.5 w-3.5" /> Activity
                </Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
        </div>
    );
}

export default TaskDetailActions;
