'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
import { CrmSmtpForm } from '@/components/wabasimplify/crm-smtp-form';
import { EmailTemplatesManager } from '@/components/wabasimplify/email-templates-manager';
import { AlertCircle, Mail, FileText, Settings, ShieldCheck, Zap, BarChart3, Plus, ArrowLeft, Trash2, CheckCircle } from 'lucide-react';
import { getEmailSettings, saveEmailComplianceSettings, disconnectEmailSettings } from '@/app/actions/email.actions';
import { getSession } from '@/app/actions/index';
import type { EmailSettings as CrmEmailSettings, User, WithId } from '@/lib/definitions';
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
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmailSuiteLayout } from '@/components/wabasimplify/email-suite-layout';

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

function OnboardingCard({ title, description, icon: Icon, href, features }: any) {
    return (
        <Card className="hover:border-primary/50 transition-colors cursor-pointer group relative overflow-hidden h-full flex flex-col">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-950/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <Icon className="h-6 w-6" />
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                    {features.map((feature: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
            <CardFooter>
                {href ? (
                    <Button asChild className="w-full" variant="default">
                        <Link href={href}>{title === 'Custom SMTP' ? 'Configure SMTP' : `Connect ${title}`}</Link>
                    </Button>
                ) : (
                    <div className="w-full mt-4">
                        <CrmSmtpForm settings={null} />
                    </div>
                )}
            </CardFooter>
        </Card>
    )
}

function EmailSettingsPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialTab = searchParams.get('tab') || 'email';
    const viewParam = searchParams.get('view');
    const accountIdParam = searchParams.get('accountId');

    const [user, setUser] = useState<WithId<User> | null>(null);
    const [allSettings, setAllSettings] = useState<WithId<CrmEmailSettings>[]>([]);

    // We derive 'view' from params now
    const view = viewParam === 'connect' ? 'connect' : 'manage';
    const activeSettingsId = accountIdParam;

    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState(initialTab || 'email');

    useEffect(() => {
        setIsLoading(true);
        const fetchData = async () => {
            const session = await getSession();
            if (session?.user) {
                setUser(session.user as any);
                const fetchedSettings = await getEmailSettings();
                setAllSettings(fetchedSettings);
            }
            setIsLoading(false);
        };
        fetchData();
    }, [activeSettingsId]);

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

    // LIST VIEW: Show all connected accounts
    if (view === 'list' && allSettings.length > 0) {
        return (
            <div className="space-y-8 max-w-5xl mx-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Mail className="h-8 w-8" /> Email Suite</h1>
                        <p className="text-muted-foreground mt-2">Manage your connected email accounts.</p>
                    </div>
                    <Button onClick={() => setView('connect')}>
                        <Plus className="mr-2 h-4 w-4" /> Connect New Account
                    </Button>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allSettings.map((account) => {
                        const Icon = account.provider === 'google' ? GoogleIcon : account.provider === 'outlook' ? OutlookIcon : Mail;
                        return (
                            <Card key={account._id.toString()} className="group hover:border-primary/50 transition-all cursor-pointer" onClick={() => {
                                setActiveSettingsId(account._id.toString());
                                setView('manage');
                            }}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div className="p-3 bg-muted rounded-full group-hover:bg-primary/10 transition-colors">
                                            <Icon className="h-6 w-6 text-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle className="h-3 w-3 mr-1" /> Active</Badge>
                                    </div>
                                    <CardTitle className="pt-4 truncate">{account.fromName || 'Unnamed Account'}</CardTitle>
                                    <CardDescription className="truncate">{account.fromEmail}</CardDescription>
                                </CardHeader>
                                <CardFooter>
                                    <Button variant="outline" className="w-full">Manage Settings</Button>
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            </div>
        );
    }

    // CONNECT VIEW: Onboarding / Add New
    if (view === 'connect') {
        return (
            <EmailSuiteLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-4xl mx-auto space-y-8 px-4 py-10">
                    <div className="w-full flex justify-start">
                        <Button variant="ghost" onClick={() => router.push('/dashboard/email')}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Accounts
                        </Button>
                    </div>

                    <div className="text-center space-y-4 max-w-2xl">
                        <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto">
                            <Mail className="h-12 w-12 text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">Connect Your Email</h1>
                        <p className="text-lg text-muted-foreground">
                            Link your email account to sync conversations, send campaigns, and track deliverability directly from your dashboard.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                        <OnboardingCard
                            title="Gmail"
                            description="Best for Google Workspace users."
                            icon={GoogleIcon}
                            href="/api/crm/auth/google/connect"
                            features={["One-click secure OAuth", "Sync emails & threads", "Import Google Contacts"]}
                        />
                        <OnboardingCard
                            title="Outlook"
                            description="For Microsoft 365 & Outlook."
                            icon={OutlookIcon}
                            href="/api/crm/auth/outlook/connect"
                            features={["Enterprise grade security", "Seamless integration", "Calendar sync ready"]}
                        />
                        <div className="md:col-span-1">
                            <div className="h-full border rounded-lg p-6 flex flex-col justify-center gap-4 bg-card text-card-foreground shadow-sm">
                                <div className="flex items-center gap-3 mb-2 font-semibold">
                                    <Mail className="h-6 w-6" /> Custom SMTP
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">Connect any email provider via SMTP/IMAP credentials.</p>
                                <div className="flex-grow">
                                    <CrmSmtpForm settings={null} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </EmailSuiteLayout>
        )
    }

    // MANAGE VIEW: Module Layout is now provided by EmailSuiteLayout
    const currentSettings = allSettings.find(s => s._id.toString() === activeSettingsId);
    // Fallback if settings ID invalid
    if (!currentSettings && activeSettingsId) {
        // If ID provided but not found, maybe redirect to list?
        return <EmailSuiteLayout><div className="p-4">Account not found.</div></EmailSuiteLayout>;
    }

    // If no ID and not connect view, waiting for selection (this shouldn't happen due to layout logic, but safety)
    if (!currentSettings) {
        return <EmailSuiteLayout><div /></EmailSuiteLayout>;
    }

    return (
        <EmailSuiteLayout>
            <div className="flex flex-col gap-8 h-full">
                <div>
                    {/* Title is handled by Layout Sidebar usually, but we can add specific header if needed */}
                </div>

                {activeTab === 'email' && currentSettings && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                        Connected via <span className="capitalize">{currentSettings.provider}</span>
                                    </div>
                                    <Badge variant="outline">{currentSettings.fromEmail}</Badge>
                                </CardTitle>
                                <CardDescription>This account is active and ready to send campaigns.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4">
                                    <Button variant="secondary">Re-authorize Connection</Button>
                                    <Button variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/20" onClick={async () => {
                                        if (confirm('Are you sure you want to disconnect this account? This action cannot be undone.')) {
                                            setIsLoading(true);
                                            const result = await disconnectEmailSettings(currentSettings._id.toString());
                                            if (result.message) {
                                                toast({ title: 'Disconnected', description: result.message });
                                                router.push('/dashboard/email'); // Go back to list
                                            } else if (result.error) {
                                                toast({ title: 'Error', description: result.error, variant: 'destructive' });
                                            }
                                            setIsLoading(false);
                                        }
                                    }}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Disconnect Account
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {currentSettings.provider === 'smtp' && (
                            <>
                                <Separator />
                                <div className="mt-6">
                                    <h3 className="text-lg font-semibold mb-4">SMTP Configuration</h3>
                                    <CrmSmtpForm settings={currentSettings} />
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
            </div>
        </EmailSuiteLayout>
    );
}

export default function EmailSettingsPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <EmailSettingsPageContent />
        </Suspense>
    )
}
