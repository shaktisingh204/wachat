'use client';

import { useEffect, useState, useTransition } from 'react';
import { getProjectById } from '@/app/actions';
import type { WithId, Project } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { RazorpaySettingsForm } from '@/components/wabasimplify/razorpay-settings-form';

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
        </div>
    )
}

export default function RazorpayIntegrationPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();

    useEffect(() => {
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

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!project) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to configure integrations.
                </AlertDescription>
            </Alert>
        );
    }

    return <RazorpaySettingsForm project={project} />;
}