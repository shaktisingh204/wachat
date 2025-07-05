
'use client';

import { useState, useEffect, useTransition } from 'react';
import { getProjectById } from '@/app/actions';
import type { WithId, Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FacebookEmbeddedSignup } from '@/components/wabasimplify/facebook-embedded-signup';
import { CheckCircle, XCircle, Wrench, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';

function ConnectionPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-24 w-full" />
                </CardContent>
                <CardFooter>
                     <Skeleton className="h-12 w-48" />
                </CardFooter>
            </Card>
        </div>
    );
}

export default function AllProjectsPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const router = useRouter();

    const fetchData = () => {
        if (activeProjectId) {
            startLoading(async () => {
                const projectData = await getProjectById(activeProjectId);
                setProject(projectData);
            });
        }
    }

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setActiveProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (activeProjectId) {
            fetchData();
        }
    }, [activeProjectId]);

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const configId = process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID;

    if (isLoading) {
        return <ConnectionPageSkeleton />;
    }
    
    if (!activeProjectId) {
        return (
             <div className="flex flex-col gap-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Wrench className="h-8 w-8"/>
                        Project Connections
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Connect your project to Facebook to enable "Click to WhatsApp" ad creation and other Meta features.
                    </p>
                </div>
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the dashboard to configure its Facebook connection.
                    </AlertDescription>
                </Alert>
             </div>
        )
    }

    const isConnected = !!(project?.adAccountId && project.facebookPageId);

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Wrench className="h-8 w-8"/>
                    Project Connections
                </h1>
                <p className="text-muted-foreground mt-2">
                    Connect your project to Facebook to enable "Click to WhatsApp" ad creation and other Meta features.
                </p>
            </div>
            
            <Card className="w-full max-w-lg card-gradient card-gradient-blue">
                <CardHeader>
                    <CardTitle>Connect to Meta</CardTitle>
                    <CardDescription>
                        Authorize SabNode to manage ads and posts for your active project: <span className="font-semibold">{project?.name || '...'}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isConnected ? (
                        <div className="flex items-center gap-2 text-primary p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                            <CheckCircle className="h-5 w-5" />
                            <p className="font-semibold">Project Connected Successfully</p>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-muted-foreground p-4 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
                            <XCircle className="h-5 w-5" />
                            <p>This project is not yet connected.</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    {appId && configId && activeProjectId ? (
                        <FacebookEmbeddedSignup
                            appId={appId}
                            configId={configId}
                            projectId={activeProjectId}
                            onSuccess={fetchData}
                        />
                    ) : (
                        <p className="text-sm text-destructive">Admin has not configured Facebook integration.</p>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
