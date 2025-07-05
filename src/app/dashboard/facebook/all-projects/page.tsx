

'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getProjects } from '@/app/actions';
import type { WithId, Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FacebookEmbeddedSignup } from '@/components/wabasimplify/facebook-embedded-signup';
import { CheckCircle, Facebook, Wrench } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ManualFacebookSetupDialog } from '@/components/wabasimplify/manual-facebook-setup-dialog';

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
        </div>
    );
}

function ManagePageButton({ project }: { project: WithId<Project> }) {
    const router = useRouter();
    
    const handleClick = () => {
        localStorage.setItem('activeProjectId', project._id.toString());
        localStorage.setItem('activeProjectName', project.name);
        router.push('/dashboard/facebook');
    };

    return <Button onClick={handleClick} size="sm">Manage</Button>;
}


function ConnectedPageCard({ project }: { project: WithId<Project> }) {
    return (
        <Card className="card-gradient card-gradient-blue">
            <CardHeader className="flex-row items-center gap-4">
                <Avatar className="h-12 w-12">
                     <AvatarFallback><Facebook className="h-6 w-6"/></AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>Page ID: {project.facebookPageId}</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                    <CheckCircle className="h-5 w-5" />
                    <p className="font-semibold">Connected</p>
                </div>
                <ManagePageButton project={project} />
            </CardContent>
        </Card>
    );
}

export default function AllFacebookPagesPage() {
    const [projects, setProjects] = useState<WithId<Project>[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchData = () => {
        startLoading(async () => {
            const projectsData = await getProjects();
            setProjects(projectsData);
        });
    }

    useEffect(() => {
        fetchData();
    }, []);

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const configId = process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID;

    if (isLoading) {
        return <PageSkeleton />;
    }

    const connectedFacebookProjects = projects.filter(p => !!p.facebookPageId && !p.wabaId);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        Facebook Page Connections
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Connect and manage your Facebook Pages. Each connected page is treated as a separate project.
                    </p>
                </div>
                 <div className="flex items-center gap-2">
                    <ManualFacebookSetupDialog onSuccess={fetchData} />
                    {appId && configId ? (
                        <FacebookEmbeddedSignup
                            appId={appId}
                            configId={configId}
                            onSuccess={fetchData}
                        />
                    ) : (
                         <p className="text-sm text-destructive">Admin has not configured Facebook integration.</p>
                    )}
                </div>
            </div>
            
            <div className="space-y-4">
                {connectedFacebookProjects.length > 0 ? (
                    connectedFacebookProjects.map(project => (
                        <ConnectedPageCard key={project._id.toString()} project={project} />
                    ))
                ) : (
                    <Card className="text-center py-12">
                         <CardContent>
                            <p className="text-muted-foreground">No Facebook Pages have been connected yet.</p>
                         </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
