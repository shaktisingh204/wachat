
'use client';

import { getProjectById } from '@/app/actions';
import { getEcommSettings } from '@/app/actions/custom-ecommerce.actions';
import { EcommSettingsForm } from '@/components/wabasimplify/ecomm-settings-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { WithId, Project, EcommSettings } from '@/lib/definitions';

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-64"/>
            <Skeleton className="h-4 w-96"/>
            <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    );
}

export default function SettingsPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [settings, setSettings] = useState<EcommSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            const storedProjectId = localStorage.getItem('activeProjectId');
            if (storedProjectId) {
                const projectData = await getProjectById(storedProjectId);
                setProject(projectData);
                if (projectData) {
                    const settingsData = await getEcommSettings(storedProjectId);
                    setSettings(settingsData);
                }
            }
            setIsLoading(false);
        };
        fetchSettings();
    }, []);

    if (isLoading) {
        return <PageSkeleton />;
    }
    
    if (!project) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage its e-commerce settings.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Settings /> Shop Settings</h1>
                <p className="text-muted-foreground">Configure your shop name, currency, and custom domain.</p>
            </div>
            <EcommSettingsForm project={project} settings={settings} />
        </div>
    )
}
