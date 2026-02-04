
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
import { CrmSmtpForm } from '@/components/wabasimplify/crm-smtp-form';
import { EmailTemplatesManager } from '@/components/wabasimplify/email-templates-manager';
import { AlertCircle, Mail, FileText, Settings, ShieldCheck, Zap, BarChart3 } from 'lucide-react';
import { getEmailSettings, saveEmailComplianceSettings } from '@/app/actions/email.actions';
import { getSession } from '@/app/actions/index';
import type { EmailSettings as CrmEmailSettings, User, WithId, EmailComplianceSettings } from '@/lib/definitions';
import { GoogleIcon, OutlookIcon } from '@/components/wabasimplify/custom-sidebar-components';
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ModuleLayout } from '@/components/wabasimplify/module-layout';
import { ModuleSidebar } from '@/components/wabasimplify/module-sidebar';
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
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
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

    const compliance = user.emailSettings?.compliance || { unsubscribeLink: true, physicalAddress: '' };

    return (
        <form action={formAction}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Compliance & Unsubscribe</CardTitle>
                    <CardDescription>Configure settings to comply with anti-spam laws like CAN-SPAM and GDPR.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2 rounded-lg border p-4">
                        <Switch id="unsubscribeLink" name="unsubscribeLink" defaultChecked={compliance.unsubscribeLink} />
                        <Label htmlFor="unsubscribeLink" className="font-normal">Automatically include an unsubscribe link in email footers.</Label>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="physicalAddress">Physical Mailing Address</Label>
                        <Textarea id="physicalAddress" name="physicalAddress" placeholder="e.g., 123 Main St, Anytown, USA 12345" defaultValue={compliance.physicalAddress} />
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
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Domain Authentication</CardTitle>
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
                    <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />API & Webhooks</CardTitle>
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

    // Helper component for the Onboarding View
    function OnboardingView() {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto space-y-8">
                <div className="text-center space-y-4">
                    <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto">
                        <Mail className="h-12 w-12 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Connect Your Email</h1>
                    <p className="text-lg text-muted-foreground">
                        Link your email account to sync conversations, send campaigns, and track deliverability directly from your dashboard.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer group relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-950/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <GoogleIcon className="h-6 w-6" />
                                Gmail
                            </CardTitle>
                            <CardDescription>Best for Google Workspace users.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="text-sm text-muted-foreground space-y-2 mb-4">
                                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> One-click secure OAuth</li>
                                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Sync emails & threads</li>
                            </ul>
                            <Button asChild className="w-full" variant="default">
                                <Link href="/api/crm/auth/google/connect">Connect Gmail</Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="hover:border-primary/50 transition-colors cursor-pointer group relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-950/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <OutlookIcon className="h-6 w-6" />
                                Outlook
                            </CardTitle>
                            <CardDescription>For Microsoft 365 & Outlook.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="text-sm text-muted-foreground space-y-2 mb-4">
                                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Enterprise grade security</li>
                                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Seamless integration</li>
                            </ul>
                            <Button asChild className="w-full" variant="default">
                                <Link href="/api/crm/auth/outlook/connect">Connect Outlook</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="w-full">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Or connect via SMTP</span>
                        </div>
                    </div>
                    <div className="mt-6">
                        <CrmSmtpForm settings={null} />
                    </div>
                </div>
            </div>
        );
    }

    const [activeTab, setActiveTab] = useState(initialTab || 'email');

    // Determine if user has any email connected
    const isConnected = !!settings;

    // If NOT connected, show the Onboarding View
    if (!isConnected) {
        return <OnboardingView />;
    }

    // Determine provider label for display
    const getProviderLabel = () => {
        if (settings?.provider === 'google') return 'Gmail / Google Workspace';
        if (settings?.provider === 'outlook') return 'Outlook / Microsoft 365';
        if (settings?.provider === 'smtp') return 'Custom SMTP';
        return 'Unknown Provider';
    };

    return (
        <div className="flex flex-col gap-8">
            <ModuleLayout
                sidebar={
                    <ModuleSidebar
                        title="Email Settings"
                        activeValue={activeTab}
                        onValueChange={setActiveTab}
                        items={[
                            { value: 'email', label: 'Email Setup', icon: Mail },
                            { value: 'templates', label: 'Templates', icon: FileText },
                            { value: 'compliance', label: 'Compliance', icon: ShieldCheck },
                            { value: 'deliverability', label: 'Deliverability', icon: BarChart3 },
                            { value: 'integrations', label: 'Integrations', icon: Zap },
                        ]}
                    />
                }
            >
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3 mb-6">
                        <Settings className="h-8 w-8" />
                        {activeTab === 'email' && 'Email Configuration'}
                        {activeTab === 'templates' && 'Templates'}
                        {activeTab === 'compliance' && 'Compliance'}
                        {activeTab === 'deliverability' && 'Deliverability'}
                        {activeTab === 'integrations' && 'Integrations'}
                    </h1>
                </div>

                {activeTab === 'email' && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                        Connected to {getProviderLabel()}
                                    </div>
                                    {settings?.fromEmail && <span className="text-sm font-normal text-muted-foreground">{settings.fromEmail}</span>}
                                </CardTitle>
                                <CardDescription>Your email account is active and ready to send campaigns.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4">
                                    <Button variant="outline" className="text-destructive hover:text-destructive" onClick={async () => {
                                        if (confirm('Are you sure you want to disconnect? This will stop all email syncing.')) {
                                            setIsLoading(true);
                                            const { disconnectEmailSettings } = await import('@/app/actions/email.actions');
                                            const result = await disconnectEmailSettings();
                                            if (result.message) {
                                                setSettings(null);
                                                toast({ title: 'Disconnected', description: result.message });
                                            } else if (result.error) {
                                                toast({ title: 'Error', description: result.error, variant: 'destructive' });
                                            }
                                            setIsLoading(false);
                                        }
                                    }}>
                                        Disconnect Account
                                    </Button>
                                    <Button variant="secondary">Re-authorize / Update Connection</Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Only show SMTP form if connected via SMTP to allow updates, or maybe hide it entirely if we want them to disconnect first? 
                            For now, let's allow editing SMTP settings if that's the active provider. 
                        */}
                        {settings?.provider === 'smtp' && (
                            <>
                                <Separator />
                                <div className="mt-6">
                                    <h3 className="text-lg font-semibold mb-4">SMTP Configuration</h3>
                                    <CrmSmtpForm settings={settings} />
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'templates' && (
                    <EmailTemplatesManager />
                )}

                {activeTab === 'compliance' && (
                    <ComplianceForm user={user} />
                )}

                {activeTab === 'deliverability' && (
                    <DeliverabilityTab />
                )}
                {activeTab === 'integrations' && (
                    <IntegrationsTab userId={user.id} />
                )}
            </ModuleLayout>
        </div>
    );
}

export default function EmailSettingsPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <EmailSettingsPageContent />
        </Suspense>
    )
}
