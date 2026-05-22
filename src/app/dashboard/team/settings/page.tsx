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
  Input,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  useZoruToast,
} from '@/components/zoruui';
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
    const { toast } = useZoruToast();

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
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/team">Team</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Workspace settings</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </Breadcrumb>

            <PageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>Workspace settings</ZoruPageTitle>
                    <ZoruPageDescription>
                        Defaults for invites, agent routing, and business hours.
                    </ZoruPageDescription>
                </ZoruPageHeading>
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
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="agent">Agent</ZoruSelectItem>
                                <ZoruSelectItem value="admin">Admin</ZoruSelectItem>
                            </ZoruSelectContent>
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
                <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-zoru-line bg-zoru-surface-2/50 p-3">
                    <div>
                        <Label htmlFor="approval" className="text-[13px] text-zoru-ink">
                            Require admin approval
                        </Label>
                        <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
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
                <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-zoru-line bg-zoru-surface-2/50 p-3">
                    <div>
                        <Label htmlFor="round-robin" className="text-[13px] text-zoru-ink">
                            Round-robin new conversations
                        </Label>
                        <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
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
                <div className="mb-4 flex items-start justify-between gap-4 rounded-xl border border-zoru-line bg-zoru-surface-2/50 p-3">
                    <div>
                        <Label htmlFor="bh-enabled" className="text-[13px] text-zoru-ink">
                            Enable business hours
                        </Label>
                        <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
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
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {TIMEZONES.map((tz) => (
                                    <ZoruSelectItem key={tz} value={tz}>
                                        {tz}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                {icon}
            </div>
            <div>
                <p className="text-[13.5px] text-zoru-ink">{title}</p>
                <p className="text-[12.5px] text-zoru-ink-muted">{description}</p>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Label className="mb-1.5 block text-[12.5px] text-zoru-ink">{label}</Label>
            {children}
        </div>
    );
}
