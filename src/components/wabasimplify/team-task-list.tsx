'use client';

import { useTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { updateTeamTaskStatus, deleteTeamTask } from '@/app/actions/team-tasks.actions';
import type { WithId, TeamTask } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { format, isPast } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const priorityConfig = {
    High: { color: 'bg-red-500', label: 'High' },
    Medium: { color: 'bg-yellow-500', label: 'Medium' },
    Low: { color: 'bg-green-500', label: 'Low' },
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
            <CardContent className="p-0">
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-40">Status</TableHead>
                                <TableHead>Task</TableHead>
                                <TableHead>Assigned To</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tasks.length > 0 ? (
                                tasks.map(task => {
                                    const { color, label } = priorityConfig[task.priority] || priorityConfig.Medium;
                                    const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'Completed';

                                    return (
                                        <TableRow key={task._id.toString()} className={cn(isUpdating && 'opacity-50')}>
                                            <TableCell>
                                                <Select value={task.status} onValueChange={(val) => handleStatusChange(task._id.toString(), val as any)}>
                                                    <SelectTrigger className={cn(
                                                        'h-8 text-xs w-32',
                                                        task.status === 'Completed' && 'border-green-500 text-green-600',
                                                        task.status === 'In Progress' && 'border-blue-500 text-blue-600'
                                                    )}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="To-Do">To-Do</SelectItem>
                                                        <SelectItem value="In Progress">In Progress</SelectItem>
                                                        <SelectItem value="Completed">Completed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <p className={cn("font-medium", task.status === 'Completed' && 'line-through text-muted-foreground')}>
                                                    {task.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                                            </TableCell>
                                            <TableCell>
                                                {task.assignedTo ? (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarImage src={task.assigneeAvatar || ''} />
                                                            <AvatarFallback>{task.assigneeName?.charAt(0) || 'U'}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm text-muted-foreground">{task.assigneeName || 'Unknown'}</span>
                                                    </div>
                                                ) : <span className="text-xs text-muted-foreground">Unassigned</span>}
                                            </TableCell>
                                            <TableCell>
                                                <span className={cn('text-sm', isOverdue && 'text-red-500 font-semibold')}>
                                                    {task.dueDate ? format(new Date(task.dueDate), 'PPP') : 'No due date'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`${color} text-white border-0`}>{label}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(task._id.toString())} disabled={isUpdating}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No tasks in this category.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
