'use client';

import {
  ZoruButton,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from '@/components/zoruui';
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
            <ZoruButton asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/sales-crm/tasks/${taskId}/edit`}>
                    <Edit className="h-3.5 w-3.5" /> Edit
                </Link>
            </ZoruButton>
            <ZoruButton
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
            </ZoruButton>
            <ZoruDropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                    <ZoruButton variant="outline" size="sm" disabled={snoozing}>
                        {snoozing ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Clock className="h-3.5 w-3.5" />
                        )}
                        Snooze <ChevronDown className="h-3 w-3" />
                    </ZoruButton>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end">
                    <ZoruDropdownMenuLabel>Push the due date forward</ZoruDropdownMenuLabel>
                    <ZoruDropdownMenuItem onClick={() => onSnooze(1)}>
                        +1 hour
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuItem onClick={() => onSnooze(24)}>
                        +1 day
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuItem onClick={() => onSnooze(24 * 3)}>
                        +3 days
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuItem onClick={() => onSnooze(24 * 7)}>
                        +1 week
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuSeparator />
                    <ZoruDropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/sales-crm/tasks/${taskId}/edit`}>
                            Custom date in editor
                        </Link>
                    </ZoruDropdownMenuItem>
                </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
            <ZoruButton variant="outline" size="sm" onClick={onReassign}>
                <UserPlus className="h-3.5 w-3.5" /> Reassign
            </ZoruButton>
            {assigneeEmail ? (
                <ZoruButton asChild variant="outline" size="sm">
                    <a href={`mailto:${assigneeEmail}`}>
                        <Mail className="h-3.5 w-3.5" /> Email assignee
                    </a>
                </ZoruButton>
            ) : null}
            <ZoruButton variant="outline" size="sm" onClick={onArchive}>
                <Archive className="h-3.5 w-3.5" /> {archived ? 'Restore' : 'Archive'}
            </ZoruButton>
            <ZoruButton asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/sales-crm/tasks/${taskId}/activity`}>
                    <Activity className="h-3.5 w-3.5" /> Activity
                </Link>
            </ZoruButton>
            <ZoruButton variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </ZoruButton>
        </div>
    );
}

export default TaskDetailActions;
