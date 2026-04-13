'use client';

import { useState } from 'react';
import { LuBell, LuSave, LuMail, LuLoaderCircle } from 'react-icons/lu';

import {
    ClayBreadcrumbs,
    ClayButton,
    ClayCard,
    ClaySectionHeader,
} from '@/components/clay';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

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
    const { toast } = useToast();

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
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'Team', href: '/dashboard/team' },
                    { label: 'Notifications' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Notifications"
                subtitle="Choose which team events should land in your inbox."
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

            <ClayCard variant="soft" padded className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-rose-soft text-clay-rose">
                    <LuMail className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-[13px] font-semibold text-clay-ink">Delivery channel</p>
                    <p className="text-[12.5px] text-clay-ink-muted">
                        Emails go to your account address. Push and Slack delivery arrive later.
                    </p>
                </div>
            </ClayCard>

            {GROUPS.map((group) => (
                <ClayCard key={group.title} padded>
                    <div className="mb-4 flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-clay-surface-subtle text-clay-ink-muted">
                            <LuBell className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-[13.5px] font-semibold text-clay-ink">{group.title}</p>
                            <p className="text-[12.5px] text-clay-ink-muted">{group.description}</p>
                        </div>
                    </div>
                    <ul className="divide-y divide-clay-border">
                        {group.keys.map((row) => (
                            <li key={row.id} className="flex items-start justify-between gap-4 py-3">
                                <div>
                                    <Label htmlFor={row.id} className="text-[13px] font-medium text-clay-ink">
                                        {row.label}
                                    </Label>
                                    <p className="mt-0.5 text-[12px] text-clay-ink-muted">{row.description}</p>
                                </div>
                                <Switch
                                    id={row.id}
                                    checked={prefs[row.id]}
                                    onCheckedChange={() => toggle(row.id)}
                                />
                            </li>
                        ))}
                    </ul>
                </ClayCard>
            ))}
        </div>
    );
}
