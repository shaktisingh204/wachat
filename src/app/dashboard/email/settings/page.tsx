'use client';

import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  Button,
  IconButton,
  Field,
  Input,
  Textarea,
  Checkbox,
  Switch,
  Badge,
  Skeleton,
  Separator,
  EmptyState,
  PageHeader,
  PageHeading,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  Suspense,
  useEffect,
  useState,
  useActionState,
  type ComponentType,
  type SVGProps } from 'react';
import { useSearchParams,
  useRouter } from "next/navigation";
import {
  AlertCircle,
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
  Server,
  Copy,
  Check,
  Save } from 'lucide-react';
import { getEmailSettings,
  saveEmailComplianceSettings,
  disconnectEmailSettings } from '@/app/actions/email.actions';
import { saveCrmEmailSettings } from '@/app/actions/crm-email.actions';
import { getSession } from '@/app/actions/user.actions';
import type { EmailSettings as CrmEmailSettings,
  User,
  WithId } from '@/lib/definitions';
import { useFormStatus } from 'react-dom';
import { EmailSuiteLayout } from '@/components/email/layout';

/* ------------------------------------------------------------------ icons */
/* Brand glyphs inlined locally so this page imports zero design-system or
 * domain pieces from outside the 20ui surface. Decorative by default; callers
 * may pass aria props. */

function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg role="img" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.08-2.58 1.98-4.48 1.98-3.79 0-7.17-3.22-7.17-7.22s3.38-7.22 7.17-7.22c2.23 0 3.63.92 4.48 1.75l2.72-2.72C19.62 3.39 16.67 2 12.48 2 7.01 2 2.56 6.18 2.56 12s4.45 10 9.92 10c2.79 0 5.1-1 6.88-2.84 1.92-1.92 2.58-4.75 2.58-7.17 0-.66-.07-1.32-.19-1.98z" />
    </svg>
  );
}

function OutlookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M228 64a12 12 0 0 0-12 12v56a12 12 0 0 1-12 12H76a12 12 0 0 1-12-12V88h60.46a12 12 0 0 0 10.7-5.83l24-40A12 12 0 0 0 148.46 28H104a12 12 0 0 0-10.7 5.83l-32 53.33A12 12 0 0 0 64 96H28a12 12 0 0 0-12 12v68a12 12 0 0 0 12 12h188a12 12 0 0 0 12-12v-56a12 12 0 0 1 12-12h12a12 12 0 0 0 0-24zm-12 92H28v-68h36v20a12 12 0 0 0 12 12h140z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ CodeBlock */
/* A copy-to-clipboard code surface built on 20ui tokens + IconButton. */

function CodeBlock({ code, wrap }: { code: string; language?: string; wrap?: boolean }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const onCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard.');
    });
  };

  return (
    <div className="relative rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-4 font-mono text-sm">
      <span className="absolute right-2 top-2">
        <IconButton
          label={copied ? 'Copied' : 'Copy code'}
          icon={copied ? Check : Copy}
          variant="ghost"
          size="sm"
          onClick={onCopy}
        />
      </span>
      <pre className={wrap ? 'whitespace-pre-wrap break-all overflow-hidden pr-8' : 'overflow-x-auto pr-8'}>
        <code className="text-[var(--st-text)]">{code.trim()}</code>
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ SmtpForm */
/* Pure-20ui custom-SMTP form. Posts to the same saveCrmEmailSettings action and
 * uses the same FormData field names (fromName, fromEmail, smtpHost, smtpPort,
 * smtpUser, smtpPass, smtpSecure) so behaviour is unchanged. */

function SmtpSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} iconLeft={Save}>
      Save SMTP Configuration
    </Button>
  );
}

const smtpInitialState: { message?: string; error?: string } = { message: undefined, error: undefined };

