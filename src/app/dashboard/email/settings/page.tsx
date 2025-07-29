
'use client';

import { getSession } from '@/app/actions';
import { getCrmEmailSettings } from '@/app/actions/crm-email.actions';
import { useEffect, useState, useTransition } from 'react';
import type { CrmEmailSettings, User, WithId } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Mail, Server, Settings } from 'lucide-react';
import { CrmSmtpForm } from '@/components/wabasimplify/crm-smtp-form';
import { GoogleIcon, OutlookIcon } from '@/components/wabasimplify/custom-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
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

export default function EmailSettingsPage() {
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [settings, setSettings] = useState<CrmEmailSettings | null>(null);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const session = await getSession();
            if (session?.user) {
                setUser(session.user as any);
                const fetchedSettings = await getCrmEmailSettings(session.user._id.toString());
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
                <AlertDescription>Please log in to manage email settings.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Settings /> Email Settings</h1>
                <p className="text-muted-foreground">Configure your email accounts for sending.</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5"/>Connect Email Account</CardTitle>
                    <CardDescription>Connect your email accounts to sync conversations and send emails from within the app.</CardDescription>
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
