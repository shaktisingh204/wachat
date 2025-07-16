
'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import type { WithId } from 'mongodb';
import { getProjectById } from '@/app/actions';
import type { Project, PhoneNumber } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Phone, Settings } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CallingSettingsForm } from '@/components/wabasimplify/calling-settings-form';

function SettingsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Calling Settings</h1>
                <p className="text-muted-foreground">Manage your WhatsApp Business Calling settings.</p>
            </div>
            <Skeleton className="h-10 w-full md:w-1/2" />
            <Skeleton className="h-[400px] w-full" />
        </div>
    );
}

export default function CallingSettingsPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();
    const [selectedPhone, setSelectedPhone] = useState<PhoneNumber | null>(null);
    const [projectId, setProjectId] = useState<string | null>(null);

    const fetchProjectData = useCallback((pid: string) => {
        startLoadingTransition(async () => {
            const projectData = await getProjectById(pid);
            setProject(projectData);
            if (projectData?.phoneNumbers && projectData.phoneNumbers.length > 0) {
                setSelectedPhone(projectData.phoneNumbers[0]);
            }
        });
    }, []);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
        if (storedProjectId) {
            fetchProjectData(storedProjectId);
        }
    }, [fetchProjectData]);
    
    if (isLoading) return <SettingsPageSkeleton />;

    if (!project) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to configure its calling settings.
                </AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-6">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold">Configure Number</h2>
                 <p className="text-muted-foreground">
                    Select a phone number to view and modify its calling configuration.
                </p>
            </div>
            
            <div className="max-w-md">
                <Select 
                    value={selectedPhone?.id} 
                    onValueChange={(id) => setSelectedPhone(project.phoneNumbers.find(p => p.id === id) || null)}
                >
                    <SelectTrigger><SelectValue placeholder="Select a phone number..." /></SelectTrigger>
                    <SelectContent>
                        {project.phoneNumbers.map(phone => (
                            <SelectItem key={phone.id} value={phone.id}>
                                {phone.display_phone_number} ({phone.verified_name})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {selectedPhone ? (
                <CallingSettingsForm key={selectedPhone.id} project={project} phone={selectedPhone} />
            ) : (
                <Alert>
                    <Phone className="h-4 w-4" />
                    <AlertTitle>No Phone Number Selected</AlertTitle>
                    <AlertDescription>
                       Please select a phone number from the dropdown above to manage its settings.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
