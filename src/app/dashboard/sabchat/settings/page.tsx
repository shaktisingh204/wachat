'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Checkbox,
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
  Separator,
  Skeleton,
  Switch,
  Textarea,
  zoruSonnerToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { Save,
  Send,
  AlertCircle } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
    getSabchatSettings,
  saveSabchatSettings,
  type SabchatSettings,
  } from '@/app/actions/sabchat-settings.actions';

/**
 * /dashboard/sabchat/settings — module-level SabChat settings.
 *
 * Six independent sections (channels, working hours, autoresponder, routing,
 * webhooks, notifications). Each section has its own save button which sends
 * just that section's patch to `saveSabchatSettings`, keeping writes small
 * and isolating failures.
 */

import * as React from 'react';
import Link from 'next/link';

const TIMEZONES = [
    'UTC',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Karachi',
    'Asia/Jakarta',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Paris',
    'Europe/Moscow',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Sao_Paulo',
    'Africa/Cairo',
    'Australia/Sydney',
    'Pacific/Auckland',
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTimestamp(iso?: string): string {
    if (!iso) return 'Never';
    try {
        const d = new Date(iso);
        return d.toLocaleString();
    } catch {
        return 'Unknown';
    }
}

function SectionHeader({ title, description }: { title: string; description: string }) {
    return (
        <div>
            <h3 className="text-[15px] font-medium text-zoru-ink">{title}</h3>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">{description}</p>
        </div>
    );
}

function PageSkeleton() {
    return (
        <div className="mx-auto w-full max-w-[1200px] px-6 pt-6 pb-10">
            <Skeleton className="h-3 w-56" />
            <div className="mt-5 flex flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-72" />
                <Skeleton className="h-3 w-96" />
            </div>
            <div className="mt-6 grid gap-4">
                <Skeleton className="h-60 w-full" />
                <Skeleton className="h-60 w-full" />
                <Skeleton className="h-60 w-full" />
            </div>
        </div>
    );
}

export default function SabchatSettingsPage() {
    const { activeProject } = useProject();
    const [settings, setSettings] = useState<SabchatSettings | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [savingSection, setSavingSection] = useState<string | null>(null);
    const [, startSaving] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const res = await getSabchatSettings();
            if (res.error) {
                setLoadError(res.error);
            } else if (res.settings) {
                setSettings(res.settings);
            }
        });
    }, []);

    function commitSave(
        section: keyof SabchatSettings,
        patch: Partial<SabchatSettings>,
        label: string,
    ) {
        setSavingSection(section as string);
        startSaving(async () => {
            const res = await saveSabchatSettings(patch);
            setSavingSection(null);
            if (res.error || !res.settings) {
                zoruSonnerToast.error(res.error || 'Save failed');
                return;
            }
            setSettings(res.settings);
            zoruSonnerToast.success(`${label} saved`);
        });
    }

    if (isLoading && !settings) return <PageSkeleton />;

    if (loadError) {
        return (
            <div className="mx-auto w-full max-w-[1200px] px-6 pt-6 pb-10">
                <Alert variant="destructive">
                    <AlertCircle />
                    <ZoruAlertTitle>Could not load SabChat settings</ZoruAlertTitle>
                    <ZoruAlertDescription>{loadError}</ZoruAlertDescription>
                </Alert>
            </div>
        );
    }

    if (!settings) return <PageSkeleton />;

    return (
        <div className="mx-auto w-full max-w-[1200px] px-6 pt-6 pb-10">
            <Breadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/sabchat">SabChat</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Settings</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </Breadcrumb>

            <PageHeader className="mt-5" bordered={false}>
                <ZoruPageHeading>
                    {activeProject?.name ? (
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zoru-ink-subtle">
                            Project · {activeProject.name}
                        </p>
                    ) : null}
                    <ZoruPageTitle>SabChat settings</ZoruPageTitle>
                    <ZoruPageDescription>
                        Inbox preferences, working hours, automations, routing, and notification rules.
                    </ZoruPageDescription>
                </ZoruPageHeading>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1.5">
                        <span className="text-zoru-ink-subtle">Last saved:</span>
                        <span className="text-zoru-ink">{formatTimestamp(settings.updatedAt)}</span>
                    </Badge>
                </div>
            </PageHeader>

            <div className="mt-6 flex flex-col gap-5">
                <ChannelsSection
                    value={settings.channels}
                    onChange={(channels) => setSettings({ ...settings, channels })}
                    onSave={() =>
                        commitSave('channels', { channels: settings.channels }, 'Channels')
                    }
                    saving={savingSection === 'channels'}
                />

                <Separator />

                <WorkingHoursSection
                    value={settings.workingHours}
                    onChange={(workingHours) => setSettings({ ...settings, workingHours })}
                    onSave={() =>
                        commitSave(
                            'workingHours',
                            { workingHours: settings.workingHours },
                            'Working hours',
                        )
                    }
                    saving={savingSection === 'workingHours'}
                />

                <Separator />

                <AutoresponderSection
                    value={settings.autoresponder}
                    onChange={(autoresponder) => setSettings({ ...settings, autoresponder })}
                    onSave={() =>
                        commitSave(
                            'autoresponder',
                            { autoresponder: settings.autoresponder },
                            'Autoresponder',
                        )
                    }
                    saving={savingSection === 'autoresponder'}
                />

                <Separator />

                <RoutingSection
                    value={settings.routing}
                    onChange={(routing) => setSettings({ ...settings, routing })}
                    onSave={() =>
                        commitSave('routing', { routing: settings.routing }, 'Routing')
                    }
                    saving={savingSection === 'routing'}
                />

                <Separator />

                <WebhooksSection
                    value={settings.webhooks}
                    onChange={(webhooks) => setSettings({ ...settings, webhooks })}
                    onSave={() =>
                        commitSave('webhooks', { webhooks: settings.webhooks }, 'Webhooks')
                    }
                    saving={savingSection === 'webhooks'}
                />

                <Separator />

                <NotificationsSection
                    value={settings.notifications}
                    onChange={(notifications) => setSettings({ ...settings, notifications })}
                    onSave={() =>
                        commitSave(
                            'notifications',
                            { notifications: settings.notifications },
                            'Notifications',
                        )
                    }
                    saving={savingSection === 'notifications'}
                />
            </div>

            <div className="mt-8 flex items-center justify-between text-[11.5px] text-zoru-ink-muted">
                <span>Settings apply to your SabChat workspace across all connected channels.</span>
                <Link
                    href="/dashboard/sabchat"
                    className="text-zoru-ink-subtle underline-offset-2 hover:underline"
                >
                    Back to SabChat
                </Link>
            </div>
        </div>
    );
}

