
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getProjectById } from '@/app/actions';
import type { WithId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, AlertCircle } from 'lucide-react';
import { WhatsappLinkGenerator } from '@/components/wabasimplify/whatsapp-link-generator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { WhatsAppWidgetGenerator } from '@/components/wabasimplify/whatsapp-widget-generator';


function IntegrationsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-80 w-full" />
        </div>
    )
}

export default function IntegrationsPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startLoadingTransition(async () => {
                const projectData = await getProjectById(storedProjectId);
                setProject(projectData);
            });
        }
    }, []);

    if (isLoading) {
        return <IntegrationsPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Zap className="h-8 w-8" />
                    Integrations
                </h1>
                <p className="text-muted-foreground mt-2">
                    Connect SabNode with your favorite tools and services.
                </p>
            </div>
            
            {project ? (
                <>
                    <WhatsappLinkGenerator project={project} />
                    <Separator />
                    <WhatsAppWidgetGenerator project={project} />
                </>
            ) : (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard to use integrations.
                    </AlertDescription>
                </Alert>
            )}

             <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>More Integrations Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">Integrations with platforms like Shopify, Zapier, and more are on the way.</p>
                </CardContent>
            </Card>
        </div>
    );
}
