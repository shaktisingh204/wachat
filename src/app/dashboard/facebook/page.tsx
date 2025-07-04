
'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { getProjectById } from '@/app/actions';
import type { WithId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Facebook, Megaphone, Users, Newspaper } from 'lucide-react';
import Link from 'next/link';
import { FacebookEmbeddedSignup } from '@/components/wabasimplify/facebook-embedded-signup';

function FacebookPageSkeleton() {
    return (
      <div className="flex flex-col gap-8">
        <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <Card>
            <CardHeader><Skeleton className="h-6 w-1/3"/></CardHeader>
            <CardContent><Skeleton className="h-48 w-full"/></CardContent>
        </Card>
      </div>
    );
}

export default function FacebookManagerPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isClient, setIsClient] = useState(false);
    const [projectId, setProjectId] = useState<string | null>(null);

    const fetchData = useCallback(() => {
        if (!projectId) return;
        startLoadingTransition(async () => {
            const projectData = await getProjectById(projectId);
            setProject(projectData);
        });
    }, [projectId]);

    useEffect(() => {
        setIsClient(true);
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (projectId) {
            fetchData();
        }
    }, [projectId, fetchData]);
    
    const hasMarketingSetup = !!(project?.adAccountId && project.facebookPageId && project.accessToken);

    if (!isClient || isLoading) {
        return <FacebookPageSkeleton />;
    }

    if (!projectId) {
         return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to manage Facebook pages.
                </AlertDescription>
            </Alert>
        );
    }

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const configId = process.env.FACEBOOK_CONFIG_ID;
    
    if (!appId || !configId) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Configuration Error</AlertTitle>
                <AlertDescription>
                    The Facebook integration is not configured correctly by the admin. `NEXT_PUBLIC_FACEBOOK_APP_ID` and `FACEBOOK_CONFIG_ID` must be set.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Facebook/> Facebook Manager</h1>
                <p className="text-muted-foreground">Connect your Facebook Page to create ads, manage posts, and more.</p>
            </div>
            
            {hasMarketingSetup ? (
                <Card className="card-gradient card-gradient-blue">
                    <CardHeader>
                        <CardTitle>Page Connected</CardTitle>
                        <CardDescription>
                            Your Facebook Page and Ad Account are connected to this project. You can now access the management tools.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Link href="/dashboard/facebook/ads" className="block">
                            <Card className="hover:bg-muted transition-colors h-full">
                                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-5 w-5"/>Ads Manager</CardTitle></CardHeader>
                                <CardContent><p className="text-sm text-muted-foreground">Create and monitor your Click-to-WhatsApp ad campaigns.</p></CardContent>
                            </Card>
                        </Link>
                         <Link href="/dashboard/facebook/audiences" className="block">
                            <Card className="hover:bg-muted transition-colors h-full">
                                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5"/>Audiences</CardTitle></CardHeader>
                                <CardContent><p className="text-sm text-muted-foreground">Manage your custom and lookalike audiences. (Coming Soon)</p></CardContent>
                            </Card>
                        </Link>
                        <Link href="/dashboard/facebook/posts" className="block">
                             <Card className="hover:bg-muted transition-colors h-full">
                                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Newspaper className="h-5 w-5"/>Page Posts</CardTitle></CardHeader>
                                <CardContent><p className="text-sm text-muted-foreground">View and manage your recent Facebook page posts. (Coming Soon)</p></CardContent>
                            </Card>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <Card className="text-center card-gradient card-gradient-green">
                    <CardHeader>
                        <CardTitle>Connect Your Facebook Page</CardTitle>
                        <CardDescription>Use the secure pop-up to connect your account in a few clicks. This will allow SabNode to manage ads on your behalf.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FacebookEmbeddedSignup
                            appId={appId}
                            configId={configId}
                            projectId={projectId}
                            onSuccess={fetchData}
                        />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
