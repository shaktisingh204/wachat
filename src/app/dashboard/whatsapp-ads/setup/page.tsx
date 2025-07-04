
'use client';

import { useState, useEffect, useTransition } from 'react';
import { getProjects } from '@/app/actions';
import type { WithId, Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FacebookEmbeddedSignup } from '@/components/wabasimplify/facebook-embedded-signup';
import { CheckCircle, XCircle, Wrench } from 'lucide-react';

function SetupPageSkeleton() {
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

export default function MarketingApiSetupPage() {
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
        return <SetupPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Wrench className="h-8 w-8"/>
                    WhatsApp Ads Project Setup
                </h1>
                <p className="text-muted-foreground mt-2">
                    Connect your projects to Facebook to enable "Click to WhatsApp" ad creation.
                </p>
            </div>
            
            <div className="space-y-4">
                {projects.length > 0 ? (
                    projects.map(project => {
                        const isConnected = project.adAccountId && project.facebookPageId;
                        return (
                            <Card key={project._id.toString()}>
                                <CardHeader>
                                    <CardTitle>{project.name}</CardTitle>
                                    <CardDescription>WABA ID: {project.wabaId}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex items-center justify-between">
                                    {isConnected ? (
                                        <div className="flex items-center gap-2 text-primary">
                                            <CheckCircle className="h-5 w-5" />
                                            <p className="font-semibold">Connected</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <XCircle className="h-5 w-5" />
                                            <p>Not Connected</p>
                                        </div>
                                    )}
                                    
                                    {appId && configId ? (
                                        <FacebookEmbeddedSignup
                                            appId={appId}
                                            configId={configId}
                                            projectId={project._id.toString()}
                                            onSuccess={fetchData}
                                        />
                                    ) : (
                                        <p className="text-sm text-destructive">Admin has not configured Facebook integration.</p>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })
                ) : (
                    <Card className="text-center py-12">
                         <CardContent>
                            <p className="text-muted-foreground">No projects found. Please create a project first.</p>
                         </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
