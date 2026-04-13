'use client';

import { useEffect, useState, useTransition } from 'react';
import { FolderKanban } from 'lucide-react';

import { getCrmTasks } from '@/app/actions/crm-tasks.actions';
import { getSession } from '@/app/actions/user.actions';
import type { WithId, CrmTask, User } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CrmTaskList } from '@/components/wabasimplify/crm-task-list';
import { CreateTaskDialog } from '@/components/wabasimplify/crm-create-task-dialog';

import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../_components/crm-page-header';

function TasksPageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>
      <Skeleton className="h-[500px] w-full rounded-clay-lg" />
    </div>
  );
}

export default function TasksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<WithId<CrmTask>[]>([]);
  const [isLoading, startLoading] = useTransition();

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

  if ((isLoading && tasks.length === 0) || !user) {
    return <TasksPageSkeleton />;
  }

  const todoTasks = tasks.filter((t) => t.status === 'To-Do');
  const inProgressTasks = tasks.filter((t) => t.status === 'In Progress');
  const completedTasks = tasks.filter((t) => t.status === 'Completed');

  return (
    <div className="flex h-full w-full flex-col gap-6">
      <CrmPageHeader
        title="Tasks"
        subtitle="Organize and track your sales and support tasks."
        icon={FolderKanban}
        actions={<CreateTaskDialog onTaskCreated={fetchData} />}
      />

      <ClayCard padded={false} className="flex min-h-0 flex-1 flex-col p-5">
        <Tabs defaultValue="todo" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="grid w-full grid-cols-3 bg-clay-surface-2">
            <TabsTrigger value="todo">To-Do ({todoTasks.length})</TabsTrigger>
            <TabsTrigger value="inProgress">In Progress ({inProgressTasks.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="todo" className="mt-4 flex-1">
            <CrmTaskList tasks={todoTasks} onTaskUpdated={fetchData} />
          </TabsContent>
          <TabsContent value="inProgress" className="mt-4 flex-1">
            <CrmTaskList tasks={inProgressTasks} onTaskUpdated={fetchData} />
          </TabsContent>
          <TabsContent value="completed" className="mt-4 flex-1">
            <CrmTaskList tasks={completedTasks} onTaskUpdated={fetchData} />
          </TabsContent>
        </Tabs>
      </ClayCard>
    </div>
  );
}
