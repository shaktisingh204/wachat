'use client';

import { Alert, AlertTitle, AlertDescription, Card, CardBody, CardHeader, CardTitle, CardDescription, CardFooter, Button, Input, Label, Textarea, Switch, Badge, Skeleton, Separator, PageHeader, PageHeading, PageTitle, PageDescription, useToast } from '@/components/sabcrm/20ui/compat';
import {
  Suspense,
  useEffect,
  useState } from 'react';
import { useSearchParams,
  useRouter } from "next/navigation";
import { CrmSmtpForm } from '@/components/zoruui-domain/crm-smtp-form';
// Link imported below
import { AlertCircle,
  Mail,
  FileText,
  Settings,
  ShieldCheck,
  Zap,
  BarChart3,
  Plus,
  ArrowLeft,
  Trash2,
  CheckCircle,
  LoaderCircle,
  Save } from 'lucide-react';
import { getEmailSettings,
  saveEmailComplianceSettings,
  disconnectEmailSettings } from '@/app/actions/email.actions';
import { getSession } from '@/app/actions/user.actions';
import type { EmailSettings as CrmEmailSettings,
  User,
  WithId } from '@/lib/definitions';
import { GoogleIcon,
  OutlookIcon } from '@/components/zoruui-domain/custom-sidebar-components';
import Link from "next/link";
import { ModuleLayout } from '@/components/zoruui-domain/module-layout';
import { ModuleSidebar } from '@/components/zoruui-domain/module-sidebar';
import { CodeBlock } from '@/components/zoruui-domain/code-block';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { EmailSuiteLayout } from '@/components/email/layout';

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

const complianceInitialState = { message: undefined, error: undefined };

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
            <Card className="p-0">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Compliance & Unsubscribe</CardTitle>
                    <CardDescription>Configure settings to comply with anti-spam laws like CAN-SPAM and GDPR.</CardDescription>
                </CardHeader>
                <CardBody className="space-y-4">
                    <div className="flex items-center space-x-2 rounded-lg border border-[var(--st-border)] p-4">
                        <Switch id="unsubscribeLink" name="unsubscribeLink" defaultChecked={compliance.unsubscribeLink} />
                        <Label htmlFor="unsubscribeLink">Automatically include an unsubscribe link in email footers.</Label>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="physicalAddress">Physical Mailing Address</Label>
                        <Textarea id="physicalAddress" name="physicalAddress" placeholder="e.g., 123 Main St, Anytown, USA 12345" defaultValue={compliance.physicalAddress} />
                        <p className="text-xs text-[var(--st-text-secondary)]">Required by CAN-SPAM for all commercial emails.</p>
                    </div>
                </CardBody>
                <CardFooter>
                    <Button type="submit" disabled={pending}>
                        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Compliance Settings
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
}

function DeliverabilityTab() {
    const domain = "yourdomain.com";

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
        <Card className="p-0">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Domain Authentication</CardTitle>
                <CardDescription>Improve your email deliverability by adding DKIM and SPF records to your domain's DNS settings.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-6">
                <div>
                    <h3 className="mb-2 text-[var(--st-text)]">DKIM Record</h3>
                    <p className="text-sm text-[var(--st-text-secondary)] mb-4">DKIM adds a digital signature to your emails, allowing receiving servers to verify that the message was sent by you and was not altered in transit.</p>
                    <CodeBlock language="text" code={`Type: ${dkimRecord.type}\nHost: ${dkimRecord.host}\nValue: ${dkimRecord.value}`} />
                </div>
                <Separator />
                <div>
                    <h3 className="mb-2 text-[var(--st-text)]">SPF Record</h3>
                    <p className="text-sm text-[var(--st-text-secondary)] mb-4">SPF specifies which mail servers are permitted to send email on behalf of your domain. This helps prevent spoofing.</p>
                    <CodeBlock language="text" code={`Type: ${spfRecord.type}\nHost: ${spfRecord.host}\nValue: ${spfRecord.value}`} />
                    <p className="text-xs text-[var(--st-text-secondary)] mt-2">If you already have an SPF record, add `include:sabnode.com` to it.</p>
                </div>
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Note</AlertTitle>
                    <AlertDescription>
                        DNS changes can take up to 48 hours to propagate. These values are placeholders; your specific records will be provided upon domain verification.
                    </AlertDescription>
                </Alert>
            </CardBody>
        </Card>
    );
}

