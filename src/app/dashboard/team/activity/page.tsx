
'use client';

import { useState, useEffect, useTransition } from 'react';
import type { WithId, ActivityLog, ActivityAction } from '@/lib/definitions';
import { getActivityLogs } from '@/app/actions/activity.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock, FileText, UserPlus, UserMinus, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ActivityLogPage() {
    const [logs, setLogs] = useState<WithId<ActivityLog>[]>([]);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const { logs } = await getActivityLogs(undefined, 1, 50);
            setLogs(logs);
        });
    }, []);

    const getActionIcon = (action: string) => {
        if (action.includes('TASK')) return <FileText className="h-4 w-4 text-blue-500" />;
        if (action.includes('MEMBER')) return action.includes('INVITED') ? <UserPlus className="h-4 w-4 text-green-500" /> : <UserMinus className="h-4 w-4 text-red-500" />;
        if (action.includes('ROLE')) return <Shield className="h-4 w-4 text-purple-500" />;
        return <Activity className="h-4 w-4 text-gray-500" />;
    };

    const formatActionMessage = (log: ActivityLog) => {
        const { action, details } = log;
        switch (action) {
            case 'TASK_CREATED':
                return <span>Created task <strong>{details.title}</strong> assigned to {details.assignedTo === 'Unassigned' ? 'nobody' : 'a team member'}</span>;
            case 'TASK_UPDATED':
                return <span>Updated task status to <Badge variant="outline">{details.status}</Badge></span>;
            case 'TASK_DELETED':
                return <span>Deleted a task</span>;
            case 'MEMBER_INVITED':
                return <span>Invited <strong>{details.email}</strong> as {details.role} {details.project ? `to project ${details.project}` : ''}</span>;
            case 'MEMBER_REMOVED':
                return <span>Removed a team member from {details.scope}</span>;
            case 'ROLE_UPDATED':
                if (details.action === 'Permissions Updated') return <span>Updated role permissions</span>;
                if (details.action === 'Role Created') return <span>Created new role <strong>{details.role}</strong></span>;
                if (details.action === 'Role Deleted') return <span>Deleted a custom role</span>;
                return <span>Updated roles</span>;
            default:
                return <span>Performed action: {action}</span>;
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Activity className="h-8 w-8" />
                    Activity Log
                </h1>
                <p className="text-muted-foreground">Track recent actions taken by your team.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>A chronological feed of system events.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-4">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : logs.length > 0 ? (
                        <div className="divide-y">
                            {logs.map((log) => (
                                <div key={log._id.toString()} className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors">
                                    <Avatar className="h-10 w-10 border">
                                        <AvatarImage src={`https://i.pravatar.cc/150?u=${log.user?.email || 'user'}`} />
                                        <AvatarFallback>{log.user?.name ? log.user.name.substring(0, 2).toUpperCase() : 'U'}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium">{log.user?.name || 'Unknown User'}</p>
                                            <div className="flex items-center text-xs text-muted-foreground gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-foreground/90">
                                            {getActionIcon(log.action as string)}
                                            {formatActionMessage(log)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-muted-foreground">
                            No recent activity found.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
