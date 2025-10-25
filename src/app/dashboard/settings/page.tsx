
'use client';

import { useEffect, useState } from 'react';
import type { WithId, Project, User, Plan } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProject } from '@/context/project-context';
import { ProjectSettingsForm } from '@/components/wabasimplify/project-settings-form';
import { AutoReplySettingsTab } from '@/components/wabasimplify/auto-reply-settings-tab';
import { AgentsRolesSettingsTab } from '@/components/wabasimplify/agents-roles-settings-tab';
import { UserAttributesSettingsTab } from '@/components/wabasimplify/user-attributes-settings-tab';
import { CannedMessagesSettingsTab } from '@/components/wabasimplify/canned-messages-settings-tab';
import { getSession } from '@/app/actions';

function SettingsPageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-full max-w-lg" />
            <div className="space-y-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    );
}

export default function WachatSettingsPage() {
    const { activeProject, isLoadingProject } = useProject();
    const [user, setUser] = useState<(Omit<User, 'password'> & { plan?: WithId<Plan> | null }) | null>(null);

    useEffect(() => {
        getSession().then(session => {
            if (session?.user) {
                setUser(session.user as any);
            }
        });
    }, []);

    if (isLoadingProject) {
        return <SettingsPageSkeleton />;
    }

    if (!activeProject) {
        return (
            <Alert variant="destructive" className="max-w-lg">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to configure its settings.
                </AlertDescription>
            </Alert>
        );
    }
    
    return (
        <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="auto-reply">Auto-Reply</TabsTrigger>
                <TabsTrigger value="agents">Agents & Roles</TabsTrigger>
                <TabsTrigger value="attributes">User Attributes</TabsTrigger>
                <TabsTrigger value="canned-messages">Canned Messages</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="mt-6">
                <ProjectSettingsForm project={activeProject} />
            </TabsContent>
            <TabsContent value="auto-reply" className="mt-6">
                <AutoReplySettingsTab project={activeProject} />
            </TabsContent>
             <TabsContent value="agents" className="mt-6">
                {user && <AgentsRolesSettingsTab project={activeProject} user={user} />}
            </TabsContent>
             <TabsContent value="attributes" className="mt-6">
                <UserAttributesSettingsTab project={activeProject} />
            </TabsContent>
             <TabsContent value="canned-messages" className="mt-6">
                <CannedMessagesSettingsTab project={activeProject} />
            </TabsContent>
        </Tabs>
    )
}
