
'use client';

import { useTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, isPast, isToday } from 'date-fns';
import { Calendar, Trash2, Flag, Mail, Phone, MessageSquare } from 'lucide-react';
import { updateCrmTaskStatus, deleteCrmTask } from '@/app/actions/crm-tasks.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId, CrmTask } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const priorityConfig = {
    High: { color: 'bg-red-500', label: 'High' },
    Medium: { color: 'bg-yellow-500', label: 'Medium' },
    Low: { color: 'bg-green-500', label: 'Low' },
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
            <CardContent className="p-0">
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-40">Status</TableHead>
                                <TableHead>Task</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tasks.length > 0 ? (
                                tasks.map(task => {
                                    const { color, label } = priorityConfig[task.priority] || priorityConfig.Medium;
                                    const TypeIcon = typeConfig[task.type]?.icon || MessageSquare;
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
                                                <p className="text-xs text-muted-foreground">{task.description}</p>
                                            </TableCell>
                                            <TableCell>
                                                 <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger><TypeIcon className="h-4 w-4 text-muted-foreground"/></TooltipTrigger>
                                                        <TooltipContent>{task.type}</TooltipContent>
                                                    </Tooltip>
                                                 </TooltipProvider>
                                            </TableCell>
                                            <TableCell>
                                                <span className={cn('text-sm', isOverdue && 'text-red-500 font-semibold')}>
                                                    {task.dueDate ? format(new Date(task.dueDate), 'PPP') : 'No due date'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge style={{ backgroundColor: color }} className="text-white">{label}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(task._id.toString())} disabled={isUpdating}>
                                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">No tasks in this category.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
