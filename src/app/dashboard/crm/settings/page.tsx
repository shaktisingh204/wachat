
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
import { CrmSmtpForm } from '@/components/wabasimplify/crm-smtp-form';
import { EmailTemplatesManager } from "@/components/wabasimplify/crm-email-templates-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Mail, FileText, Settings, ShieldCheck, Zap } from 'lucide-react';
import { getEmailSettings } from '@/app/actions/email.actions';
import { getSession } from '@/app/actions/index.ts';
import type { CrmEmailSettings, User, WithId } from '@/lib/definitions';
import { GoogleIcon, OutlookIcon } from '@/components/wabasimplify/custom-sidebar-components';
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

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

function CrmSettingsPageContent() {
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') || 'email';
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [settings, setSettings] = useState<WithId<CrmEmailSettings> | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        const fetchData = async () => {
            const session = await getSession();
            if (session?.user) {
                setUser(session.user as any);
                const fetchedSettings = await getEmailSettings();
                setSettings(fetchedSettings[0] || null);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading) {
        return <PageSkeleton />;
    }
    
    if (!user) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Not Logged In</AlertTitle>
                <AlertDescription>Please log in to manage CRM settings.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Settings /> CRM Settings</h1>
                <p className="text-muted-foreground">Configure your CRM pipelines, automation, and integrations.</p>
            </div>
            
            <Tabs defaultValue={initialTab}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="email">Email Setup</TabsTrigger>
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                </TabsList>
                <TabsContent value="email" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5"/>Connect Email Account</CardTitle>
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
                </TabsContent>
                <TabsContent value="templates" className="mt-6">
                    <EmailTemplatesManager />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function CrmSettingsPage() {
    return (
        <Suspense fallback={<PageSkeleton/>}>
            <CrmSettingsPageContent/>
        </Suspense>
    )
}
