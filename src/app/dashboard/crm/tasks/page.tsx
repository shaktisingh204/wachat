
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getCrmTasks } from '@/app/actions/crm-tasks.actions';
import type { WithId, CrmTask } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, FolderKan, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CrmTaskList } from '@/components/wabasimplify/crm-task-list';
import { CrmCreateTaskDialog } from '@/components/wabasimplify/crm-create-task-dialog';

function TasksPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96 mt-2" /></div>
            <Skeleton className="h-[500px] w-full" />
        </div>
    );
}

export default function TasksPage() {
    const [tasks, setTasks] = useState<WithId<CrmTask>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);

    const fetchData = () => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            setProjectId(storedProjectId);
            startLoading(async () => {
                const tasksData = await getCrmTasks(storedProjectId);
                setTasks(tasksData);
            });
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (isLoading && tasks.length === 0) {
        return <TasksPageSkeleton />;
    }
    
    if (!projectId) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage its tasks.</AlertDescription>
            </Alert>
        );
    }
    
    const todoTasks = tasks.filter(t => t.status === 'To-Do');
    const inProgressTasks = tasks.filter(t => t.status === 'In Progress');
    const completedTasks = tasks.filter(t => t.status === 'Completed');

    return (
        <div className="flex flex-col gap-8 h-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><FolderKan /> Tasks</h1>
                    <p className="text-muted-foreground">Organize and track your sales and support tasks.</p>
                </div>
                 <CrmCreateTaskDialog projectId={projectId} onTaskCreated={fetchData} />
            </div>
            
            <Tabs defaultValue="todo" className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="todo">To-Do ({todoTasks.length})</TabsTrigger>
                    <TabsTrigger value="inProgress">In Progress ({inProgressTasks.length})</TabsTrigger>
                    <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="todo" className="flex-1 mt-4">
                    <CrmTaskList tasks={todoTasks} onTaskUpdated={fetchData} />
                </TabsContent>
                <TabsContent value="inProgress" className="flex-1 mt-4">
                    <CrmTaskList tasks={inProgressTasks} onTaskUpdated={fetchData} />
                </TabsContent>
                <TabsContent value="completed" className="flex-1 mt-4">
                     <CrmTaskList tasks={completedTasks} onTaskUpdated={fetchData} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
