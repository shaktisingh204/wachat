'use client';

import { Badge, Button, Card, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, useToast } from '@/components/sabcrm/20ui';
import {
  useTransition } from 'react';

import { format, isPast, isToday } from 'date-fns';
import { Calendar, Trash2, Flag, Mail, Phone, MessageSquare } from 'lucide-react';
import { updateCrmTaskStatus, deleteCrmTask } from '@/app/actions/crm-tasks.actions';
import type { WithId, CrmTask } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { EntityRowLink } from '@/components/crm/entity-row-link';

const priorityConfig: Record<'High' | 'Medium' | 'Low', { variant: 'danger' | 'warning' | 'success'; label: string }> = {
    High: { variant: 'danger', label: 'High' },
    Medium: { variant: 'warning', label: 'Medium' },
    Low: { variant: 'success', label: 'Low' },
};

const typeConfig = {
    'Follow-up': { icon: MessageSquare },
    'Call': { icon: Phone },
    'Meeting': { icon: Calendar },
    'Email': { icon: Mail },
    'WhatsApp': { icon: MessageSquare },
};

export function CrmTaskList({ tasks, onTaskUpdated }: { tasks: WithId<CrmTask>[], onTaskUpdated: () => void }) {
    const [isUpdating, startTransition] = useTransition();
    const { toast } = useToast();

    const handleStatusChange = (taskId: string, newStatus: CrmTask['status']) => {
        startTransition(async () => {
            const result = await updateCrmTaskStatus(taskId, newStatus);
            if (result.success) {
                toast({ title: 'Success', description: `Task marked as ${newStatus}.` });
                onTaskUpdated();
            } else {
                toast({ title: 'Error', description: 'Failed to update task.', variant: 'destructive' });
            }
        });
    };

    const handleDelete = (taskId: string) => {
        startTransition(async () => {
            const result = await deleteCrmTask(taskId);
            if(result.success) {
                toast({title: 'Success', description: 'Task deleted.'});
                onTaskUpdated();
            } else {
                toast({title: 'Error', description: 'Failed to delete task.', variant: 'destructive'});
            }
        })
    }

    return (
        <Card className="h-full">
            <div className="p-0">
                <div className="border border-[var(--st-border)] rounded-lg">
                    <Table>
                        <THead>
                            <Tr>
                                <Th className="w-40">Status</Th>
                                <Th>Task</Th>
                                <Th>Type</Th>
                                <Th>Due Date</Th>
                                <Th>Priority</Th>
                                <Th className="text-right">Actions</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {tasks.length > 0 ? (
                                tasks.map(task => {
                                    const { variant, label } = priorityConfig[task.priority] || priorityConfig.Medium;
                                    const TypeIcon = typeConfig[task.type]?.icon || MessageSquare;
                                    const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'Completed';

                                    return (
                                        <Tr key={task._id.toString()} className={cn(isUpdating && 'opacity-50')}>
                                            <Td>
                                                <Select value={task.status} onValueChange={(val) => handleStatusChange(task._id.toString(), val as any)}>
                                                    <SelectTrigger className={cn(
                                                        'h-8 text-xs w-32',
                                                        task.status === 'Completed' && 'border-[var(--st-border)] text-[var(--st-text)]',
                                                        task.status === 'In Progress' && 'border-[var(--st-border)] text-[var(--st-text)]'
                                                    )}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="To-Do">To-Do</SelectItem>
                                                        <SelectItem value="In Progress">In Progress</SelectItem>
                                                        <SelectItem value="Completed">Completed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </Td>
                                            <Td>
                                                <EntityRowLink
                                                    href={`/dashboard/crm/tasks/${task._id.toString()}`}
                                                    label={
                                                        <span className={cn(task.status === 'Completed' && 'line-through text-[var(--st-text-secondary)]')}>
                                                            {task.title}
                                                        </span>
                                                    }
                                                    subtitle={task.description || undefined}
                                                />
                                            </Td>
                                            <Td>
                                                 <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger><TypeIcon className="h-4 w-4 text-[var(--st-text-secondary)]"/></TooltipTrigger>
                                                        <TooltipContent>{task.type}</TooltipContent>
                                                    </Tooltip>
                                                 </TooltipProvider>
                                            </Td>
                                            <Td>
                                                <span className={cn('text-sm', isOverdue ? 'text-[var(--st-danger)] font-semibold' : 'text-[var(--st-text)]')}>
                                                    {task.dueDate ? format(new Date(task.dueDate), 'PPP') : 'No due date'}
                                                </span>
                                            </Td>
                                            <Td>
                                                <Badge variant={variant}>{label}</Badge>
                                            </Td>
                                            <Td className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(task._id.toString())} disabled={isUpdating}>
                                                    <Trash2 className="h-4 w-4 text-[var(--st-danger)]"/>
                                                </Button>
                                            </Td>
                                        </Tr>
                                    )
                                })
                            ) : (
                                <Tr>
                                    <Td colSpan={6} className="h-24 text-center text-[var(--st-text-secondary)]">No tasks in this category.</Td>
                                </Tr>
                            )}
                        </TBody>
                    </Table>
                </div>
            </div>
        </Card>
    );
}
