'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getCrmTasks } from '@/app/actions/crm-tasks.actions';
import type { WithId, CrmTask, User } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, FolderKanban, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CrmTaskList } from '@/components/wabasimplify/crm-task-list';
import { CreateTaskDialog } from '@/components/wabasimplify/crm-create-task-dialog';
import { getSession } from '@/app/actions/index.ts';

function TasksPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96 mt-2" /></div>
            <Skeleton className="h-[500px] w-full" />
        </div>
    );
}

export default function TasksPage() {
    const [user, setUser] = useState<User | null>(null);
    const [tasks, setTasks] = useState<WithId<CrmTask>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const router = useRouter();

    const fetchData = () => {
        startLoading(async () => {
            const [sessionData, tasksData] = await Promise.all([getSession(), getCrmTasks()]);
            setUser(sessionData?.user || null);
            setTasks(tasksData);
        });
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (isLoading && tasks.length === 0) {
        return <TasksPageSkeleton />;
    }
    
    if (!user) {
        return <TasksPageSkeleton />;
    }
    
    const todoTasks = tasks.filter(t => t.status === 'To-Do');
    const inProgressTasks = tasks.filter(t => t.status === 'In Progress');
    const completedTasks = tasks.filter(t => t.status === 'Completed');

    return (
        <div className="flex flex-col gap-8 h-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><FolderKanban /> Tasks</h1>
                    <p className="text-muted-foreground">Organize and track your sales and support tasks.</p>
                </div>
                 <CreateTaskDialog onTaskCreated={fetchData} />
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
