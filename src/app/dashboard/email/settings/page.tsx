
'use client';

import { getSession } from '@/app/actions';
import { getCrmEmailSettings } from '@/app/actions/crm-email.actions';
import { useEffect, useState, useTransition } from 'react';
import type { CrmEmailSettings, User, WithId } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Mail, Server, Settings, ShieldCheck } from 'lucide-react';
import { CrmSmtpForm } from '@/components/wabasimplify/crm-smtp-form';
import { GoogleIcon, OutlookIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from "next/link";
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { CodeBlock } from '@/components/wabasimplify/code-block';

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

function DeliverabilityTab() {
    const { copy } = useCopyToClipboard();
    const domain = "yourdomain.com"; // Placeholder

    const dkimRecord = {
        type: 'TXT',
        host: `sabnode._domainkey.${domain}`,
        value: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...your_long_dkim_key...IDAQAB'
    };
    
    const spfRecord = {
        type: 'TXT',
        host: domain,
        value: `v=spf1 include:sabnode.com ~all`
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>Domain Authentication</CardTitle>
                <CardDescription>Improve your email deliverability by adding DKIM and SPF records to your domain's DNS settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h3 className="font-semibold mb-2">DKIM Record</h3>
                    <p className="text-sm text-muted-foreground mb-4">DKIM adds a digital signature to your emails, allowing receiving servers to verify that the message was sent by you and was not altered in transit.</p>
                     <CodeBlock language="text" code={`Type: ${dkimRecord.type}\nHost: ${dkimRecord.host}\nValue: ${dkimRecord.value}`} />
                </div>
                <Separator />
                 <div>
                    <h3 className="font-semibold mb-2">SPF Record</h3>
                    <p className="text-sm text-muted-foreground mb-4">SPF specifies which mail servers are permitted to send email on behalf of your domain. This helps prevent spoofing.</p>
                    <CodeBlock language="text" code={`Type: ${spfRecord.type}\nHost: ${spfRecord.host}\nValue: ${spfRecord.value}`} />
                    <p className="text-xs text-muted-foreground mt-2">If you already have an SPF record, add `include:sabnode.com` to it.</p>
                </div>
                 <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Note</AlertTitle>
                    <AlertDescription>
                        DNS changes can take up to 48 hours to propagate. These values are placeholders; your specific records will be provided upon domain verification.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
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
            <Tabs defaultValue="email">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="email">Email Setup</TabsTrigger>
                    <TabsTrigger value="deliverability">Deliverability</TabsTrigger>
                </TabsList>
                <TabsContent value="email" className="mt-6 space-y-6">
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
                </TabsContent>
                <TabsContent value="deliverability" className="mt-6">
                    <DeliverabilityTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
