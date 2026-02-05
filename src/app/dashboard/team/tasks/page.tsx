'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getTeamTasks } from '@/app/actions/team-tasks.actions';
import { getInvitedUsers } from '@/app/actions/team.actions';
import { getSession } from '@/app/actions/user.actions';
import type { WithId, TeamTask, User } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FolderKanban } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamTaskList } from '@/components/wabasimplify/team-task-list';
import { CreateTeamTaskDialog } from '@/components/wabasimplify/create-team-task-dialog';

function TasksPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96 mt-2" /></div>
            <Skeleton className="h-[500px] w-full" />
        </div>
    );
}

export default function TeamTasksPage() {
    const [user, setUser] = useState<User | null>(null);
    const [tasks, setTasks] = useState<(WithId<TeamTask> & { assigneeName?: string, assigneeAvatar?: string })[]>([]);
    const [teamMembers, setTeamMembers] = useState<WithId<User>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const router = useRouter();

    const fetchData = () => {
        startLoading(async () => {
            const [sessionData, tasksData, teamMembersData] = await Promise.all([getSession(), getTeamTasks(), getInvitedUsers()]);
            setUser(sessionData?.user || null);
            setTeamMembers(teamMembersData);

            // Enrich tasks with assignee names
            const enrichedTasks = tasksData.map(task => {
                const assignee = teamMembersData.find((m: any) => m._id.toString() === task.assignedTo?.toString());
                return {
                    ...task,
                    assigneeName: assignee?.name,
                    assigneeAvatar: assignee ? `https://i.pravatar.cc/150?u=${assignee.email}` : undefined
                };
            });
            setTasks(enrichedTasks);
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
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><FolderKanban /> Team Tasks</h1>
                    <p className="text-muted-foreground">Manage and assign tasks to your team members.</p>
                </div>
                <CreateTeamTaskDialog onTaskCreated={fetchData} teamMembers={teamMembers} />
            </div>

            <Tabs defaultValue="todo" className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="todo">To-Do ({todoTasks.length})</TabsTrigger>
                    <TabsTrigger value="inProgress">In Progress ({inProgressTasks.length})</TabsTrigger>
                    <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="todo" className="flex-1 mt-4">
                    <TeamTaskList tasks={todoTasks} onTaskUpdated={fetchData} />
                </TabsContent>
                <TabsContent value="inProgress" className="flex-1 mt-4">
                    <TeamTaskList tasks={inProgressTasks} onTaskUpdated={fetchData} />
                </TabsContent>
                <TabsContent value="completed" className="flex-1 mt-4">
                    <TeamTaskList tasks={completedTasks} onTaskUpdated={fetchData} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
