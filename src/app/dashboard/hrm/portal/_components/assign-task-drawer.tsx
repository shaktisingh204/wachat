'use client';

import { useState, useTransition } from 'react';
import {
    Sheet,
    ZoruSheetContent,
    ZoruSheetHeader,
    ZoruSheetTitle,
    ZoruSheetDescription,
    ZoruSheetFooter,
    ZoruSheetClose,
    Button,
    Input,
    Textarea,
    Label,
    Select,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruSelectContent,
    ZoruSelectItem,
} from '@/components/zoruui';
import { useZoruToast } from '@/components/zoruui';
import { assignTaskToEmployee } from '@/app/actions/hrm-portal.actions';
import type { PortalTeamMember } from '@/app/actions/hrm-portal.actions';
import type { CrmTask } from '@/lib/definitions';

interface AssignTaskDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employee: PortalTeamMember | null;
    onSuccess?: () => void;
}

type Priority = CrmTask['priority'];

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];

export function AssignTaskDrawer({
    open,
    onOpenChange,
    employee,
    onSuccess,
}: AssignTaskDrawerProps) {
    const { toast } = useZoruToast();
    const [isPending, startTransition] = useTransition();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState<Priority>('Medium');

    function reset() {
        setTitle('');
        setDescription('');
        setDueDate('');
        setPriority('Medium');
    }

    function handleOpenChange(next: boolean) {
        if (!next) reset();
        onOpenChange(next);
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!employee) return;

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
                handleOpenChange(false);
                onSuccess?.();
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
        <Sheet open={open} onOpenChange={handleOpenChange}>
            <ZoruSheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <ZoruSheetHeader>
                    <ZoruSheetTitle>Assign Task</ZoruSheetTitle>
                    <ZoruSheetDescription>
                        {employee
                            ? `Assigning task to ${employee.firstName} ${employee.lastName}`
                            : 'Select a team member to assign a task.'}
                    </ZoruSheetDescription>
                </ZoruSheetHeader>

                <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5 px-1">
                    {/* Assignee — read-only display */}
                    {employee && (
                        <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 px-4 py-3">
                            <p className="text-[12px] font-medium text-zoru-ink-muted mb-0.5">Assignee</p>
                            <p className="text-[14px] font-medium text-zoru-ink">
                                {employee.firstName} {employee.lastName}
                            </p>
                            {employee.designationName && (
                                <p className="text-[12px] text-zoru-ink-muted">{employee.designationName}</p>
                            )}
                        </div>
                    )}

                    {/* Title */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="task-title">
                            Task title <span className="text-zoru-danger-ink">*</span>
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

                    {/* Description */}
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

                    {/* Due date */}
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

                    {/* Priority */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="task-priority">Priority</Label>
                        <Select
                            value={priority}
                            onValueChange={(v) => setPriority(v as Priority)}
                            disabled={isPending}
                        >
                            <ZoruSelectTrigger id="task-priority">
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {PRIORITIES.map((p) => (
                                    <ZoruSelectItem key={p} value={p}>
                                        {p}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>

                    <ZoruSheetFooter className="mt-2 flex gap-2">
                        <ZoruSheetClose asChild>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isPending}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                        </ZoruSheetClose>
                        <Button
                            type="submit"
                            disabled={isPending || !employee}
                            className="flex-1"
                        >
                            {isPending ? 'Assigning…' : 'Assign Task'}
                        </Button>
                    </ZoruSheetFooter>
                </form>
            </ZoruSheetContent>
        </Sheet>
    );
}
