'use client';

import { useEffect, useState } from 'react';
import { Bell, LoaderCircle, Mail, Save, Smartphone } from 'lucide-react';

import {
    ZoruBreadcrumb,
    ZoruBreadcrumbItem,
    ZoruBreadcrumbLink,
    ZoruBreadcrumbList,
    ZoruBreadcrumbPage,
    ZoruBreadcrumbSeparator,
    ZoruButton,
    ZoruCard,
    ZoruLabel,
    ZoruPageDescription,
    ZoruPageHeader,
    ZoruPageHeading,
    ZoruPageTitle,
    ZoruSwitch,
    useZoruToast,
} from '@/components/zoruui';
import {
    getNotificationPrefs,
    setNotificationPrefs,
} from '@/app/actions/account.actions';

type Prefs = Record<string, boolean>;

const GROUPS: Array<{
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    rows: Array<{ id: string; label: string; description: string }>;
}> = [
    {
        title: 'Account activity',
        description: 'Important events tied to your login and billing.',
        icon: Mail,
        rows: [
            { id: 'billing_receipts', label: 'Billing receipts', description: 'Invoices and payment confirmations.' },
            { id: 'plan_changes', label: 'Plan changes', description: 'When a plan is upgraded, downgraded, or about to expire.' },
            { id: 'low_credits', label: 'Low credit alerts', description: 'Warn when broadcast/SMS/email credits are running out.' },
        ],
    },
    {
        title: 'Product updates',
        description: 'News from the SabNode product team.',
        icon: Bell,
        rows: [
            { id: 'release_notes', label: 'Release notes', description: 'Monthly summary of new features.' },
            { id: 'incidents', label: 'Incidents & status', description: 'Emails when a platform incident affects your workspace.' },
            { id: 'newsletter', label: 'Marketing newsletter', description: 'Optional playbook + case-study digest.' },
        ],
    },
    {
        title: 'Mobile push',
        description: 'Sent to your installed SabNode apps.',
        icon: Smartphone,
        rows: [
            { id: 'push_messages', label: 'Inbound messages', description: 'WhatsApp / Telegram / IG messages to your numbers.' },
            { id: 'push_mentions', label: 'Mentions', description: "When you're @-mentioned in team chat or tasks." },
            { id: 'push_approvals', label: 'Approval requests', description: 'Broadcasts and campaigns awaiting your sign-off.' },
        ],
    },
];

const DEFAULTS: Prefs = {
    billing_receipts: true,
    plan_changes: true,
    low_credits: true,
    release_notes: true,
    incidents: true,
    newsletter: false,
    push_messages: true,
    push_mentions: true,
    push_approvals: false,
};

export default function NotificationsSettingsPage() {
    const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
    const [saving, setSaving] = useState(false);
    const { toast } = useZoruToast();

    useEffect(() => {
        let cancelled = false;
        getNotificationPrefs()
            .then((server) => {
                if (cancelled) return;
                setPrefs({ ...DEFAULTS, ...server });
            })
            .catch(() => {
                /* fall through to defaults */
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const toggle = (id: string) => setPrefs((p) => ({ ...p, [id]: !p[id] }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await setNotificationPrefs(prefs);
            toast({ title: 'Preferences saved' });
        } catch (e: any) {
            toast({
                title: 'Could not save preferences',
                description: e?.message ?? 'Try again.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex min-h-full flex-col gap-6">
            <ZoruBreadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/settings">Settings</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Notifications</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </ZoruBreadcrumb>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <ZoruPageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>Notifications</ZoruPageTitle>
                        <ZoruPageDescription>
                            Choose which account and product events SabNode should email or push to you.
                        </ZoruPageDescription>
                    </ZoruPageHeading>
                </ZoruPageHeader>
                <ZoruButton size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Saving…' : 'Save preferences'}
                </ZoruButton>
            </div>

            {GROUPS.map((group) => (
                <ZoruCard key={group.title} className="p-6">
                    <div className="mb-4 flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
                            <group.icon className="h-4 w-4" strokeWidth={2} />
                        </div>
                        <div>
                            <p className="text-sm text-zoru-ink">{group.title}</p>
                            <p className="text-xs text-zoru-ink-muted">{group.description}</p>
                        </div>
                    </div>
                    <ul className="divide-y divide-zoru-line">
                        {group.rows.map((row) => (
                            <li key={row.id} className="flex items-start justify-between gap-4 py-3">
                                <div>
                                    <ZoruLabel htmlFor={row.id} className="text-[13px]">
                                        {row.label}
                                    </ZoruLabel>
                                    <p className="mt-0.5 text-xs text-zoru-ink-muted">{row.description}</p>
                                </div>
                                <ZoruSwitch id={row.id} checked={!!prefs[row.id]} onCheckedChange={() => toggle(row.id)} />
                            </li>
                        ))}
                    </ul>
                </ZoruCard>
            ))}
        </div>
    );
}
