'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Switch,
  useZoruToast,
} from '@/components/zoruui';
import {
  useState } from 'react';
import { Bell,
  Save,
  Mail,
  LoaderCircle } from 'lucide-react';

type Prefs = {
    memberJoined: boolean;
    memberRemoved: boolean;
    roleChanged: boolean;
    inviteAccepted: boolean;
    inviteExpired: boolean;
    taskAssigned: boolean;
    mentioned: boolean;
    dailyDigest: boolean;
    weeklyDigest: boolean;
};

const DEFAULTS: Prefs = {
    memberJoined: true,
    memberRemoved: true,
    roleChanged: true,
    inviteAccepted: true,
    inviteExpired: false,
    taskAssigned: true,
    mentioned: true,
    dailyDigest: false,
    weeklyDigest: true,
};

const GROUPS: Array<{
    title: string;
    description: string;
    keys: Array<{ id: keyof Prefs; label: string; description: string }>;
}> = [
    {
        title: 'Membership events',
        description: 'Get notified when people join, leave, or change roles.',
        keys: [
            { id: 'memberJoined', label: 'Member joined', description: 'Someone accepts an invitation to your workspace.' },
            { id: 'memberRemoved', label: 'Member removed', description: 'An admin removes a teammate.' },
            { id: 'roleChanged', label: 'Role changed', description: "A teammate's permissions are updated." },
        ],
    },
    {
        title: 'Invitations',
        description: 'Keep tabs on outstanding invites.',
        keys: [
            { id: 'inviteAccepted', label: 'Invitation accepted', description: 'Your invite email turned into a new teammate.' },
            { id: 'inviteExpired', label: 'Invitation expired', description: "A pending invite hit its 7-day TTL." },
        ],
    },
    {
        title: 'Collaboration',
        description: 'Direct pings from tasks, chat, and activity.',
        keys: [
            { id: 'taskAssigned', label: 'Task assigned to me', description: 'Another teammate assigns you a task.' },
            { id: 'mentioned', label: 'Mentioned in chat', description: 'Someone @-mentions you in team chat.' },
        ],
    },
    {
        title: 'Digests',
        description: 'Periodic summaries — easy to skim in your inbox.',
        keys: [
            { id: 'dailyDigest', label: 'Daily digest email', description: 'One email per morning with yesterday\'s activity.' },
            { id: 'weeklyDigest', label: 'Weekly digest email', description: 'Monday-morning summary of the past week.' },
        ],
    },
];

export default function TeamNotificationsPage() {
    const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
    const [saving, setSaving] = useState(false);
    const { toast } = useZoruToast();

    const toggle = (key: keyof Prefs) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

    const handleSave = async () => {
        setSaving(true);
        // Preferences are persisted client-side until the backend endpoint lands.
        // Keep parity with the shape the server expects when wired up.
        try {
            localStorage.setItem('team_notification_prefs', JSON.stringify(prefs));
            toast({ title: 'Preferences saved' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex min-h-full flex-col gap-6">
            <ZoruBreadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/team">Team</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Notifications</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </ZoruBreadcrumb>

            <ZoruPageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>Notifications</ZoruPageTitle>
                    <ZoruPageDescription>
                        Choose which team events should land in your inbox.
                    </ZoruPageDescription>
                </ZoruPageHeading>
                <ZoruButton size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Saving…' : 'Save preferences'}
                </ZoruButton>
            </ZoruPageHeader>

            <ZoruCard variant="soft" className="flex items-center gap-3 p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
                    <Mail className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-[13px] text-zoru-ink">Delivery channel</p>
                    <p className="text-[12.5px] text-zoru-ink-muted">
                        Emails go to your account address. Push and Slack delivery arrive later.
                    </p>
                </div>
            </ZoruCard>

            {GROUPS.map((group) => (
                <ZoruCard key={group.title} className="p-6">
                    <div className="mb-4 flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                            <Bell className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-[13.5px] text-zoru-ink">{group.title}</p>
                            <p className="text-[12.5px] text-zoru-ink-muted">{group.description}</p>
                        </div>
                    </div>
                    <ul className="divide-y divide-zoru-line">
                        {group.keys.map((row) => (
                            <li key={row.id} className="flex items-start justify-between gap-4 py-3">
                                <div>
                                    <ZoruLabel htmlFor={row.id} className="text-[13px] text-zoru-ink">
                                        {row.label}
                                    </ZoruLabel>
                                    <p className="mt-0.5 text-[12px] text-zoru-ink-muted">{row.description}</p>
                                </div>
                                <ZoruSwitch
                                    id={row.id}
                                    checked={prefs[row.id]}
                                    onCheckedChange={() => toggle(row.id)}
                                />
                            </li>
                        ))}
                    </ul>
                </ZoruCard>
            ))}
        </div>
    );
}
