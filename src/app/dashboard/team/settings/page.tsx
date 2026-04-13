'use client';

import { useState } from 'react';
import {
    LuSettings,
    LuSave,
    LuClock,
    LuShieldCheck,
    LuMail,
    LuLoaderCircle,
} from 'react-icons/lu';

import {
    ClayBreadcrumbs,
    ClayButton,
    ClayCard,
    ClayInput,
    ClaySectionHeader,
    ClaySelect,
} from '@/components/clay';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type Settings = {
    defaultRole: 'agent' | 'admin';
    inviteTtlDays: number;
    requireInviteApproval: boolean;
    agentSignature: string;
    autoAssignRound: boolean;
    businessHoursEnabled: boolean;
    businessHoursOpen: string;
    businessHoursClose: string;
    timezone: string;
};

const DEFAULTS: Settings = {
    defaultRole: 'agent',
    inviteTtlDays: 7,
    requireInviteApproval: false,
    agentSignature: '',
    autoAssignRound: true,
    businessHoursEnabled: false,
    businessHoursOpen: '09:00',
    businessHoursClose: '18:00',
    timezone: 'UTC',
};

const TIMEZONES = [
    'UTC',
    'America/Los_Angeles',
    'America/New_York',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
];

export default function TeamSettingsPage() {
    const [settings, setSettings] = useState<Settings>(DEFAULTS);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        setSettings((s) => ({ ...s, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            localStorage.setItem('team_workspace_settings', JSON.stringify(settings));
            toast({ title: 'Settings saved' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'Team', href: '/dashboard/team' },
                    { label: 'Workspace settings' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Workspace settings"
                subtitle="Defaults for invites, agent routing, and business hours."
                actions={
                    <ClayButton
                        variant="obsidian"
                        size="sm"
                        leading={saving ? <LuLoaderCircle className="h-4 w-4 animate-spin" /> : <LuSave className="h-4 w-4" />}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Saving…' : 'Save settings'}
                    </ClayButton>
                }
            />

            {/* Invitations */}
            <ClayCard padded>
                <SectionHeader
                    icon={<LuMail className="h-4 w-4" />}
                    title="Invitations"
                    description="Defaults applied to every new invite you send."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Default role for new members">
                        <ClaySelect
                            value={settings.defaultRole}
                            onChange={(e) => update('defaultRole', e.target.value as Settings['defaultRole'])}
                            options={[
                                { value: 'agent', label: 'Agent' },
                                { value: 'admin', label: 'Admin' },
                            ]}
                        />
                    </Field>
                    <Field label="Invitation TTL (days)">
                        <ClayInput
                            type="number"
                            min={1}
                            max={30}
                            value={settings.inviteTtlDays}
                            onChange={(e) =>
                                update('inviteTtlDays', Math.max(1, Math.min(30, Number(e.target.value) || 7)))
                            }
                        />
                    </Field>
                </div>
                <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-clay-border bg-clay-surface-subtle p-3">
                    <div>
                        <Label htmlFor="approval" className="text-[13px] font-medium text-clay-ink">
                            Require admin approval
                        </Label>
                        <p className="mt-0.5 text-[12px] text-clay-ink-muted">
                            Members can invite, but admins must approve before the email is sent.
                        </p>
                    </div>
                    <Switch
                        id="approval"
                        checked={settings.requireInviteApproval}
                        onCheckedChange={(v) => update('requireInviteApproval', v)}
                    />
                </div>
            </ClayCard>

            {/* Agent routing */}
            <ClayCard padded>
                <SectionHeader
                    icon={<LuShieldCheck className="h-4 w-4" />}
                    title="Agent defaults"
                    description="Signature and routing behaviour for chat + inbox modules."
                />
                <Field label="Signature appended to agent messages">
                    <ClayInput
                        placeholder="— {agentName}, Support"
                        value={settings.agentSignature}
                        onChange={(e) => update('agentSignature', e.target.value)}
                    />
                </Field>
                <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-clay-border bg-clay-surface-subtle p-3">
                    <div>
                        <Label htmlFor="round-robin" className="text-[13px] font-medium text-clay-ink">
                            Round-robin new conversations
                        </Label>
                        <p className="mt-0.5 text-[12px] text-clay-ink-muted">
                            Distribute incoming chats evenly among online agents.
                        </p>
                    </div>
                    <Switch
                        id="round-robin"
                        checked={settings.autoAssignRound}
                        onCheckedChange={(v) => update('autoAssignRound', v)}
                    />
                </div>
            </ClayCard>

            {/* Business hours */}
            <ClayCard padded>
                <SectionHeader
                    icon={<LuClock className="h-4 w-4" />}
                    title="Business hours"
                    description="Used by away-replies and routing. Messages outside hours trigger the away rule."
                />
                <div className="mb-4 flex items-start justify-between gap-4 rounded-xl border border-clay-border bg-clay-surface-subtle p-3">
                    <div>
                        <Label htmlFor="bh-enabled" className="text-[13px] font-medium text-clay-ink">
                            Enable business hours
                        </Label>
                        <p className="mt-0.5 text-[12px] text-clay-ink-muted">
                            When off, agents are treated as always available.
                        </p>
                    </div>
                    <Switch
                        id="bh-enabled"
                        checked={settings.businessHoursEnabled}
                        onCheckedChange={(v) => update('businessHoursEnabled', v)}
                    />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Opens">
                        <ClayInput
                            type="time"
                            value={settings.businessHoursOpen}
                            onChange={(e) => update('businessHoursOpen', e.target.value)}
                            disabled={!settings.businessHoursEnabled}
                        />
                    </Field>
                    <Field label="Closes">
                        <ClayInput
                            type="time"
                            value={settings.businessHoursClose}
                            onChange={(e) => update('businessHoursClose', e.target.value)}
                            disabled={!settings.businessHoursEnabled}
                        />
                    </Field>
                    <Field label="Timezone">
                        <ClaySelect
                            value={settings.timezone}
                            onChange={(e) => update('timezone', e.target.value)}
                            disabled={!settings.businessHoursEnabled}
                            options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
                        />
                    </Field>
                </div>
            </ClayCard>
        </div>
    );
}

function SectionHeader({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="mb-4 flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-clay-surface-subtle text-clay-ink-muted">
                {icon}
            </div>
            <div>
                <p className="text-[13.5px] font-semibold text-clay-ink">{title}</p>
                <p className="text-[12.5px] text-clay-ink-muted">{description}</p>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Label className="mb-1.5 block text-[12.5px] font-medium text-clay-ink">{label}</Label>
            {children}
        </div>
    );
}
