

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Settings, Mail, Bot, Handshake, Link as LinkIcon, Rss, Save, LoaderCircle, Users, KeyRound, Shield, FileText, Zap, ShieldCheck } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CrmSmtpForm } from '@/components/wabasimplify/crm-smtp-form';
import { getProjects, getSession } from '@/app/actions';
import { getEmailSettings } from '@/app/actions/email.actions';
import { saveCrmProviders } from '@/app/actions/crm.actions';
import { saveCrmPermissions } from '@/app/actions/crm.actions';
import { useEffect, useState, useTransition, useActionState, useRef } from 'react';
import type { CrmEmailSettings, Project, WithId, User } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import { GoogleIcon, OutlookIcon } from '@/components/wabasimplify/custom-sidebar-components';
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useFormStatus } from "react-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CrmEmailTemplatesManager } from "@/components/wabasimplify/crm-email-templates-manager";
import { MessageSquare } from "lucide-react";  


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
    const [settings, setSettings] = useState<CrmEmailSettings | null>(null);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            // Since CRM is at the user level, we fetch settings based on the logged-in user.
            const session = await getSession();
            if (session?.user) {
                setUser(session.user as any);
                const fetchedSettings = await getEmailSettings(session.user._id.toString());
                setSettings(fetchedSettings);
            }
        });
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
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="email">Email Setup</TabsTrigger>
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                    <TabsTrigger value="permissions" disabled>Permissions (Coming Soon)</TabsTrigger>
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
                    <CrmEmailTemplatesManager />
                </TabsContent>
                 <TabsContent value="permissions" className="mt-6">
                    {/* Permissions form will go here */}
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
