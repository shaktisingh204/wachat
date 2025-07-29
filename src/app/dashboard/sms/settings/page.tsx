
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getProjectById } from '@/app/actions';
import type { Project, WithId } from '@/lib/definitions';
import { SmsSettingsForm } from '@/components/wabasimplify/sms-settings-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function SmsSettingsPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const projectId = localStorage.getItem('activeProjectId');
            if (projectId) {
                const data = await getProjectById(projectId);
                setProject(data);
            }
        });
    }, []);

    if (isLoading) {
        return <Skeleton className="h-64 w-full max-w-2xl" />;
    }

    if (!project) {
        return (
             <Alert variant="destructive" className="max-w-2xl">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to configure SMS settings.
                </AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="max-w-2xl">
            <SmsSettingsForm project={project} />
        </div>
    );
}
