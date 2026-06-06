'use client';

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, Input, Label, PageDescription, PageHeader, PageHeading, PageTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, useToast } from '@/components/sabcrm/20ui';
import {
  useState } from 'react';
import { Settings,
  Save,
  Clock,
  ShieldCheck,
  Mail,
  LoaderCircle } from 'lucide-react';

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
        <div className="flex min-h-full flex-col gap-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/team">Team</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Workspace settings</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader>
                <PageHeading>
                    <PageTitle>Workspace settings</PageTitle>
                    <PageDescription>
                        Defaults for invites, agent routing, and business hours.
                    </PageDescription>
                </PageHeading>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Saving…' : 'Save settings'}
                </Button>
            </PageHeader>

            {/* Invitations */}
            <Card className="p-6">
                <SectionHeader
                    icon={<Mail className="h-4 w-4" />}
                    title="Invitations"
                    description="Defaults applied to every new invite you send."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Default role for new members">
                        <Select
                            value={settings.defaultRole}
                            onValueChange={(v) => update('defaultRole', v as Settings['defaultRole'])}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="agent">Agent</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Invitation TTL (days)">
                        <Input
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
                <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 p-3">
                    <div>
                        <Label htmlFor="approval" className="text-[13px] text-[var(--st-text)]">
                            Require admin approval
                        </Label>
                        <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                            Members can invite, but admins must approve before the email is sent.
                        </p>
                    </div>
                    <Switch
                        id="approval"
                        checked={settings.requireInviteApproval}
                        onCheckedChange={(v) => update('requireInviteApproval', v)}
                    />
                </div>
            </Card>

            {/* Agent routing */}
            <Card className="p-6">
                <SectionHeader
                    icon={<ShieldCheck className="h-4 w-4" />}
                    title="Agent defaults"
                    description="Signature and routing behaviour for chat + inbox modules."
                />
                <Field label="Signature appended to agent messages">
                    <Input
                        placeholder="— {agentName}, Support"
                        value={settings.agentSignature}
                        onChange={(e) => update('agentSignature', e.target.value)}
                    />
                </Field>
                <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 p-3">
                    <div>
                        <Label htmlFor="round-robin" className="text-[13px] text-[var(--st-text)]">
                            Round-robin new conversations
                        </Label>
                        <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                            Distribute incoming chats evenly among online agents.
                        </p>
                    </div>
                    <Switch
                        id="round-robin"
                        checked={settings.autoAssignRound}
                        onCheckedChange={(v) => update('autoAssignRound', v)}
                    />
                </div>
            </Card>

            {/* Business hours */}
            <Card className="p-6">
                <SectionHeader
                    icon={<Clock className="h-4 w-4" />}
                    title="Business hours"
                    description="Used by away-replies and routing. Messages outside hours trigger the away rule."
                />
                <div className="mb-4 flex items-start justify-between gap-4 rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 p-3">
                    <div>
                        <Label htmlFor="bh-enabled" className="text-[13px] text-[var(--st-text)]">
                            Enable business hours
                        </Label>
                        <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
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
                        <Input
                            type="time"
                            value={settings.businessHoursOpen}
                            onChange={(e) => update('businessHoursOpen', e.target.value)}
                            disabled={!settings.businessHoursEnabled}
                        />
                    </Field>
                    <Field label="Closes">
                        <Input
                            type="time"
                            value={settings.businessHoursClose}
                            onChange={(e) => update('businessHoursClose', e.target.value)}
                            disabled={!settings.businessHoursEnabled}
                        />
                    </Field>
                    <Field label="Timezone">
                        <Select
                            value={settings.timezone}
                            onValueChange={(v) => update('timezone', v)}
                            disabled={!settings.businessHoursEnabled}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TIMEZONES.map((tz) => (
                                    <SelectItem key={tz} value={tz}>
                                        {tz}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                </div>
            </Card>
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                {icon}
            </div>
            <div>
                <p className="text-[13.5px] text-[var(--st-text)]">{title}</p>
                <p className="text-[12.5px] text-[var(--st-text-secondary)]">{description}</p>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Label className="mb-1.5 block text-[12.5px] text-[var(--st-text)]">{label}</Label>
            {children}
        </div>
    );
}
