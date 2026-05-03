'use client';

import { useEffect, useState } from 'react';
import { LuBell, LuMail, LuSave, LuLoaderCircle, LuSmartphone } from 'react-icons/lu';

import {
    ClayBreadcrumbs,
    ClayButton,
    ClayCard,
    ClaySectionHeader,
} from '@/components/clay';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

type Prefs = Record<string, boolean>;

const STORAGE_KEY = 'settings_notification_prefs_v1';

const GROUPS: Array<{
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    rows: Array<{ id: string; label: string; description: string }>;
}> = [
    {
        title: 'Account activity',
        description: 'Important events tied to your login and billing.',
        icon: LuMail,
        rows: [
            { id: 'billing_receipts', label: 'Billing receipts', description: 'Invoices and payment confirmations.' },
            { id: 'plan_changes', label: 'Plan changes', description: 'When a plan is upgraded, downgraded, or about to expire.' },
            { id: 'low_credits', label: 'Low credit alerts', description: 'Warn when broadcast/SMS/email credits are running out.' },
        ],
    },
    {
        title: 'Product updates',
        description: 'News from the SabNode product team.',
        icon: LuBell,
        rows: [
            { id: 'release_notes', label: 'Release notes', description: 'Monthly summary of new features.' },
            { id: 'incidents', label: 'Incidents & status', description: 'Emails when a platform incident affects your workspace.' },
            { id: 'newsletter', label: 'Marketing newsletter', description: 'Optional playbook + case-study digest.' },
        ],
    },
    {
        title: 'Mobile push',
        description: 'Sent to your installed SabNode apps.',
        icon: LuSmartphone,
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
    const { toast } = useToast();

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
        } catch { /* ignore */ }
    }, []);

    const toggle = (id: string) => setPrefs((p) => ({ ...p, [id]: !p[id] }));

    const handleSave = async () => {
        setSaving(true);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
            toast({ title: 'Preferences saved' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'Settings', href: '/dashboard/settings' },
                    { label: 'Notifications' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Notifications"
                subtitle="Choose which account and product events SabNode should email or push to you."
                actions={
                    <ClayButton
                        variant="obsidian"
                        size="sm"
                        leading={saving ? <LuLoaderCircle className="h-4 w-4 animate-spin" /> : <LuSave className="h-4 w-4" />}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Saving…' : 'Save preferences'}
                    </ClayButton>
                }
            />

            {GROUPS.map((group) => (
                <ClayCard key={group.title} padded>
                    <div className="mb-4 flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-primary">
                            <group.icon className="h-4 w-4" strokeWidth={2} />
                        </div>
                        <div>
                            <p className="text-[13.5px] font-semibold text-foreground">{group.title}</p>
                            <p className="text-[12.5px] text-muted-foreground">{group.description}</p>
                        </div>
                    </div>
                    <ul className="divide-y divide-border">
                        {group.rows.map((row) => (
                            <li key={row.id} className="flex items-start justify-between gap-4 py-3">
                                <div>
                                    <Label htmlFor={row.id} className="text-[13px] font-medium text-foreground">
                                        {row.label}
                                    </Label>
                                    <p className="mt-0.5 text-[12px] text-muted-foreground">{row.description}</p>
                                </div>
                                <Switch id={row.id} checked={!!prefs[row.id]} onCheckedChange={() => toggle(row.id)} />
                            </li>
                        ))}
                    </ul>
                </ClayCard>
            ))}
        </div>
    );
}
