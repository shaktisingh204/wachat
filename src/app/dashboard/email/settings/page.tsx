'use client';

import {
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardFooter,
  Button,
  Input,
  Label,
  Textarea,
  Switch,
  Badge,
  Skeleton,
  Separator,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  useZoruToast,
} from '@/components/zoruui';
import {
  Suspense,
  useEffect,
  useState } from 'react';
import { useSearchParams,
  useRouter } from "next/navigation";
import { CrmSmtpForm } from '@/components/wabasimplify/crm-smtp-form';
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
  OutlookIcon } from '@/components/wabasimplify/custom-sidebar-components';
import Link from "next/link";
import { ModuleLayout } from '@/components/wabasimplify/module-layout';
import { ModuleSidebar } from '@/components/wabasimplify/module-sidebar';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { EmailSuiteLayout } from '@/components/email/layout';

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <ZoruSkeleton className="h-10 w-64" />
            <ZoruSkeleton className="h-4 w-96" />
            <ZoruSkeleton className="h-64 w-full" />
            <ZoruSkeleton className="h-48 w-full" />
        </div>
    );
}

const complianceInitialState = { message: undefined, error: undefined };

function ComplianceForm({ user }: { user: WithId<User> }) {
    const { toast } = useZoruToast();
    const [state, formAction] = useActionState(saveEmailComplianceSettings, complianceInitialState);
    const { pending } = useFormStatus();

    useEffect(() => {
        if (state.message) toast({ title: 'Success', description: state.message });
        if (state.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    const compliance = user.emailSettings?.compliance || { unsubscribeLink: true, physicalAddress: '' };

    return (
        <form action={formAction}>
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Compliance & Unsubscribe</ZoruCardTitle>
                    <ZoruCardDescription>Configure settings to comply with anti-spam laws like CAN-SPAM and GDPR.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="flex items-center space-x-2 rounded-lg border border-zoru-line p-4">
                        <ZoruSwitch id="unsubscribeLink" name="unsubscribeLink" defaultChecked={compliance.unsubscribeLink} />
                        <ZoruLabel htmlFor="unsubscribeLink">Automatically include an unsubscribe link in email footers.</ZoruLabel>
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel htmlFor="physicalAddress">Physical Mailing Address</ZoruLabel>
                        <ZoruTextarea id="physicalAddress" name="physicalAddress" placeholder="e.g., 123 Main St, Anytown, USA 12345" defaultValue={compliance.physicalAddress} />
                        <p className="text-xs text-zoru-ink-muted">Required by CAN-SPAM for all commercial emails.</p>
                    </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                    <ZoruButton type="submit" disabled={pending}>
                        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Compliance Settings
                    </ZoruButton>
                </ZoruCardFooter>
            </ZoruCard>
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
        <ZoruCard className="p-0">
            <ZoruCardHeader>
                <ZoruCardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Domain Authentication</ZoruCardTitle>
                <ZoruCardDescription>Improve your email deliverability by adding DKIM and SPF records to your domain's DNS settings.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-6">
                <div>
                    <h3 className="mb-2 text-zoru-ink">DKIM Record</h3>
                    <p className="text-sm text-zoru-ink-muted mb-4">DKIM adds a digital signature to your emails, allowing receiving servers to verify that the message was sent by you and was not altered in transit.</p>
                    <CodeBlock language="text" code={`Type: ${dkimRecord.type}\nHost: ${dkimRecord.host}\nValue: ${dkimRecord.value}`} />
                </div>
                <ZoruSeparator />
                <div>
                    <h3 className="mb-2 text-zoru-ink">SPF Record</h3>
                    <p className="text-sm text-zoru-ink-muted mb-4">SPF specifies which mail servers are permitted to send email on behalf of your domain. This helps prevent spoofing.</p>
                    <CodeBlock language="text" code={`Type: ${spfRecord.type}\nHost: ${spfRecord.host}\nValue: ${spfRecord.value}`} />
                    <p className="text-xs text-zoru-ink-muted mt-2">If you already have an SPF record, add `include:sabnode.com` to it.</p>
                </div>
                <ZoruAlert>
                    <AlertCircle className="h-4 w-4" />
                    <ZoruAlertTitle>Note</ZoruAlertTitle>
                    <ZoruAlertDescription>
                        DNS changes can take up to 48 hours to propagate. These values are placeholders; your specific records will be provided upon domain verification.
                    </ZoruAlertDescription>
                </ZoruAlert>
            </ZoruCardContent>
        </ZoruCard>
    );
}

function IntegrationsTab({ userId }: { userId: string }) {
    const apiKey = `sk_live_${userId.substring(0, 16)}...`;
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/email/${userId}`;

    return (
        <div className="space-y-6">
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />API & Webhooks</ZoruCardTitle>
                    <ZoruCardDescription>Programmatically interact with your email data.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="space-y-2">
                        <ZoruLabel>API Key</ZoruLabel>
                        <CodeBlock code={apiKey} />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Webhook URL for Incoming Events</ZoruLabel>
                        <CodeBlock code={webhookUrl} />
                    </div>
                </ZoruCardContent>
            </ZoruCard>
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>CRM Sync</ZoruCardTitle>
                    <ZoruCardDescription>Sync contacts and activities with your favorite CRM.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="text-center text-zoru-ink-muted p-8">
                    <p>CRM Sync is coming soon.</p>
                </ZoruCardContent>
            </ZoruCard>
        </div>
    )
}

function OnboardingCard({ title, description, icon: Icon, href, features }: any) {
    return (
        <ZoruCard className="p-0 hover:border-zoru-line transition-colors cursor-pointer group relative overflow-hidden h-full flex flex-col">
            <ZoruCardHeader>
                <ZoruCardTitle className="flex items-center gap-3">
                    <Icon className="h-6 w-6" />
                    {title}
                </ZoruCardTitle>
                <ZoruCardDescription>{description}</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="flex-grow">
                <ul className="text-sm text-zoru-ink-muted space-y-2 mb-6">
                    {features.map((feature: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-zoru-ink mt-1.5 shrink-0" />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
            </ZoruCardContent>
            <ZoruCardFooter>
                {href ? (
                    <ZoruButton asChild className="w-full">
                        <Link href={href}>{title === 'Custom SMTP' ? 'Configure SMTP' : `Connect ${title}`}</Link>
                    </ZoruButton>
                ) : (
                    <div className="w-full mt-4">
                        <CrmSmtpForm settings={null} />
                    </div>
                )}
            </ZoruCardFooter>
        </ZoruCard>
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
    const { toast } = useZoruToast();

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
            <ZoruAlert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <ZoruAlertTitle>Not Logged In</ZoruAlertTitle>
                <ZoruAlertDescription>Please log in to manage email settings.</ZoruAlertDescription>
            </ZoruAlert>
        );
    }

    if (view === 'list' && allSettings.length > 0) {
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <ZoruPageHeader>
                        <ZoruPageHeading>
                            <ZoruPageTitle>
                                <span className="inline-flex items-center gap-3">
                                    <Mail className="h-7 w-7" /> Email Suite
                                </span>
                            </ZoruPageTitle>
                            <ZoruPageDescription>Manage your connected email accounts.</ZoruPageDescription>
                        </ZoruPageHeading>
                    </ZoruPageHeader>
                    <ZoruButton onClick={() => router.push('/dashboard/email/settings?view=connect')}>
                        <Plus className="h-4 w-4" /> Connect New Account
                    </ZoruButton>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allSettings.map((account) => {
                        const Icon = account.provider === 'google' ? GoogleIcon : account.provider === 'outlook' ? OutlookIcon : Mail;
                        return (
                            <ZoruCard key={account._id.toString()} className="p-0 group hover:border-zoru-line transition-all cursor-pointer" onClick={() => {
                                router.push(`/dashboard/email/settings?view=manage&accountId=${account._id.toString()}`);
                            }}>
                                <ZoruCardHeader>
                                    <div className="flex justify-between items-start">
                                        <div className="p-3 bg-zoru-surface-2 rounded-full transition-colors">
                                            <Icon className="h-6 w-6 text-zoru-ink transition-colors" />
                                        </div>
                                        <ZoruBadge variant="success"><CheckCircle className="h-3 w-3 mr-1" /> Active</ZoruBadge>
                                    </div>
                                    <ZoruCardTitle className="pt-4 truncate">{account.fromName || 'Unnamed Account'}</ZoruCardTitle>
                                    <ZoruCardDescription className="truncate">{account.fromEmail}</ZoruCardDescription>
                                </ZoruCardHeader>
                                <ZoruCardFooter>
                                    <ZoruButton variant="outline" className="w-full">Manage Settings</ZoruButton>
                                </ZoruCardFooter>
                            </ZoruCard>
                        )
                    })}
                </div>
            </div>
        );
    }

    if (view === 'connect') {
        return (
            <EmailSuiteLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
                    <div className="w-full flex justify-start">
                        <ZoruButton variant="ghost" onClick={() => router.push('/dashboard/email')}>
                            <ArrowLeft className="h-4 w-4" /> Back to Accounts
                        </ZoruButton>
                    </div>

                    <div className="text-center space-y-4 max-w-2xl">
                        <div className="bg-zoru-surface-2 p-4 rounded-full w-fit mx-auto">
                            <Mail className="h-12 w-12 text-zoru-ink" />
                        </div>
                        <h1 className="text-3xl text-zoru-ink">Connect Your Email</h1>
                        <p className="text-lg text-zoru-ink-muted">
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
                            <div className="h-full border border-zoru-line rounded-lg p-6 flex flex-col justify-center gap-4 bg-zoru-bg text-zoru-ink shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <Mail className="h-6 w-6" /> Custom SMTP
                                </div>
                                <p className="text-sm text-zoru-ink-muted mb-4">Connect any email provider via SMTP/IMAP credentials.</p>
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
                    <ZoruButton variant="ghost" size="sm" onClick={() => {
                        router.push('/dashboard/email');
                    }}>
                        <ArrowLeft className="h-4 w-4" /> Back
                    </ZoruButton>
                    <span className="text-zoru-ink-muted">/</span>
                    <span className="text-zoru-ink">{currentSettings?.fromEmail}</span>
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
                            <ZoruCard className="p-0">
                                <ZoruCardHeader>
                                    <ZoruCardTitle className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-zoru-success animate-pulse" />
                                            Connected via <span className="capitalize">{currentSettings.provider}</span>
                                        </div>
                                        <ZoruBadge variant="ghost">{currentSettings.fromEmail}</ZoruBadge>
                                    </ZoruCardTitle>
                                    <ZoruCardDescription>This account is active and ready to send campaigns.</ZoruCardDescription>
                                </ZoruCardHeader>
                                <ZoruCardContent>
                                    <div className="flex items-center gap-4">
                                        <ZoruButton variant="outline">Re-authorize Connection</ZoruButton>
                                        <ZoruButton variant="outline" className="text-zoru-danger-ink hover:bg-zoru-danger/10 border-zoru-danger/20" onClick={async () => {
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
                                        </ZoruButton>
                                    </div>
                                </ZoruCardContent>
                            </ZoruCard>

                            {currentSettings.provider === 'smtp' && (
                                <>
                                    <ZoruSeparator />
                                    <div className="mt-6">
                                        <h3 className="text-lg mb-4 text-zoru-ink">SMTP Configuration</h3>
                                        <CrmSmtpForm settings={currentSettings} />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'templates' && (
                        <ZoruCard>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Templates moved</ZoruCardTitle>
                                <ZoruCardDescription>
                                    The template builder lives in its own section now.
                                </ZoruCardDescription>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <ZoruButton asChild>
                                    <Link href="/dashboard/email/templates">Open template library</Link>
                                </ZoruButton>
                            </ZoruCardContent>
                        </ZoruCard>
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
