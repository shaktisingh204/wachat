'use client';

import {
  Card,
  ZoruCardContent,
  Button,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Badge,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Progress,
} from '@/components/zoruui';
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
    High: { color: 'bg-zoru-ink', label: 'High' },
    Medium: { color: 'bg-zoru-ink', label: 'Medium' },
    Low: { color: 'bg-zoru-ink', label: 'Low' },
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
            <ZoruCardContent className="p-0">
                <div className="border rounded-md">
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow>
                                <ZoruTableHead className="w-40">Status</ZoruTableHead>
                                <ZoruTableHead>Task</ZoruTableHead>
                                <ZoruTableHead>Assigned To</ZoruTableHead>
                                <ZoruTableHead>Due Date</ZoruTableHead>
                                <ZoruTableHead>Priority</ZoruTableHead>
                                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {tasks.length > 0 ? (
                                tasks.map(task => {
                                    const { color, label } = priorityConfig[task.priority] || priorityConfig.Medium;
                                    const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'Completed';

                                    return (
                                        <ZoruTableRow key={task._id.toString()} className={cn(isUpdating && 'opacity-50')}>
                                            <ZoruTableCell>
                                                <Select value={task.status} onValueChange={(val) => handleStatusChange(task._id.toString(), val as any)}>
                                                    <ZoruSelectTrigger className={cn(
                                                        'h-8 text-xs w-32',
                                                        task.status === 'Completed' && 'border-zoru-line text-zoru-ink',
                                                        task.status === 'In Progress' && 'border-zoru-line text-zoru-ink'
                                                    )}>
                                                        <ZoruSelectValue />
                                                    </ZoruSelectTrigger>
                                                    <ZoruSelectContent>
                                                        <ZoruSelectItem value="To-Do">To-Do</ZoruSelectItem>
                                                        <ZoruSelectItem value="In Progress">In Progress</ZoruSelectItem>
                                                        <ZoruSelectItem value="Completed">Completed</ZoruSelectItem>
                                                    </ZoruSelectContent>
                                                </Select>
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <p className={cn("font-medium", task.status === 'Completed' && 'line-through text-zoru-ink-muted')}>
                                                    {task.title}
                                                </p>
                                                <p className="text-xs text-zoru-ink-muted line-clamp-1">{task.description}</p>
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                {task.assignedTo ? (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <ZoruAvatarImage src={task.assigneeAvatar || ''} />
                                                            <ZoruAvatarFallback>{task.assigneeName?.charAt(0) || 'U'}</ZoruAvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm text-zoru-ink-muted">{task.assigneeName || 'Unknown'}</span>
                                                    </div>
                                                ) : <span className="text-xs text-zoru-ink-muted">Unassigned</span>}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <span className={cn('text-sm', isOverdue && 'text-zoru-ink font-semibold')}>
                                                    {task.dueDate ? format(new Date(task.dueDate), 'PPP') : 'No due date'}
                                                </span>
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <Badge className={`${color} text-white border-0`}>{label}</Badge>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(task._id.toString())} disabled={isUpdating}>
                                                    <Trash2 className="h-4 w-4 text-zoru-ink" />
                                                </Button>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    )
                                })
                            ) : (
                                <ZoruTableRow>
                                    <ZoruTableCell colSpan={6} className="h-24 text-center text-zoru-ink-muted">No tasks in this category.</ZoruTableCell>
                                </ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </Table>
                </div>
            </ZoruCardContent>
        </Card>
    );
}
