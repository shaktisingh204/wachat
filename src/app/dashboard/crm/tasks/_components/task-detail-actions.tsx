'use client';

import { Button, useToast } from '@/components/sabcrm/20ui';
import {
  useRouter } from 'next/navigation';
import { CheckCircle2,
  Trash2 } from 'lucide-react';

/**
 * <TaskDetailActions> — Complete · Delete.
 */

import * as React from 'react';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
    completeTask,
    deleteTaskRust,
} from '@/app/actions/crm-tasks-rust.actions';

interface TaskDetailActionsProps {
    taskId: string;
    status?: string;
}

export function TaskDetailActions({ taskId, status }: TaskDetailActionsProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [, startTransition] = React.useTransition();
    const [deleteOpen, setDeleteOpen] = React.useState(false);

    const handleComplete = () => {
        startTransition(async () => {
            const res = await completeTask(taskId);
            if (res.success) {
                toast({ title: 'Task completed' });
                router.refresh();
            } else {
                toast({
                    title: 'Complete failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            {status !== 'Completed' ? (
                <Button variant="outline" onClick={handleComplete}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Complete
                </Button>
            ) : null}
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4 text-[var(--st-text)]" /> Delete
            </Button>

            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Delete this task?"
                description="The task and its checklist/attachments are removed permanently."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={async () => {
                    const res = await deleteTaskRust(taskId);
                    if (res.success) {
                        toast({ title: 'Task deleted' });
                        router.push('/dashboard/crm/tasks');
                    } else {
                        toast({
                            title: 'Delete failed',
                            description: res.error,
                            variant: 'destructive',
                        });
                        throw new Error(res.error ?? 'Failed');
                    }
                }}
            />
        </>
    );
}
