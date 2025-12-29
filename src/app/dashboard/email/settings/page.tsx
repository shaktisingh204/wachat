
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
import { CrmSmtpForm } from '@/components/wabasimplify/crm-smtp-form';
import { EmailTemplatesManager } from '@/components/wabasimplify/email-templates-manager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Mail, FileText, Settings, ShieldCheck, Zap } from 'lucide-react';
import { getEmailSettings, saveEmailComplianceSettings } from '@/app/actions/email.actions';
import { getSession } from '@/app/actions/index.ts';
import type { CrmEmailSettings, User, WithId, EmailComplianceSettings } from '@/lib/definitions';
import { GoogleIcon, OutlookIcon } from '@/components/wabasimplify/custom-sidebar-components';
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useActionState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, Save } from 'lucide-react';

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

const complianceInitialState = { message: null, error: undefined };

function ComplianceForm({ user }: { user: WithId<User> }) {
    const { toast } = useToast();
    const [state, formAction] = useActionState(saveEmailComplianceSettings, complianceInitialState);
    const { pending } = useFormStatus();

    useEffect(() => {
        if (state.message) toast({ title: 'Success', description: state.message });
        if (state.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    const compliance = user.email?.compliance || { unsubscribeLink: true, physicalAddress: '' };
    
    return (
        <form action={formAction}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>Compliance & Unsubscribe</CardTitle>
                    <CardDescription>Configure settings to comply with anti-spam laws like CAN-SPAM and GDPR.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex items-center space-x-2 rounded-lg border p-4">
                        <Switch id="unsubscribeLink" name="unsubscribeLink" defaultChecked={compliance.unsubscribeLink} />
                        <Label htmlFor="unsubscribeLink" className="font-normal">Automatically include an unsubscribe link in email footers.</Label>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="physicalAddress">Physical Mailing Address</Label>
                        <Textarea id="physicalAddress" name="physicalAddress" placeholder="e.g., 123 Main St, Anytown, USA 12345" defaultValue={compliance.physicalAddress}/>
                        <p className="text-xs text-muted-foreground">Required by CAN-SPAM for all commercial emails.</p>
                    </div>
                </CardContent>
                 <CardFooter>
                     <Button type="submit" disabled={pending}>
                        {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Compliance Settings
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
}

function DeliverabilityTab() {
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

function IntegrationsTab({ userId }: { userId: string }) {
    const apiKey = `sk_live_${userId.substring(0, 16)}...`;
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/email/${userId}`;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5"/>API & Webhooks</CardTitle>
                    <CardDescription>Programmatically interact with your email data.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label>API Key</Label>
                        <CodeBlock code={apiKey} />
                     </div>
                      <div className="space-y-2">
                        <Label>Webhook URL for Incoming Events</Label>
                        <CodeBlock code={webhookUrl} />
                     </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>CRM Sync</CardTitle>
                    <CardDescription>Sync contacts and activities with your favorite CRM.</CardDescription>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground p-8">
                    <p>CRM Sync is coming soon.</p>
                </CardContent>
            </Card>
        </div>
    )
}

function EmailSettingsPageContent() {
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
                <AlertDescription>Please log in to manage email settings.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <Tabs defaultValue={initialTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="email">Email Setup</TabsTrigger>
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                    <TabsTrigger value="compliance">Compliance</TabsTrigger>
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
                    <EmailTemplatesManager />
                </TabsContent>
                <TabsContent value="compliance" className="mt-6">
                    <ComplianceForm user={user} />
                </TabsContent>
                <TabsContent value="deliverability" className="mt-6">
                    <DeliverabilityTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function EmailSettingsPage() {
    return (
        <Suspense fallback={<PageSkeleton/>}>
            <EmailSettingsPageContent/>
        </Suspense>
    )
}
