
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Settings, Mail, Bot, Handshake, Link as LinkIcon, Rss, Save, LoaderCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CrmSmtpForm } from '@/components/wabasimplify/crm-smtp-form';
import { getCrmEmailSettings, getProjects } from '@/app/actions';
import { saveCrmProviders } from '@/app/actions/crm.actions';
import { useEffect, useState, useTransition, useActionState, useRef } from 'react';
import type { CrmEmailSettings, Project, WithId } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import { GoogleIcon, OutlookIcon } from '@/components/wabasimplify/custom-icons';
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useFormStatus } from "react-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";


function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-10 w-64"/>
            <Skeleton className="h-4 w-96"/>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    );
}

const providerInitialState = { message: null, error: undefined };

function ProviderSubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Provider Settings
        </Button>
    )
}

function CrmProvidersForm({ project, allProjects }: { project: WithId<Project>, allProjects: WithId<Project>[] }) {
    const [state, formAction] = useActionState(saveCrmProviders, providerInitialState);
    const { toast } = useToast();
    const whatsappProjects = allProjects.filter(p => p.wabaId);

    useEffect(() => {
        if (state.message) toast({ title: 'Success!', description: state.message });
        if (state.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);
    
    return (
         <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Rss className="h-5 w-5"/>Communication Providers</CardTitle>
                    <CardDescription>Select which of your connected projects to use for sending WhatsApp messages from this CRM.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="whatsappProjectId">WhatsApp Project</Label>
                        <Select name="whatsappProjectId" defaultValue={project.crm?.whatsappProjectId?.toString()}>
                            <SelectTrigger id="whatsappProjectId">
                                <SelectValue placeholder="Select a WhatsApp project..." />
                            </SelectTrigger>
                            <SelectContent>
                                {whatsappProjects.length > 0 ? whatsappProjects.map(p => (
                                    <SelectItem key={p._id.toString()} value={p._id.toString()}>{p.name}</SelectItem>
                                )) : <div className="text-sm text-center text-muted-foreground p-2">No WhatsApp projects found.</div>}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">This project will be used to send WhatsApp messages and track conversations.</p>
                    </div>
                </CardContent>
                <CardFooter className="justify-between">
                    <ProviderSubmitButton />
                    <Button asChild variant="outline">
                        <Link href="/dashboard/setup">Connect New Project</Link>
                    </Button>
                </CardFooter>
            </Card>
        </form>
    )
}

export default function CrmSettingsPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [allProjects, setAllProjects] = useState<WithId<Project>[]>([]);
    const [settings, setSettings] = useState<CrmEmailSettings | null>(null);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const projectId = localStorage.getItem('activeProjectId') || '';
            const [fetchedProject, fetchedAllProjects, fetchedSettings] = await Promise.all([
                getProjectById(projectId),
                getProjects(),
                getCrmEmailSettings(projectId)
            ]);
            setProject(fetchedProject);
            setAllProjects(fetchedAllProjects);
            setSettings(fetchedSettings);
        });
    }, []);

    if (isLoading) {
        return <PageSkeleton />;
    }
    
    if (!project) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage its CRM settings.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Settings /> CRM Settings</h1>
                <p className="text-muted-foreground">Configure your CRM pipelines, automation, and integrations.</p>
            </div>
            
            <CrmProvidersForm project={project} allProjects={allProjects} />
            
            <Separator />
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5"/>Email Integration</CardTitle>
                    <CardDescription>Connect your email accounts to sync conversations and send emails from within the CRM.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <p className="text-sm text-muted-foreground">Connect a provider to get started. We recommend using a dedicated app password for security.</p>
                     <div className="flex flex-wrap gap-4 p-4 border rounded-lg justify-center bg-muted/50">
                        <Button asChild className="w-full sm:w-auto" variant="outline">
                           <Link href="/api/crm/auth/google/connect">
                                <GoogleIcon className="mr-2 h-5 w-5"/> Connect Gmail
                           </Link>
                        </Button>
                        <Button asChild className="w-full sm:w-auto" variant="outline">
                            <Link href="/api/crm/auth/outlook/connect">
                                <OutlookIcon className="mr-2 h-5 w-5"/> Connect Outlook
                            </Link>
                        </Button>
                     </div>
                </CardContent>
            </Card>

            <Separator />

            <CrmSmtpForm settings={settings} />
            
        </div>
    );
}
