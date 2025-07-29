

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Settings, Mail, Bot, Handshake, Link as LinkIcon, Rss, Save, LoaderCircle, Users, KeyRound, Shield, FileText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CrmSmtpForm } from '@/components/wabasimplify/crm-smtp-form';
import { getSession } from '@/app/actions';
import { getCrmEmailSettings, saveEmailPermissions } from '@/app/actions/email.actions';
import { saveCrmProviders } from '@/app/actions/crm.actions';
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
import { CrmEmailTemplatesManager } from "@/components/wabasimplify/crm-email-templates-manager';
import { CodeBlock } from "@/components/wabasimplify/code-block";


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

function PermissionsForm({ user }: { user: WithId<User> }) {
    const { toast } = useToast();
    const [state, formAction] = useActionState(saveEmailPermissions, { message: null, error: undefined });

    useEffect(() => {
        if (state.message) toast({ title: 'Success', description: state.message });
        if (state.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    const permissions = user.email?.permissions?.agent || {};
    const modules = [
        { id: 'contacts', name: 'Contacts' },
        { id: 'campaigns', name: 'Campaigns' },
        { id: 'templates', name: 'Templates' },
    ];
    const actions = ['view', 'create', 'edit', 'delete'];

    return (
        <form action={formAction}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5"/>Agent Permissions</CardTitle>
                    <CardDescription>Define what team members with the 'Agent' role can do within the Email suite.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Module</TableHead>
                                    <TableHead className="text-center">View</TableHead>
                                    <TableHead className="text-center">Create</TableHead>
                                    <TableHead className="text-center">Edit</TableHead>
                                    <TableHead className="text-center">Delete</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {modules.map(module => (
                                    <TableRow key={module.id}>
                                        <TableCell className="font-medium">{module.name}</TableCell>
                                        {actions.map(action => (
                                            <TableCell key={action} className="text-center">
                                                <Checkbox
                                                    name={`${module.id}_${action}`}
                                                    defaultChecked={(permissions[module.id as keyof typeof permissions] as any)?.[action] ?? false}
                                                />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter>
                     <Button type="submit"><Save className="mr-2 h-4 w-4"/>Save Permissions</Button>
                </CardFooter>
            </Card>
        </form>
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

function CrmSettingsPageContent() {
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') || 'email';
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
            <Tabs defaultValue={initialTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="email">Email Setup</TabsTrigger>
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                    <TabsTrigger value="permissions">Permissions</TabsTrigger>
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
                <TabsContent value="templates" className="mt-6">
                    <CrmEmailTemplatesManager />
                </TabsContent>
                 <TabsContent value="permissions" className="mt-6">
                    <PermissionsForm user={user} />
                </TabsContent>
                <TabsContent value="deliverability" className="mt-6">
                    <DeliverabilityTab />
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

```