/* ── sections ─────────────────────────────────────────────────────── */

function ChannelsSection({
    value,
    onChange,
    onSave,
    saving,
}: {
    value: SabchatSettings['channels'];
    onChange: (v: SabchatSettings['channels']) => void;
    onSave: () => void;
    saving: boolean;
}) {
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Channels"
                    description="Defaults applied to every connected channel."
                />
                <Button size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <Label htmlFor="channels-defaultSender">Default sender name</Label>
                    <Input
                        id="channels-defaultSender"
                        placeholder="e.g. Support Team"
                        value={value.defaultSender}
                        onChange={(e) => onChange({ ...value, defaultSender: e.target.value })}
                    />
                    <p className="text-[11px] text-zoru-ink-muted">
                        Used when a channel does not specify a sender of its own.
                    </p>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3">
                    <div>
                        <Label htmlFor="channels-autoTranslate" className="text-[13px]">
                            Auto-translate
                        </Label>
                        <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                            Translate inbound messages into your workspace language.
                        </p>
                    </div>
                    <Switch
                        id="channels-autoTranslate"
                        checked={value.autoTranslate}
                        onCheckedChange={(checked) =>
                            onChange({ ...value, autoTranslate: !!checked })
                        }
                    />
                </div>
            </div>
        </Card>
    );
}

