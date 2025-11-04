
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getProjectById } from '@/app/actions/index.ts';
import type { WithId, Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Facebook } from 'lucide-react';
import Link from 'next/link';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b py-3 gap-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold text-left sm:text-right break-all">{value}</dd>
        </div>
    );
}

export default function FacebookSettingsPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isClient, setIsClient] = useState(false);
    const [activeProjectId, setActiveProjectId] = useState<string|null>(null);

    useEffect(() => {
        setIsClient(true);
        const storedProjectId = localStorage.getItem('activeProjectId');
        setActiveProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (isClient && activeProjectId) {
            startLoadingTransition(async () => {
                const projectData = await getProjectById(activeProjectId);
                setProject(projectData);
            });
        }
    }, [isClient, activeProjectId]);

    if (!isClient || isLoading) {
        return (
            <div className="flex flex-col gap-8">
                <div><Skeleton className="h-8 w-1/3" /><Skeleton className="h-4 w-2/3 mt-2" /></div>
                <Card><CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
            </div>
        );
    }
    
    if (!project) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to configure Facebook Marketing settings.
                </AlertDescription>
            </Alert>
        );
    }

    const hasMarketingSetup = !!(project.adAccountId && project.facebookPageId);

    return (
         <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Facebook/> Facebook Connection</h1>
                <p className="text-muted-foreground">Review your connected Facebook Page and Ad Account for project "{project.name}".</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Connected Accounts</CardTitle>
                    <CardDescription>
                       These IDs were retrieved automatically via Embedded Signup.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {hasMarketingSetup ? (
                        <dl className="space-y-1">
                            <InfoRow label="Facebook Page ID" value={project.facebookPageId} />
                            <InfoRow label="Ad Account ID" value={project.adAccountId} />
                             <InfoRow label="Connected App ID" value={project.appId || 'Not Set'} />
                            <InfoRow label="Access Token" value={<span className="font-mono text-sm">••••••••••••••••••••</span>} />
                        </dl>
                    ) : (
                         <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Not Connected</AlertTitle>
                            <AlertDescription>
                                No Facebook Page or Ad Account is connected to this project.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                 <CardFooter>
                    <Button asChild>
                        <Link href="/dashboard/facebook/all-projects">
                             {hasMarketingSetup ? 'Reconnect / Change Account' : 'Connect Account'}
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
