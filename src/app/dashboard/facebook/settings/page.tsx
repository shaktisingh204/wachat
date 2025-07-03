
'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { getProjectById } from '@/app/actions';
import { handleUpdateMarketingSettings } from '@/app/actions/facebook.actions';
import type { WithId, Project } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, LoaderCircle, Save, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const marketingSettingsInitialState = { message: null, error: null };

function SaveButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      {children}
    </Button>
  );
}

export default function FacebookSettingsPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isClient, setIsClient] = useState(false);
    const [activeProjectId, setActiveProjectId] = useState<string|null>(null);
    const router = useRouter();

    const [state, formAction] = useActionState(handleUpdateMarketingSettings, marketingSettingsInitialState);
    const { toast } = useToast();

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

    useEffect(() => {
        if (state?.message) toast({ title: 'Success!', description: state.message });
        if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

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

    return (
         <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Megaphone/> Facebook Ads Settings</h1>
                <p className="text-muted-foreground">Configure your credentials for creating and managing ads via the API.</p>
            </div>
            <form action={formAction}>
                <input type="hidden" name="projectId" value={project._id.toString()} />
                <Card className="card-gradient card-gradient-blue">
                    <CardHeader>
                        <CardTitle>API Credentials</CardTitle>
                        <CardDescription>
                            Enter your Ad Account ID and Facebook Page ID. Follow the {' '}
                            <Link href="/dashboard/facebook/setup" className="text-primary underline hover:text-primary/80">Setup Guide</Link>
                            {' '}if you need help finding these.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="adAccountId">Ad Account ID</Label>
                            <Input id="adAccountId" name="adAccountId" placeholder="e.g., act_1234567890" defaultValue={project.adAccountId}/>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="facebookPageId">Facebook Page ID</Label>
                            <Input id="facebookPageId" name="facebookPageId" placeholder="e.g., 1234567890" defaultValue={project.facebookPageId}/>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <SaveButton>Save Marketing Settings</SaveButton>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}

    