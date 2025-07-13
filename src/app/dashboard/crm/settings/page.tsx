
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Settings, Mail, Bot, Handshake } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CrmSmtpForm } from '@/components/wabasimplify/crm-smtp-form';
import { getCrmEmailSettings } from '@/app/actions/crm-email.actions';
import { useEffect, useState, useTransition } from 'react';
import type { CrmEmailSettings } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Link as LinkIcon } from 'lucide-react';
import { GoogleIcon, OutlookIcon } from '@/components/wabasimplify/custom-icons';


function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    );
}

export default function CrmSettingsPage() {
    const [settings, setSettings] = useState<CrmEmailSettings | null>(null);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const fetchedSettings = await getCrmEmailSettings(localStorage.getItem('activeProjectId') || '');
            setSettings(fetchedSettings);
        });
    }, []);

    if (isLoading) {
        return <PageSkeleton />;
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Settings /> CRM Settings</h1>
                <p className="text-muted-foreground">Configure your CRM pipelines, automation, and integrations.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5"/>Email Integration</CardTitle>
                    <CardDescription>Connect your email accounts to sync conversations and send emails from within the CRM.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <p className="text-sm text-muted-foreground">Connect a provider to get started. We recommend using a dedicated app password for security.</p>
                     <div className="flex flex-wrap gap-4 p-4 border rounded-lg justify-center bg-muted/50">
                        <Button variant="outline" disabled className="w-full sm:w-auto">
                            <GoogleIcon className="mr-2 h-5 w-5"/> Connect Gmail
                        </Button>
                        <Button variant="outline" disabled className="w-full sm:w-auto">
                            <OutlookIcon className="mr-2 h-5 w-5"/> Connect Outlook
                        </Button>
                         <Alert className="w-full">
                            <AlertCircle className="h-4 w-4"/>
                            <AlertTitle>Coming Soon</AlertTitle>
                            <AlertDescription>Direct integration with Google and Outlook via OAuth is under development for enhanced security and ease of use.</AlertDescription>
                        </Alert>
                     </div>
                </CardContent>
            </Card>

            <Separator />

            <CrmSmtpForm settings={settings} />
            
        </div>
    );
}