function IntegrationsTab({ userId }: { userId: string }) {
    const apiKey = `sk_live_${userId.substring(0, 16)}...`;
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/email/${userId}`;

    return (
        <div className="space-y-6">
            <Card className="p-0">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />API & Webhooks</CardTitle>
                    <CardDescription>Programmatically interact with your email data.</CardDescription>
                </CardHeader>
                <CardBody className="space-y-4">
                    <div className="space-y-2">
                        <Label>API Key</Label>
                        <CodeBlock code={apiKey} />
                    </div>
                    <div className="space-y-2">
                        <Label>Webhook URL for Incoming Events</Label>
                        <CodeBlock code={webhookUrl} />
                    </div>
                </CardBody>
            </Card>
            <Card className="p-0">
                <CardHeader>
                    <CardTitle>CRM Sync</CardTitle>
                    <CardDescription>Sync contacts and activities with your favorite CRM.</CardDescription>
                </CardHeader>
                <CardBody className="text-center text-[var(--st-text-secondary)] p-8">
                    <p>CRM Sync is coming soon.</p>
                </CardBody>
            </Card>
        </div>
    )
}

function OnboardingCard({ title, description, icon: Icon, href, features }: any) {
    return (
        <Card className="p-0 hover:border-[var(--st-border)] transition-colors cursor-pointer group relative overflow-hidden h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <Icon className="h-6 w-6" />
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardBody className="flex-grow">
                <ul className="text-sm text-[var(--st-text-secondary)] space-y-2 mb-6">
                    {features.map((feature: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-[var(--st-text)] mt-1.5 shrink-0" />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
            </CardBody>
            <CardFooter>
                {href ? (
                    <Button asChild className="w-full">
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

    const view = viewParam === 'connect' ? 'connect' : (viewParam === 'manage' ? 'manage' : 'list');
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

    if (view === 'list') {
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <PageHeader>
                        <PageHeading>
                            <PageTitle>
                                <span className="inline-flex items-center gap-3">
                                    <Mail className="h-7 w-7" /> Email Suite
                                </span>
                            </PageTitle>
                            <PageDescription>Manage your connected email accounts.</PageDescription>
                        </PageHeading>
                    </PageHeader>
                    <Button onClick={() => router.push('/dashboard/email/settings?view=connect')}>
                        <Plus className="h-4 w-4" /> Connect New Account
                    </Button>
                </div>

                {allSettings.length === 0 ? (
                    <Card className="p-0">
                        <CardBody className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                            <div className="bg-[var(--st-bg-muted)] p-4 rounded-full">
                                <Mail className="h-10 w-10 text-[var(--st-text)]" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-xl text-[var(--st-text)]">No email accounts yet</h2>
                                <p className="text-sm text-[var(--st-text-secondary)] max-w-md">
                                    Connect a Gmail, Outlook, or custom SMTP account to start sending campaigns and syncing conversations.
                                </p>
                            </div>
                            <Button onClick={() => router.push('/dashboard/email/settings?view=connect')}>
                                <Plus className="h-4 w-4" /> Connect Your First Account
                            </Button>
                        </CardBody>
                    </Card>
                ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allSettings.map((account) => {
                        const Icon = account.provider === 'google' ? GoogleIcon : account.provider === 'outlook' ? OutlookIcon : Mail;
                        return (
                            <Card key={account._id.toString()} className="p-0 group hover:border-[var(--st-border)] transition-all cursor-pointer" onClick={() => {
                                router.push(`/dashboard/email/settings?view=manage&accountId=${account._id.toString()}`);
                            }}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div className="p-3 bg-[var(--st-bg-muted)] rounded-full transition-colors">
                                            <Icon className="h-6 w-6 text-[var(--st-text)] transition-colors" />
                                        </div>
                                        <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" /> Active</Badge>
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
                )}
            </div>
        );
    }

    if (view === 'connect') {
        return (
            <EmailSuiteLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
                    <div className="w-full flex justify-start">
                        <Button variant="ghost" onClick={() => router.push('/dashboard/email')}>
                            <ArrowLeft className="h-4 w-4" /> Back to Accounts
                        </Button>
                    </div>

                    <div className="text-center space-y-4 max-w-2xl">
                        <div className="bg-[var(--st-bg-muted)] p-4 rounded-full w-fit mx-auto">
                            <Mail className="h-12 w-12 text-[var(--st-text)]" />
                        </div>
                        <h1 className="text-3xl text-[var(--st-text)]">Connect Your Email</h1>
                        <p className="text-lg text-[var(--st-text-secondary)]">
                            Link your email account to sync conversations, send campaigns, and track deliverability directly from your dashboard.
                        </p>
                    </div>

                    <div className="flex flex-col gap-6 w-full max-w-4xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
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
                        </div>
                        <div className="w-full">
                            <div className="h-full border border-[var(--st-border)] rounded-lg p-6 flex flex-col justify-center gap-4 bg-[var(--st-bg)] text-[var(--st-text)] shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <Mail className="h-6 w-6" /> Custom SMTP
                                </div>
                                <p className="text-sm text-[var(--st-text-secondary)] mb-4">Connect any email provider via SMTP/IMAP credentials.</p>
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

    const currentSettings = allSettings.find(s => s._id.toString() === activeSettingsId);
    if (!currentSettings && activeSettingsId) {
        return <EmailSuiteLayout><div className="p-4">Account not found.</div></EmailSuiteLayout>;
    }

    if (!currentSettings) {
        return <EmailSuiteLayout><div /></EmailSuiteLayout>;
    }

    return (
        <EmailSuiteLayout>
            <div className="flex flex-col gap-8 h-full">
                <div className="flex items-center gap-4 mb-2">
                    <Button variant="ghost" size="sm" onClick={() => {
                        router.push('/dashboard/email');
                    }}>
                        <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <span className="text-[var(--st-text-secondary)]">/</span>
                    <span className="text-[var(--st-text)]">{currentSettings?.fromEmail}</span>
                </div>

                <ModuleLayout
                    sidebar={
                        <ModuleSidebar
                            title="Email Settings"
                            activeValue={activeTab}
                            onValueChange={setActiveTab}
                            items={[
                                { value: 'email', label: 'Configuration', icon: Settings },
                                { value: 'templates', label: 'Templates', icon: FileText },
                                { value: 'compliance', label: 'Compliance', icon: ShieldCheck },
                                { value: 'deliverability', label: 'Deliverability', icon: BarChart3 },
                                { value: 'integrations', label: 'Other Integrations', icon: Zap },
                            ]}
                        />
                    }
                >
                    {activeTab === 'email' && currentSettings && (
                        <div className="space-y-6">
                            <Card className="p-0">
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-[var(--st-status-ok)] animate-pulse" />
                                            Connected via <span className="capitalize">{currentSettings.provider}</span>
                                        </div>
                                        <Badge variant="ghost">{currentSettings.fromEmail}</Badge>
                                    </CardTitle>
                                    <CardDescription>This account is active and ready to send campaigns.</CardDescription>
                                </CardHeader>
                                <CardBody>
                                    <div className="flex items-center gap-4">
                                        <Button variant="outline">Re-authorize Connection</Button>
                                        <Button variant="outline" className="text-[var(--st-danger)] hover:bg-[var(--st-danger)]/10 border-[var(--st-danger)]/20" onClick={async () => {
                                            if (confirm('Are you sure you want to disconnect this account? This action cannot be undone.')) {
                                                setIsLoading(true);
                                                const result = await disconnectEmailSettings(currentSettings._id.toString());
                                                if (result.message) {
                                                    toast({ title: 'Disconnected', description: result.message });
                                                    router.push('/dashboard/email');
                                                } else if (result.error) {
                                                    toast({ title: 'Error', description: result.error, variant: 'destructive' });
                                                }
                                                setIsLoading(false);
                                            }
                                        }}>
                                            <Trash2 className="h-4 w-4" />
                                            Disconnect Account
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>

                            {currentSettings.provider === 'smtp' && (
                                <>
                                    <Separator />
                                    <div className="mt-6">
                                        <h3 className="text-lg mb-4 text-[var(--st-text)]">SMTP Configuration</h3>
                                        <CrmSmtpForm settings={currentSettings} />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'templates' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Templates moved</CardTitle>
                                <CardDescription>
                                    The template builder lives in its own section now.
                                </CardDescription>
                            </CardHeader>
                            <CardBody>
                                <Button asChild>
                                    <Link href="/dashboard/email/templates">Open template library</Link>
                                </Button>
                            </CardBody>
                        </Card>
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
