'use client';

import { Card, CardBody, Button, Table, TBody, Td, Th, THead, Tr, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Avatar, AvatarFallback, AvatarImage, Progress } from '@/components/sabcrm/20ui';
import {
  useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updateTeamTaskStatus,
  deleteTeamTask } from '@/app/actions/team-tasks.actions';
import type { WithId,
  TeamTask } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { format, isPast } from 'date-fns';
import { Trash2 } from 'lucide-react';

const priorityConfig = {
    High: { color: 'bg-[var(--st-text)]', label: 'High' },
    Medium: { color: 'bg-[var(--st-text)]', label: 'Medium' },
    Low: { color: 'bg-[var(--st-text)]', label: 'Low' },
};

export function TeamTaskList({ tasks, onTaskUpdated }: { tasks: (WithId<TeamTask> & { assigneeName?: string, assigneeAvatar?: string })[], onTaskUpdated: () => void }) {
    const [isUpdating, startTransition] = useTransition();
    const { toast } = useToast();

    const handleStatusChange = (taskId: string, newStatus: TeamTask['status']) => {
        startTransition(async () => {
            const result = await updateTeamTaskStatus(taskId, newStatus);
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
            const result = await deleteTeamTask(taskId);
            if (result.success) {
                toast({ title: 'Success', description: 'Task deleted.' });
                onTaskUpdated();
            } else {
                toast({ title: 'Error', description: 'Failed to delete task.', variant: 'destructive' });
            }
        })
    }

    return (
        <Card className="h-full border-none shadow-none">
            <CardBody className="p-0">
                <div className="border rounded-md">
                    <Table>
                        <THead>
                            <Tr>
                                <Th className="w-40">Status</Th>
                                <Th>Task</Th>
                                <Th>Assigned To</Th>
                                <Th>Due Date</Th>
                                <Th>Priority</Th>
                                <Th className="text-right">Actions</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {tasks.length > 0 ? (
                                tasks.map(task => {
                                    const { color, label } = priorityConfig[task.priority] || priorityConfig.Medium;
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
                                                <p className={cn("font-medium", task.status === 'Completed' && 'line-through text-[var(--st-text-secondary)]')}>
                                                    {task.title}
                                                </p>
                                                <p className="text-xs text-[var(--st-text-secondary)] line-clamp-1">{task.description}</p>
                                            </Td>
                                            <Td>
                                                {task.assignedTo ? (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarImage src={task.assigneeAvatar || ''} />
                                                            <AvatarFallback>{task.assigneeName?.charAt(0) || 'U'}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm text-[var(--st-text-secondary)]">{task.assigneeName || 'Unknown'}</span>
                                                    </div>
                                                ) : <span className="text-xs text-[var(--st-text-secondary)]">Unassigned</span>}
                                            </Td>
                                            <Td>
                                                <span className={cn('text-sm', isOverdue && 'text-[var(--st-text)] font-semibold')}>
                                                    {task.dueDate ? format(new Date(task.dueDate), 'PPP') : 'No due date'}
                                                </span>
                                            </Td>
                                            <Td>
                                                <Badge className={`${color} text-white border-0`}>{label}</Badge>
                                            </Td>
                                            <Td className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(task._id.toString())} disabled={isUpdating}>
                                                    <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
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
            </CardBody>
        </Card>
    );
}
