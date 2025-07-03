
'use client';

import { useEffect, useState, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getProjectById, type Project } from '@/app/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { QrCodeSettingsTab } from '@/components/wabasimplify/qr-code-settings-tab';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function SettingsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div><Skeleton className="h-8 w-1/3" /><Skeleton className="h-4 w-2/3 mt-2" /></div>
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

export default function QrCodeSettingsPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startLoadingTransition(async () => {
                const projectData = await getProjectById(storedProjectId);
                setProject(projectData);
            });
        } else {
             startLoadingTransition(async () => {});
        }
    }, []);

    if (!isClient || isLoading) {
        return <SettingsPageSkeleton />;
    }

    if (!project) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to configure settings.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex flex-col gap-8">
             <div>
                <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/qr-code-maker">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to QR Code Maker
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">QR Code Maker Settings</h1>
                <p className="text-muted-foreground">Configure advanced options and developer settings for your QR codes.</p>
            </div>
            <QrCodeSettingsTab project={project} />
        </div>
    )
}