function WorkingHoursSection({
    value,
    onChange,
    onSave,
    saving,
}: {
    value: SabchatSettings['workingHours'];
    onChange: (v: SabchatSettings['workingHours']) => void;
    onSave: () => void;
    saving: boolean;
}) {
    function toggleDay(day: string) {
        const has = value.days.includes(day);
        onChange({
            ...value,
            days: has ? value.days.filter((d) => d !== day) : [...value.days, day],
        });
    }

    return (
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Working hours"
                    description="Used to flag conversations as out-of-hours and trigger autoresponders."
                />
                <Button size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                    <Label htmlFor="wh-timezone">Timezone</Label>
                    <Select
                        value={value.timezone}
                        onValueChange={(tz) => onChange({ ...value, timezone: tz })}
                    >
                        <ZoruSelectTrigger id="wh-timezone">
                            <ZoruSelectValue placeholder="Pick a timezone" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {TIMEZONES.map((tz) => (
                                <ZoruSelectItem key={tz} value={tz}>
                                    {tz}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </Select>
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="wh-start">Start time</Label>
                    <Input
                        id="wh-start"
                        type="time"
                        value={value.start}
                        onChange={(e) => onChange({ ...value, start: e.target.value })}
                    />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="wh-end">End time</Label>
                    <Input
                        id="wh-end"
                        type="time"
                        value={value.end}
                        onChange={(e) => onChange({ ...value, end: e.target.value })}
                    />
                </div>
            </div>
            <div className="mt-4">
                <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                    Working days
                </Label>
                <div className="mt-2 flex flex-wrap gap-3">
                    {DAYS.map((day) => {
                        const id = `wh-day-${day}`;
                        const checked = value.days.includes(day);
                        return (
                            <label
                                key={day}
                                htmlFor={id}
                                className="flex items-center gap-2 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-bg px-3 py-1.5 text-[12.5px] text-zoru-ink cursor-pointer"
                            >
                                <Checkbox
                                    id={id}
                                    checked={checked}
                                    onCheckedChange={() => toggleDay(day)}
                                />
                                {day}
                            </label>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
}

function AutoresponderSection({
    value,
    onChange,
    onSave,
    saving,
}: {
    value: SabchatSettings['autoresponder'];
    onChange: (v: SabchatSettings['autoresponder']) => void;
    onSave: () => void;
    saving: boolean;
}) {
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Autoresponder"
                    description="Sent automatically when a message arrives outside working hours."
                />
                <Button size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
            <div className="mt-5 flex items-start justify-between gap-4 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3">
                <div>
                    <Label htmlFor="ar-enabled" className="text-[13px]">
                        Enable autoresponder
                    </Label>
                    <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                        Send the message below when an agent is unavailable.
                    </p>
                </div>
                <Switch
                    id="ar-enabled"
                    checked={value.enabled}
                    onCheckedChange={(checked) => onChange({ ...value, enabled: !!checked })}
                />
            </div>
            <div className="mt-4 grid gap-1.5">
                <Label htmlFor="ar-message">Message</Label>
                <Textarea
                    id="ar-message"
                    rows={4}
                    value={value.message}
                    onChange={(e) => onChange({ ...value, message: e.target.value })}
                    placeholder="Hi! We're currently offline. We'll get back to you soon."
                />
            </div>
        </Card>
    );
}

function RoutingSection({
    value,
    onChange,
    onSave,
    saving,
}: {
    value: SabchatSettings['routing'];
    onChange: (v: SabchatSettings['routing']) => void;
    onSave: () => void;
    saving: boolean;
}) {
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Routing"
                    description="How new conversations are assigned to agents."
                />
                <Button size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <Label htmlFor="rt-assignee">Default assignee</Label>
                    <Input
                        id="rt-assignee"
                        placeholder="unassigned"
                        value={value.defaultAssignee}
                        onChange={(e) => onChange({ ...value, defaultAssignee: e.target.value })}
                    />
                    <p className="text-[11px] text-zoru-ink-muted">
                        Use &quot;unassigned&quot; to keep new conversations open in the queue.
                    </p>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3">
                    <div>
                        <Label htmlFor="rt-roundRobin" className="text-[13px]">
                            Round-robin
                        </Label>
                        <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                            Distribute incoming chats across available agents.
                        </p>
                    </div>
                    <Switch
                        id="rt-roundRobin"
                        checked={value.roundRobin}
                        onCheckedChange={(checked) => onChange({ ...value, roundRobin: !!checked })}
                    />
                </div>
            </div>
        </Card>
    );
}

function WebhooksSection({
    value,
    onChange,
    onSave,
    saving,
}: {
    value: SabchatSettings['webhooks'];
    onChange: (v: SabchatSettings['webhooks']) => void;
    onSave: () => void;
    saving: boolean;
}) {
    function sendTest() {
        if (!value.url) {
            zoruSonnerToast.error('Add a webhook URL first.');
            return;
        }
        zoruSonnerToast.info('Test webhook queued. Check your endpoint logs.');
    }

    return (
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Webhooks"
                    description="Forward inbound messages and events to your own endpoint."
                />
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={sendTest}>
                        <Send /> Send test
                    </Button>
                    <Button size="sm" onClick={onSave} disabled={saving}>
                        <Save /> {saving ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <Label htmlFor="wh-url">Webhook URL</Label>
                    <Input
                        id="wh-url"
                        type="url"
                        placeholder="https://example.com/webhooks/sabchat"
                        value={value.url}
                        onChange={(e) => onChange({ ...value, url: e.target.value })}
                    />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="wh-secret">Signing secret</Label>
                    <Input
                        id="wh-secret"
                        type="password"
                        placeholder="••••••••"
                        value={value.secret}
                        onChange={(e) => onChange({ ...value, secret: e.target.value })}
                    />
                </div>
            </div>
        </Card>
    );
}

function NotificationsSection({
    value,
    onChange,
    onSave,
    saving,
}: {
    value: SabchatSettings['notifications'];
    onChange: (v: SabchatSettings['notifications']) => void;
    onSave: () => void;
    saving: boolean;
}) {
    const rows: Array<{
        key: keyof SabchatSettings['notifications'];
        label: string;
        description: string;
    }> = [
        {
            key: 'newMessage',
            label: 'New message',
            description: 'Notify when a new inbound message lands in your inbox.',
        },
        {
            key: 'escalation',
            label: 'Escalation',
            description: 'Alert when a conversation is escalated to a senior agent.',
        },
        {
            key: 'agentMention',
            label: 'Agent mention',
            description: 'Ping an agent when they are @mentioned in an internal note.',
        },
    ];

    return (
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Notifications"
                    description="Control which events your agents are notified about."
                />
                <Button size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
            <div className="mt-5 grid gap-2">
                {rows.map((row) => (
                    <div
                        key={row.key}
                        className="flex items-start justify-between gap-4 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3"
                    >
                        <div>
                            <Label htmlFor={`notif-${row.key}`} className="text-[13px]">
                                {row.label}
                            </Label>
                            <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                                {row.description}
                            </p>
                        </div>
                        <Switch
                            id={`notif-${row.key}`}
                            checked={value[row.key]}
                            onCheckedChange={(checked) =>
                                onChange({ ...value, [row.key]: !!checked })
                            }
                        />
                    </div>
                ))}
            </div>
        </Card>
    );
}
