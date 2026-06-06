'use client';

import { useState, useTransition } from 'react';
import { Button, Input, Textarea, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SheetFooter } from '@/components/sabcrm/20ui';
import { useToast } from '@/components/sabcrm/20ui';
import { assignTaskToEmployee } from '@/app/actions/hrm-portal.actions';
import type { CrmTask } from '@/lib/definitions';
import type { PortalTeamMember } from '@/app/actions/hrm-portal.actions.types';

type Priority = CrmTask['priority'];
const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];

interface AssignTaskFormProps {
    employee: PortalTeamMember;
    onCancel: () => void;
    onSuccess: () => void;
}

export function AssignTaskForm({ employee, onCancel, onSuccess }: AssignTaskFormProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState<Priority>('Medium');

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!title.trim()) {
            toast({ title: 'Title required', description: 'Please enter a task title.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            const result = await assignTaskToEmployee(employee._id, {
                title: title.trim(),
                description: description.trim() || undefined,
                dueDate: dueDate || undefined,
                priority,
            });

            if (result.success) {
                toast({
                    title: 'Task assigned',
                    description: `Task assigned to ${employee.firstName} ${employee.lastName}.`,
                });
                onSuccess();
            } else {
                toast({
                    title: 'Failed to assign task',
                    description: result.error ?? 'Something went wrong.',
                    variant: 'destructive',
                });
            }
        });
    }

    return (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5 px-1">
            <div className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-3">
                <p className="text-[12px] font-medium text-[var(--st-text-secondary)] mb-0.5">Assignee</p>
                <p className="text-[14px] font-medium text-[var(--st-text)]">
                    {employee.firstName} {employee.lastName}
                </p>
                {employee.designationName && (
                    <p className="text-[12px] text-[var(--st-text-secondary)]">{employee.designationName}</p>
                )}
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-title">
                    Task title <span className="text-[var(--st-danger)]">*</span>
                </Label>
                <Input
                    id="task-title"
                    placeholder="e.g. Prepare Q2 report"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    disabled={isPending}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-desc">Description</Label>
                <Textarea
                    id="task-desc"
                    placeholder="Optional details or instructions…"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isPending}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-due">Due date</Label>
                <Input
                    id="task-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={isPending}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                    value={priority}
                    onValueChange={(v) => setPriority(v as Priority)}
                    disabled={isPending}
                >
                    <SelectTrigger id="task-priority">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PRIORITIES.map((p) => (
                            <SelectItem key={p} value={p}>
                                {p}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <SheetFooter className="mt-2 flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    className="flex-1"
                    onClick={onCancel}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    disabled={isPending}
                    className="flex-1"
                >
                    {isPending ? 'Assigning…' : 'Assign Task'}
                </Button>
            </SheetFooter>
        </form>
    );
}