function SmtpForm({ settings }: { settings: WithId<CrmEmailSettings> | CrmEmailSettings | null }) {
  const [state, formAction] = useActionState(saveCrmEmailSettings, smtpInitialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state.message) toast.success(state.message);
    if (state.error) toast.error(state.error);
  }, [state, toast]);

  return (
    <form action={formAction}>
      <Card padding="none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" aria-hidden="true" />
            Custom SMTP
          </CardTitle>
          <CardDescription>
            Connect your own SMTP server to send emails. This gives you full control over your email delivery.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="From Name">
              <Input name="fromName" defaultValue={settings?.fromName} placeholder="e.g. SabNode Support" required />
            </Field>
            <Field label="From Email">
              <Input name="fromEmail" type="email" defaultValue={settings?.fromEmail} placeholder="e.g. support@yourdomain.com" required />
            </Field>
          </div>
          <Separator />
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="SMTP Host">
              <Input name="smtpHost" defaultValue={settings?.smtp?.host} placeholder="smtp.example.com" required />
            </Field>
            <Field label="SMTP Port">
              <Input name="smtpPort" type="number" defaultValue={settings?.smtp?.port ?? 587} required />
            </Field>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="SMTP Username">
              <Input name="smtpUser" defaultValue={settings?.smtp?.user} required />
            </Field>
            <Field label="SMTP Password">
              <Input name="smtpPass" type="password" defaultValue={settings?.smtp?.pass} required />
            </Field>
          </div>
          <Checkbox
            name="smtpSecure"
            defaultChecked={settings?.smtp?.secure !== false}
            label="Use SSL/TLS Encryption"
          />
        </CardBody>
        <CardFooter>
          <SmtpSubmitButton />
        </CardFooter>
      </Card>
    </form>
  );
}

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton height={40} width={256} />
            <Skeleton height={16} width={384} />
            <Skeleton height={256} width="100%" />
            <Skeleton height={192} width="100%" />
        </div>
    );
}

const complianceInitialState = { message: undefined, error: undefined };

