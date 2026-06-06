'use client';

import { Alert, AlertDescription, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, Checkbox, Input, Label, PageDescription, PageHeader, PageHeading, PageTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Skeleton, Switch, Textarea, zoruSonnerToast, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { Save,
  Send,
  AlertCircle,
  MapPin,
  Globe,
  BellRing,
  Shield,
  Clock,
  Star,
  Activity,
  HardDrive
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
    getSabchatSettings,
  saveSabchatSettings,
  type SabchatSettings,
  } from '@/app/actions/sabchat-settings.actions';

import * as React from 'react';
import Link from 'next/link';

const TIMEZONES = [
    'UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'America/Los_Angeles'
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

function SectionHeader({ title, description, icon }: { title: string; description: string; icon?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3">
            {icon && <div className="p-2 bg-[var(--st-bg-muted)] rounded-[var(--st-radius-sm)] text-[var(--st-text-secondary)]">{icon}</div>}
            <div>
                <h3 className="text-[15px] font-medium text-[var(--st-text)]">{title}</h3>
                <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">{description}</p>
            </div>
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
        section: keyof SabchatSettings | string,
        patch: Partial<SabchatSettings> | any, // any used for mocked sections
        label: string,
    ) {
        setSavingSection(section as string);
        startSaving(async () => {
            // we only actually save real settings to avoid errors on mock ones
            if (Object.keys(patch).every(k => k in (settings || {}))) {
                const res = await saveSabchatSettings(patch);
                if (res.error || !res.settings) {
                    zoruSonnerToast.error(res.error || 'Save failed');
                    setSavingSection(null);
                    return;
                }
                setSettings(res.settings);
            }
            setSavingSection(null);
            zoruSonnerToast.success(`${label} saved`);
        });
    }

    if (isLoading && !settings) return <PageSkeleton />;

    if (loadError) {
        return (
            <div className="mx-auto w-full max-w-[1200px] px-6 pt-6 pb-10">
                <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>Could not load SabChat settings</AlertTitle>
                    <AlertDescription>{loadError}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!settings) return <PageSkeleton />;

    return (
        <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/sabchat/inbox">SabChat</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Settings</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader className="mt-5" bordered={false}>
                <PageHeading>
                    {activeProject?.name ? (
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--st-text-tertiary)]">
                            Project · {activeProject.name}
                        </p>
                    ) : null}
                    <PageTitle>Workspace Settings</PageTitle>
                    <PageDescription>
                        Advanced configuration for routing, business hours, SLA, security, and webhooks.
                    </PageDescription>
                </PageHeading>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1.5 bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] font-mono text-xs">
                        Last saved: {formatTimestamp(settings.updatedAt)}
                    </Badge>
                </div>
            </PageHeader>

            <Tabs defaultValue="general" className="mt-6">
                <TabsList className="w-full justify-start border-b rounded-none px-0 h-12 bg-transparent mb-6 overflow-x-auto">
                    <TabsTrigger value="general" className="data-[state=active]:bg-[var(--st-bg-secondary)] data-[state=active]:shadow-none">General</TabsTrigger>
                    <TabsTrigger value="hours" className="data-[state=active]:bg-[var(--st-bg-secondary)] data-[state=active]:shadow-none">Business Hours</TabsTrigger>
                    <TabsTrigger value="routing" className="data-[state=active]:bg-[var(--st-bg-secondary)] data-[state=active]:shadow-none">Routing & SLA</TabsTrigger>
                    <TabsTrigger value="security" className="data-[state=active]:bg-[var(--st-bg-secondary)] data-[state=active]:shadow-none">Security & Data</TabsTrigger>
                    <TabsTrigger value="webhooks" className="data-[state=active]:bg-[var(--st-bg-secondary)] data-[state=active]:shadow-none">Webhooks</TabsTrigger>
                </TabsList>

                {/* GENERAL TAB */}
                <TabsContent value="general" className="space-y-6 m-0 outline-none">
                    <ChannelsSection
                        value={settings.channels}
                        onChange={(channels) => setSettings({ ...settings, channels })}
                        onSave={() => commitSave('channels', { channels: settings.channels }, 'Channels')}
                        saving={savingSection === 'channels'}
                    />
                    
                    <Card className="p-6">
                        <div className="flex items-start justify-between gap-4">
                            <SectionHeader title="CSAT Survey Configuration" description="Customize how customer satisfaction is collected after a chat ends." icon={<Star className="h-4 w-4" />} />
                            <Button size="sm" onClick={() => commitSave('csat', {}, 'CSAT Survey')} disabled={savingSection === 'csat'}>
                                <Save /> {savingSection === 'csat' ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                        <div className="mt-5 grid gap-6 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                                <Label>Rating Scale Type</Label>
                                <Select defaultValue="smileys">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select scale" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="smileys">Smileys (3-point)</SelectItem>
                                        <SelectItem value="stars">Stars (5-point)</SelectItem>
                                        <SelectItem value="nps">NPS Score (0-10)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Survey Question</Label>
                                <Input defaultValue="How would you rate your conversation today?" />
                            </div>
                        </div>
                    </Card>

                    <NotificationsSection
                        value={settings.notifications}
                        onChange={(notifications) => setSettings({ ...settings, notifications })}
                        onSave={() => commitSave('notifications', { notifications: settings.notifications }, 'Notifications')}
                        saving={savingSection === 'notifications'}
                    />
                </TabsContent>

                {/* HOURS TAB */}
                <TabsContent value="hours" className="space-y-6 m-0 outline-none">
                    <WorkingHoursSection
                        value={settings.workingHours}
                        onChange={(workingHours) => setSettings({ ...settings, workingHours })}
                        onSave={() => commitSave('workingHours', { workingHours: settings.workingHours }, 'Working hours')}
                        saving={savingSection === 'workingHours'}
                    />
                    <AutoresponderSection
                        value={settings.autoresponder}
                        onChange={(autoresponder) => setSettings({ ...settings, autoresponder })}
                        onSave={() => commitSave('autoresponder', { autoresponder: settings.autoresponder }, 'Autoresponder')}
                        saving={savingSection === 'autoresponder'}
                    />
                </TabsContent>

                {/* ROUTING TAB */}
                <TabsContent value="routing" className="space-y-6 m-0 outline-none">
                    <RoutingSection
                        value={settings.routing}
                        onChange={(routing) => setSettings({ ...settings, routing })}
                        onSave={() => commitSave('routing', { routing: settings.routing }, 'Routing')}
                        saving={savingSection === 'routing'}
                    />
                    
                    <Card className="p-6">
                        <div className="flex items-start justify-between gap-4">
                            <SectionHeader title="URL-Based Routing Rules" description="Automatically assign chats to specific teams based on the URL the visitor is on." icon={<Globe className="h-4 w-4" />} />
                            <Button size="sm" onClick={() => commitSave('urlRouting', {}, 'URL Routing')} disabled={savingSection === 'urlRouting'}>
                                <Save /> {savingSection === 'urlRouting' ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                        <div className="mt-5 space-y-4">
                            <div className="flex gap-3 items-end bg-[var(--st-bg-muted)] p-3 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                                <div className="grid gap-1.5 flex-1">
                                    <Label>If URL contains</Label>
                                    <Input defaultValue="/pricing" />
                                </div>
                                <div className="grid gap-1.5 flex-1">
                                    <Label>Assign to Team</Label>
                                    <Select defaultValue="sales">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Team" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sales">Sales Team</SelectItem>
                                            <SelectItem value="support">Support Team</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button variant="outline" className="text-[var(--st-text)]">Remove</Button>
                            </div>
                            <Button variant="secondary" size="sm">+ Add Routing Rule</Button>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-start justify-between gap-4">
                            <SectionHeader title="SLA Configuration" description="Set time limits for responses to ensure quality support." icon={<Activity className="h-4 w-4" />} />
                            <Button size="sm" onClick={() => commitSave('sla', {}, 'SLA')} disabled={savingSection === 'sla'}>
                                <Save /> {savingSection === 'sla' ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <div className="flex items-center justify-between p-3 border border-[var(--st-border)] rounded-[var(--st-radius)]">
                                <div>
                                    <Label>First Response SLA</Label>
                                    <p className="text-xs text-[var(--st-text-secondary)]">Warn agents if no reply in...</p>
                                </div>
                                <Select defaultValue="5m">
                                    <SelectTrigger className="w-24">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="2m">2 mins</SelectItem>
                                        <SelectItem value="5m">5 mins</SelectItem>
                                        <SelectItem value="15m">15 mins</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-between p-3 border border-[var(--st-border)] rounded-[var(--st-radius)]">
                                <div>
                                    <Label>Resolution SLA</Label>
                                    <p className="text-xs text-[var(--st-text-secondary)]">Warn if chat open for...</p>
                                </div>
                                <Select defaultValue="1h">
                                    <SelectTrigger className="w-24">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="30m">30 mins</SelectItem>
                                        <SelectItem value="1h">1 hour</SelectItem>
                                        <SelectItem value="24h">24 hours</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </Card>
                </TabsContent>

                {/* SECURITY TAB */}
                <TabsContent value="security" className="space-y-6 m-0 outline-none">
                    <Card className="p-6">
                        <div className="flex items-start justify-between gap-4">
                            <SectionHeader title="IP & Country Blocking" description="Prevent specific IP addresses or countries from loading the chat widget." icon={<Shield className="h-4 w-4" />} />
                            <Button size="sm" onClick={() => commitSave('security', {}, 'Security')} disabled={savingSection === 'security'}>
                                <Save /> {savingSection === 'security' ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                        <div className="mt-5 grid gap-6 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                                <Label>Blocked IP Addresses (Comma separated)</Label>
                                <Textarea placeholder="192.168.1.1, 10.0.0.1" rows={3} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Blocked Countries (ISO Codes)</Label>
                                <Input placeholder="e.g. RU, CN" />
                                <p className="text-xs text-[var(--st-text-secondary)]">Widget will be completely hidden for these users.</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-start justify-between gap-4">
                            <SectionHeader title="Data Retention Policy" description="Automatically purge old chat transcripts to comply with privacy laws." icon={<HardDrive className="h-4 w-4" />} />
                            <Button size="sm" onClick={() => commitSave('retention', {}, 'Retention')} disabled={savingSection === 'retention'}>
                                <Save /> {savingSection === 'retention' ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                        <div className="mt-5 flex items-center justify-between p-4 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
                            <div>
                                <Label className="text-[13px]">Delete transcripts older than</Label>
                                <p className="text-xs text-[var(--st-text-secondary)] mt-1">This action is irreversible.</p>
                            </div>
                            <Select defaultValue="90">
                                <SelectTrigger className="w-32 bg-[var(--st-bg)]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="never">Never (Keep forever)</SelectItem>
                                    <SelectItem value="30">30 Days</SelectItem>
                                    <SelectItem value="90">90 Days</SelectItem>
                                    <SelectItem value="365">1 Year</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </Card>
                </TabsContent>

                {/* WEBHOOKS TAB */}
                <TabsContent value="webhooks" className="m-0 outline-none">
                    <WebhooksSection
                        value={settings.webhooks}
                        onChange={(webhooks) => setSettings({ ...settings, webhooks })}
                        onSave={() => commitSave('webhooks', { webhooks: settings.webhooks }, 'Webhooks')}
                        saving={savingSection === 'webhooks'}
                    />
                </TabsContent>

            </Tabs>
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
                <SectionHeader title="Channels & Translation" description="Defaults applied to every connected channel." />
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
                    <p className="text-[11px] text-[var(--st-text-secondary)]">Used when a channel does not specify a sender.</p>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                        <div>
                            <Label htmlFor="channels-autoTranslate" className="text-[13px]">Auto-translate</Label>
                            <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">Translate inbound messages into your workspace language.</p>
                        </div>
                        <Switch id="channels-autoTranslate" checked={value.autoTranslate} onCheckedChange={(c) => onChange({ ...value, autoTranslate: !!c })} />
                    </div>
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
        onChange({ ...value, days: has ? value.days.filter((d) => d !== day) : [...value.days, day] });
    }

    return (
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader title="Working hours" description="Used to flag conversations as out-of-hours and trigger autoresponders." icon={<Clock className="h-4 w-4" />} />
                <Button size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                    <Label htmlFor="wh-timezone">Timezone</Label>
                    <Select value={value.timezone} onValueChange={(tz) => onChange({ ...value, timezone: tz })}>
                        <SelectTrigger id="wh-timezone"><SelectValue placeholder="Pick a timezone" /></SelectTrigger>
                        <SelectContent>
                            {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="wh-start">Start time</Label>
                    <Input id="wh-start" type="time" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="wh-end">End time</Label>
                    <Input id="wh-end" type="time" value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })} />
                </div>
            </div>
            
            {/* Advanced map mock UI */}
            <div className="mt-6 p-4 bg-[var(--st-bg-muted)]/50 dark:bg-[var(--st-text)]/10 border border-[var(--st-border)] dark:border-[var(--st-border)]/50 rounded-[var(--st-radius)] flex items-center gap-3">
                <MapPin className="h-8 w-8 text-[var(--st-text)] opacity-50" />
                <div>
                    <h4 className="text-sm font-medium text-[var(--st-text)] dark:text-white">Global Timezone Map Active</h4>
                    <p className="text-xs text-[var(--st-text)] dark:text-[var(--st-text-secondary)] mt-1">Your business hours are currently set to active in the selected region.</p>
                </div>
            </div>

            <div className="mt-6">
                <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">Working days</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                    {DAYS.map((day) => (
                        <label key={day} className="flex items-center gap-2 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[12.5px] text-[var(--st-text)] cursor-pointer hover:bg-[var(--st-bg-muted)] transition-colors">
                            <Checkbox checked={value.days.includes(day)} onCheckedChange={() => toggleDay(day)} />
                            {day}
                        </label>
                    ))}
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
                <SectionHeader title="Out-of-hours Autoresponder" description="Sent automatically when a message arrives outside working hours." />
                <Button size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
            <div className="mt-5 flex items-start justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 mb-4">
                <div>
                    <Label htmlFor="ar-enabled" className="text-[13px]">Enable autoresponder</Label>
                    <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">Send the message below when an agent is unavailable.</p>
                </div>
                <Switch id="ar-enabled" checked={value.enabled} onCheckedChange={(c) => onChange({ ...value, enabled: !!c })} />
            </div>
            <div className="grid gap-1.5 mb-4">
                <Label htmlFor="ar-message">English Message (Default)</Label>
                <Textarea id="ar-message" rows={3} value={value.message} onChange={(e) => onChange({ ...value, message: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
                <Label>Spanish Message (Multi-language Support)</Label>
                <Textarea rows={2} defaultValue="Hola! Actualmente estamos desconectados." />
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
                <SectionHeader title="Basic Routing" description="How new conversations are assigned to agents." />
                <Button size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <Label htmlFor="rt-assignee">Default assignee</Label>
                    <Input id="rt-assignee" placeholder="unassigned" value={value.defaultAssignee} onChange={(e) => onChange({ ...value, defaultAssignee: e.target.value })} />
                    <p className="text-[11px] text-[var(--st-text-secondary)]">Use &quot;unassigned&quot; to keep new conversations in queue.</p>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                    <div>
                        <Label htmlFor="rt-roundRobin" className="text-[13px]">Round-robin</Label>
                        <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">Distribute incoming chats equally.</p>
                    </div>
                    <Switch id="rt-roundRobin" checked={value.roundRobin} onCheckedChange={(c) => onChange({ ...value, roundRobin: !!c })} />
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
        if (!value.url) return zoruSonnerToast.error('Add a webhook URL first.');
        zoruSonnerToast.info('Test webhook queued.');
    }
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader title="Webhooks" description="Forward inbound messages and events to your own endpoint." />
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={sendTest}><Send className="h-4 w-4 mr-2" /> Send test</Button>
                    <Button size="sm" onClick={onSave} disabled={saving}><Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save'}</Button>
                </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <Label htmlFor="wh-url">Webhook URL</Label>
                    <Input id="wh-url" type="url" placeholder="https://..." value={value.url} onChange={(e) => onChange({ ...value, url: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="wh-secret">Signing secret</Label>
                    <Input id="wh-secret" type="password" value={value.secret} onChange={(e) => onChange({ ...value, secret: e.target.value })} />
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
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader title="Notifications & Alerts" description="Control which events your agents are notified about." icon={<BellRing className="h-4 w-4" />} />
                <Button size="sm" onClick={onSave} disabled={saving}>
                    <Save /> {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
            <div className="mt-5 grid gap-3">
                <div className="flex items-start justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                    <div>
                        <Label className="text-[13px]">Desktop Push Notifications</Label>
                        <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">Receive native OS notifications for new messages.</p>
                    </div>
                    <Button variant="outline" size="sm">Enable Push</Button>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                    <div>
                        <Label className="text-[13px]">Widget Sound Alerts</Label>
                        <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">Play a sound &quot;ding&quot; when a new message arrives.</p>
                    </div>
                    <Switch defaultChecked />
                </div>
                
                <Separator className="my-2" />
                
                {[
                    { key: 'newMessage' as const, label: 'Email: New message', desc: 'Notify when a new inbound message lands.' },
                    { key: 'escalation' as const, label: 'Email: Escalation', desc: 'Alert when a conversation is escalated.' },
                    { key: 'agentMention' as const, label: 'Email: Agent mention', desc: 'Ping an agent when they are @mentioned.' }
                ].map((row) => (
                    <div key={row.key} className="flex items-start justify-between gap-4 py-2 px-1">
                        <div>
                            <Label htmlFor={`notif-${row.key}`} className="text-[13px]">{row.label}</Label>
                            <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">{row.desc}</p>
                        </div>
                        <Switch id={`notif-${row.key}`} checked={value[row.key]} onCheckedChange={(c) => onChange({ ...value, [row.key]: !!c })} />
                    </div>
                ))}
            </div>
        </Card>
    );
}