function ComplianceForm({ user }: { user: WithId<User> }) {
    const { toast } = useToast();
    const [state, formAction] = useActionState(saveEmailComplianceSettings, complianceInitialState);
    const { pending } = useFormStatus();

    useEffect(() => {
        if (state.message) toast.success(state.message);
        if (state.error) toast.error(state.error);
    }, [state, toast]);

    const compliance = user.emailSettings?.compliance || { unsubscribeLink: true, physicalAddress: '' };

    return (
        <form action={formAction}>
            <Card padding="none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" aria-hidden="true" />Compliance and Unsubscribe</CardTitle>
                    <CardDescription>Configure settings to comply with anti-spam laws like CAN-SPAM and GDPR.</CardDescription>
                </CardHeader>
                <CardBody className="space-y-4">
                    <div className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
                        <Switch
                            id="unsubscribeLink"
                            name="unsubscribeLink"
                            defaultChecked={compliance.unsubscribeLink}
                            label="Automatically include an unsubscribe link in email footers."
                        />
                    </div>
                    <Field
                        label="Physical Mailing Address"
                        help="Required by CAN-SPAM for all commercial emails."
                    >
                        <Textarea name="physicalAddress" placeholder="e.g. 123 Main St, Anytown, USA 12345" defaultValue={compliance.physicalAddress} />
                    </Field>
                </CardBody>
                <CardFooter>
                    <Button type="submit" variant="primary" loading={pending} iconLeft={Save}>
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
        <Card padding="none">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" aria-hidden="true" />Domain Authentication</CardTitle>
                <CardDescription>Improve your email deliverability by adding DKIM and SPF records to your domain&apos;s DNS settings.</CardDescription>
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
                <Alert tone="info" title="Note">
                    DNS changes can take up to 48 hours to propagate. These values are placeholders; your specific records will be provided upon domain verification.
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
            <Card padding="none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" aria-hidden="true" />API and Webhooks</CardTitle>
                    <CardDescription>Programmatically interact with your email data.</CardDescription>
                </CardHeader>
                <CardBody className="space-y-4">
                    <Field label="API Key">
                        <CodeBlock code={apiKey} />
                    </Field>
                    <Field label="Webhook URL for Incoming Events">
                        <CodeBlock code={webhookUrl} />
                    </Field>
                </CardBody>
            </Card>
            <Card padding="none">
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

interface OnboardingCardProps {
    title: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
    href?: string;
    features: string[];
}

function OnboardingCard({ title, description, icon: Icon, href, features }: OnboardingCardProps) {
    return (
        <Card variant="interactive" padding="none" className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <Icon className="h-6 w-6" />
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardBody className="flex-grow">
                <ul className="text-sm text-[var(--st-text-secondary)] space-y-2 mb-6">
                    {features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--st-text)] mt-1.5 shrink-0" aria-hidden="true" />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
            </CardBody>
            <CardFooter>
                {href ? (
                    <Button
                        variant="primary"
                        block
                        onClick={() => { window.location.assign(href); }}
                    >
                        {title === 'Custom SMTP' ? 'Configure SMTP' : `Connect ${title}`}
                    </Button>
                ) : (
                    <div className="w-full mt-4">
                        <SmtpForm settings={null} />
                    </div>
                )}
            </CardFooter>
        </Card>
    )
}

const SETTINGS_NAV = [
    { value: 'email', label: 'Configuration', icon: Settings },
    { value: 'templates', label: 'Templates', icon: FileText },
    { value: 'compliance', label: 'Compliance', icon: ShieldCheck },
    { value: 'deliverability', label: 'Deliverability', icon: BarChart3 },
    { value: 'integrations', label: 'Other Integrations', icon: Zap },
] as const;

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
            <Alert tone="danger" title="Not Logged In">
                Please log in to manage email settings.
            </Alert>
        );
    }

    if (view === 'list') {
        return (
            <div className="space-y-8">
                <PageHeader>
                    <PageHeading>
                        <PageTitle>
                            <span className="inline-flex items-center gap-3">
                                <Mail className="h-7 w-7" aria-hidden="true" /> Email Suite
                            </span>
                        </PageTitle>
                        <PageDescription>Manage your connected email accounts.</PageDescription>
                    </PageHeading>
                    <PageActions>
                        <Button variant="primary" iconLeft={Plus} onClick={() => router.push('/dashboard/email/settings?view=connect')}>
                            Connect New Account
                        </Button>
                    </PageActions>
                </PageHeader>

                {allSettings.length === 0 ? (
                    <Card padding="none">
                        <CardBody className="py-16">
                            <EmptyState
                                icon={Mail}
                                title="No email accounts yet"
                                description="Connect a Gmail, Outlook, or custom SMTP account to start sending campaigns and syncing conversations."
                                action={
                                    <Button variant="primary" iconLeft={Plus} onClick={() => router.push('/dashboard/email/settings?view=connect')}>
                                        Connect Your First Account
                                    </Button>
                                }
                            />
                        </CardBody>
                    </Card>
                ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allSettings.map((account) => {
                        const Icon = account.provider === 'google' ? GoogleIcon : account.provider === 'outlook' ? OutlookIcon : Mail;
                        return (
                            <Card key={account._id.toString()} variant="interactive" padding="none" onClick={() => {
                                router.push(`/dashboard/email/settings?view=manage&accountId=${account._id.toString()}`);
                            }}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <span className="p-3 bg-[var(--st-bg-secondary)] rounded-full" aria-hidden="true">
                                            <Icon className="h-6 w-6 text-[var(--st-text)]" />
                                        </span>
                                        <Badge tone="success" className="inline-flex items-center"><CheckCircle className="h-3 w-3 mr-1" aria-hidden="true" /> Active</Badge>
                                    </div>
                                    <CardTitle className="pt-4 truncate">{account.fromName || 'Unnamed Account'}</CardTitle>
                                    <CardDescription className="truncate">{account.fromEmail}</CardDescription>
                                </CardHeader>
                                <CardFooter>
                                    <Button variant="outline" block>Manage Settings</Button>
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
                        <Button variant="ghost" iconLeft={ArrowLeft} onClick={() => router.push('/dashboard/email')}>
                            Back to Accounts
                        </Button>
                    </div>

                    <div className="text-center space-y-4 max-w-2xl">
                        <span className="bg-[var(--st-bg-secondary)] p-4 rounded-full w-fit mx-auto block" aria-hidden="true">
                            <Mail className="h-12 w-12 text-[var(--st-text)] mx-auto" />
                        </span>
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
                                features={["One-click secure OAuth", "Sync emails and threads", "Import Google Contacts"]}
                            />
                            <OnboardingCard
                                title="Outlook"
                                description="For Microsoft 365 and Outlook."
                                icon={OutlookIcon}
                                href="/api/crm/auth/outlook/connect"
                                features={["Enterprise grade security", "Seamless integration", "Calendar sync ready"]}
                            />
                        </div>
                        <Card padding="lg">
                            <div className="flex flex-col justify-center gap-4">
                                <div className="flex items-center gap-3 mb-2 text-[var(--st-text)]">
                                    <Mail className="h-6 w-6" aria-hidden="true" /> Custom SMTP
                                </div>
                                <p className="text-sm text-[var(--st-text-secondary)] mb-4">Connect any email provider via SMTP/IMAP credentials.</p>
                                <div className="flex-grow">
                                    <SmtpForm settings={null} />
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </EmailSuiteLayout>
        )
    }

    const currentSettings = allSettings.find(s => s._id.toString() === activeSettingsId);
    if (!currentSettings && activeSettingsId) {
        return (
            <EmailSuiteLayout>
                <EmptyState icon={AlertCircle} title="Account not found." />
            </EmailSuiteLayout>
        );
    }

    if (!currentSettings) {
        return <EmailSuiteLayout><div /></EmailSuiteLayout>;
    }

    return (
        <EmailSuiteLayout>
            <div className="flex flex-col gap-8 h-full">
                <div className="flex items-center gap-4 mb-2">
                    <Button variant="ghost" size="sm" iconLeft={ArrowLeft} onClick={() => {
                        router.push('/dashboard/email');
                    }}>
                        Back
                    </Button>
                    <span className="text-[var(--st-text-secondary)]" aria-hidden="true">/</span>
                    <span className="text-[var(--st-text)]">{currentSettings?.fromEmail}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] gap-6 items-start h-full">
                    <aside className="hidden md:block sticky top-0 h-full overflow-y-auto pr-4 border-r border-[var(--st-border)]">
                        <nav className="flex flex-col gap-2" aria-label="Email settings">
                            <div className="px-4 py-2 mb-2">
                                <h2 className="text-lg text-[var(--st-text)]">Email Settings</h2>
                            </div>
                            {SETTINGS_NAV.map((item) => {
                                const isActive = activeTab === item.value;
                                return (
                                    <Button
                                        key={item.value}
                                        variant={isActive ? 'secondary' : 'ghost'}
                                        iconLeft={item.icon}
                                        className="justify-start w-full"
                                        aria-current={isActive ? 'page' : undefined}
                                        onClick={() => setActiveTab(item.value)}
                                    >
                                        {item.label}
                                    </Button>
                                );
                            })}
                        </nav>
                    </aside>
                    <main className="flex-1 overflow-visible min-w-0">
                    {activeTab === 'email' && currentSettings && (
                        <div className="space-y-6">
                            <Card padding="none">
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-[var(--st-status-ok)] animate-pulse" aria-hidden="true" />
                                            Connected via <span className="capitalize">{currentSettings.provider}</span>
                                        </span>
                                        <Badge tone="neutral">{currentSettings.fromEmail}</Badge>
                                    </CardTitle>
                                    <CardDescription>This account is active and ready to send campaigns.</CardDescription>
                                </CardHeader>
                                <CardBody>
                                    <div className="flex items-center gap-4">
                                        <Button variant="outline">Re-authorize Connection</Button>
                                        <Button variant="danger" iconLeft={Trash2} onClick={async () => {
                                            if (confirm('Are you sure you want to disconnect this account? This action cannot be undone.')) {
                                                setIsLoading(true);
                                                const result = await disconnectEmailSettings(currentSettings._id.toString());
                                                if (result.message) {
                                                    toast.success(result.message);
                                                    router.push('/dashboard/email');
                                                } else if (result.error) {
                                                    toast.error(result.error);
                                                }
                                                setIsLoading(false);
                                            }
                                        }}>
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
                                        <SmtpForm settings={currentSettings} />
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
                                <Button variant="primary" onClick={() => router.push('/dashboard/email/templates')}>
                                    Open template library
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
                    </main>
                </div>
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
