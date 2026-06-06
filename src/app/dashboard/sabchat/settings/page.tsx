'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Label,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  Switch,
  Textarea,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useToast,
} from '@/components/sabcrm/20ui';
import { useEffect, useState, useTransition } from 'react';
import {
  Save,
  Send,
  AlertCircle,
  MapPin,
  Globe,
  BellRing,
  Shield,
  Clock,
  Star,
  Activity,
  HardDrive,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getSabchatSettings,
  saveSabchatSettings,
} from '@/app/actions/sabchat-settings.actions';

import * as React from 'react';

type SabchatSettings = NonNullable<
  Awaited<ReturnType<typeof getSabchatSettings>>['settings']
>;

const TIMEZONES = [
  'UTC',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
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

function SectionHeader({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon ? (
        <div className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
          {icon}
        </div>
      ) : null}
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
      <Skeleton height={12} width={224} />
      <div className="mt-5 flex flex-col gap-2">
        <Skeleton height={12} width={96} />
        <Skeleton height={28} width={288} />
        <Skeleton height={12} width={384} />
      </div>
      <div className="mt-6 grid gap-4">
        <Skeleton height={240} width="100%" />
        <Skeleton height={240} width="100%" />
      </div>
    </div>
  );
}

export default function SabchatSettingsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
    patch: Partial<SabchatSettings> | Record<string, unknown>,
    label: string,
  ) {
    setSavingSection(section as string);
    startSaving(async () => {
      // we only actually save real settings to avoid errors on mock ones
      if (Object.keys(patch).every((k) => k in (settings || {}))) {
        const res = await saveSabchatSettings(patch as Partial<SabchatSettings>);
        if (res.error || !res.settings) {
          toast.error(res.error || 'Save failed');
          setSavingSection(null);
          return;
        }
        setSettings(res.settings);
      }
      setSavingSection(null);
      toast.success(`${label} saved`);
    });
  }

  if (isLoading && !settings) return <PageSkeleton />;

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-6 pt-6 pb-10">
        <Alert tone="danger" icon={AlertCircle}>
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
            <PageEyebrow>Project, {activeProject.name}</PageEyebrow>
          ) : null}
          <PageTitle>Workspace Settings</PageTitle>
          <PageDescription>
            Advanced configuration for routing, business hours, SLA, security, and webhooks.
          </PageDescription>
        </PageHeading>
        <div className="flex items-center gap-2">
          <Badge tone="neutral" className="gap-1.5 font-mono text-xs">
            Last saved: {formatTimestamp(settings.updatedAt)}
          </Badge>
        </div>
      </PageHeader>

      <Tabs defaultValue="general" className="mt-6">
        <TabsList className="mb-6 overflow-x-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="hours">Business Hours</TabsTrigger>
          <TabsTrigger value="routing">Routing &amp; SLA</TabsTrigger>
          <TabsTrigger value="security">Security &amp; Data</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        {/* GENERAL TAB */}
        <TabsContent value="general" className="m-0 space-y-6 outline-none">
          <ChannelsSection
            value={settings.channels}
            onChange={(channels) => setSettings({ ...settings, channels })}
            onSave={() => commitSave('channels', { channels: settings.channels }, 'Channels')}
            saving={savingSection === 'channels'}
          />

          <Card padding="lg">
            <div className="flex items-start justify-between gap-4">
              <SectionHeader
                title="CSAT Survey Configuration"
                description="Customize how customer satisfaction is collected after a chat ends."
                icon={<Star className="h-4 w-4" />}
              />
              <Button
                variant="primary"
                size="sm"
                iconLeft={Save}
                onClick={() => commitSave('csat', {}, 'CSAT Survey')}
                disabled={savingSection === 'csat'}
              >
                {savingSection === 'csat' ? 'Saving...' : 'Save'}
              </Button>
            </div>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="csat-scale">Rating Scale Type</Label>
                <Select defaultValue="smileys">
                  <SelectTrigger id="csat-scale" aria-label="Rating scale type">
                    <SelectValue placeholder="Select scale" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smileys">Smileys (3-point)</SelectItem>
                    <SelectItem value="stars">Stars (5-point)</SelectItem>
                    <SelectItem value="nps">NPS Score (0-10)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="Survey Question">
                <Input defaultValue="How would you rate your conversation today?" />
              </Field>
            </div>
          </Card>

          <NotificationsSection
            value={settings.notifications}
            onChange={(notifications) => setSettings({ ...settings, notifications })}
            onSave={() =>
              commitSave('notifications', { notifications: settings.notifications }, 'Notifications')
            }
            saving={savingSection === 'notifications'}
          />
        </TabsContent>

        {/* HOURS TAB */}
        <TabsContent value="hours" className="m-0 space-y-6 outline-none">
          <WorkingHoursSection
            value={settings.workingHours}
            onChange={(workingHours) => setSettings({ ...settings, workingHours })}
            onSave={() =>
              commitSave('workingHours', { workingHours: settings.workingHours }, 'Working hours')
            }
            saving={savingSection === 'workingHours'}
          />
          <AutoresponderSection
            value={settings.autoresponder}
            onChange={(autoresponder) => setSettings({ ...settings, autoresponder })}
            onSave={() =>
              commitSave('autoresponder', { autoresponder: settings.autoresponder }, 'Autoresponder')
            }
            saving={savingSection === 'autoresponder'}
          />
        </TabsContent>

        {/* ROUTING TAB */}
        <TabsContent value="routing" className="m-0 space-y-6 outline-none">
          <RoutingSection
            value={settings.routing}
            onChange={(routing) => setSettings({ ...settings, routing })}
            onSave={() => commitSave('routing', { routing: settings.routing }, 'Routing')}
            saving={savingSection === 'routing'}
          />

          <Card padding="lg">
            <div className="flex items-start justify-between gap-4">
              <SectionHeader
                title="URL-Based Routing Rules"
                description="Automatically assign chats to specific teams based on the URL the visitor is on."
                icon={<Globe className="h-4 w-4" />}
              />
              <Button
                variant="primary"
                size="sm"
                iconLeft={Save}
                onClick={() => commitSave('urlRouting', {}, 'URL Routing')}
                disabled={savingSection === 'urlRouting'}
              >
                {savingSection === 'urlRouting' ? 'Saving...' : 'Save'}
              </Button>
            </div>
            <div className="mt-5 space-y-4">
              <div className="flex items-end gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
                <Field label="If URL contains" className="flex-1">
                  <Input defaultValue="/pricing" />
                </Field>
                <div className="grid flex-1 gap-1.5">
                  <Label htmlFor="url-team">Assign to Team</Label>
                  <Select defaultValue="sales">
                    <SelectTrigger id="url-team" aria-label="Assign to team">
                      <SelectValue placeholder="Team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales Team</SelectItem>
                      <SelectItem value="support">Support Team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline">Remove</Button>
              </div>
              <Button variant="secondary" size="sm">
                + Add Routing Rule
              </Button>
            </div>
          </Card>

          <Card padding="lg">
            <div className="flex items-start justify-between gap-4">
              <SectionHeader
                title="SLA Configuration"
                description="Set time limits for responses to ensure quality support."
                icon={<Activity className="h-4 w-4" />}
              />
              <Button
                variant="primary"
                size="sm"
                iconLeft={Save}
                onClick={() => commitSave('sla', {}, 'SLA')}
                disabled={savingSection === 'sla'}
              >
                {savingSection === 'sla' ? 'Saving...' : 'Save'}
              </Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
                <div>
                  <Label htmlFor="sla-first">First Response SLA</Label>
                  <p className="text-xs text-[var(--st-text-secondary)]">
                    Warn agents if no reply in...
                  </p>
                </div>
                <Select defaultValue="5m">
                  <SelectTrigger id="sla-first" className="w-24" aria-label="First response SLA">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2m">2 mins</SelectItem>
                    <SelectItem value="5m">5 mins</SelectItem>
                    <SelectItem value="15m">15 mins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
                <div>
                  <Label htmlFor="sla-resolution">Resolution SLA</Label>
                  <p className="text-xs text-[var(--st-text-secondary)]">Warn if chat open for...</p>
                </div>
                <Select defaultValue="1h">
                  <SelectTrigger id="sla-resolution" className="w-24" aria-label="Resolution SLA">
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
        <TabsContent value="security" className="m-0 space-y-6 outline-none">
          <Card padding="lg">
            <div className="flex items-start justify-between gap-4">
              <SectionHeader
                title="IP &amp; Country Blocking"
                description="Prevent specific IP addresses or countries from loading the chat widget."
                icon={<Shield className="h-4 w-4" />}
              />
              <Button
                variant="primary"
                size="sm"
                iconLeft={Save}
                onClick={() => commitSave('security', {}, 'Security')}
                disabled={savingSection === 'security'}
              >
                {savingSection === 'security' ? 'Saving...' : 'Save'}
              </Button>
            </div>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <Field label="Blocked IP Addresses (Comma separated)">
                <Textarea placeholder="192.168.1.1, 10.0.0.1" rows={3} />
              </Field>
              <Field
                label="Blocked Countries (ISO Codes)"
                help="Widget will be completely hidden for these users."
              >
                <Input placeholder="e.g. RU, CN" />
              </Field>
            </div>
          </Card>

          <Card padding="lg">
            <div className="flex items-start justify-between gap-4">
              <SectionHeader
                title="Data Retention Policy"
                description="Automatically purge old chat transcripts to comply with privacy laws."
                icon={<HardDrive className="h-4 w-4" />}
              />
              <Button
                variant="primary"
                size="sm"
                iconLeft={Save}
                onClick={() => commitSave('retention', {}, 'Retention')}
                disabled={savingSection === 'retention'}
              >
                {savingSection === 'retention' ? 'Saving...' : 'Save'}
              </Button>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4">
              <div>
                <Label htmlFor="retention-window" className="text-[13px]">
                  Delete transcripts older than
                </Label>
                <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                  This action is irreversible.
                </p>
              </div>
              <Select defaultValue="90">
                <SelectTrigger
                  id="retention-window"
                  className="w-32"
                  aria-label="Data retention window"
                >
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

/* sections */

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
    <Card padding="lg">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Channels &amp; Translation"
          description="Defaults applied to every connected channel."
        />
        <Button variant="primary" size="sm" iconLeft={Save} onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field
          label="Default sender name"
          help="Used when a channel does not specify a sender."
        >
          <Input
            placeholder="e.g. Support Team"
            value={value.defaultSender}
            onChange={(e) => onChange({ ...value, defaultSender: e.target.value })}
          />
        </Field>
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
            <div>
              <Label htmlFor="channels-autoTranslate" className="text-[13px]">
                Auto-translate
              </Label>
              <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
                Translate inbound messages into your workspace language.
              </p>
            </div>
            <Switch
              id="channels-autoTranslate"
              checked={value.autoTranslate}
              onCheckedChange={(c) => onChange({ ...value, autoTranslate: !!c })}
            />
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
    onChange({
      ...value,
      days: has ? value.days.filter((d) => d !== day) : [...value.days, day],
    });
  }

  return (
    <Card padding="lg">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Working hours"
          description="Used to flag conversations as out-of-hours and trigger autoresponders."
          icon={<Clock className="h-4 w-4" />}
        />
        <Button variant="primary" size="sm" iconLeft={Save} onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="wh-timezone">Timezone</Label>
          <Select value={value.timezone} onValueChange={(tz) => onChange({ ...value, timezone: tz })}>
            <SelectTrigger id="wh-timezone" aria-label="Timezone">
              <SelectValue placeholder="Pick a timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Field label="Start time">
          <Input
            type="time"
            value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
          />
        </Field>
        <Field label="End time">
          <Input
            type="time"
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
          />
        </Field>
      </div>

      {/* Advanced map mock UI */}
      <div className="mt-6 flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4">
        <MapPin className="h-8 w-8 text-[var(--st-text-secondary)]" />
        <div>
          <h4 className="text-sm font-medium text-[var(--st-text)]">Global Timezone Map Active</h4>
          <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
            Your business hours are currently set to active in the selected region.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
          Working days
        </Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <Checkbox
              key={day}
              label={day}
              checked={value.days.includes(day)}
              onChange={() => toggleDay(day)}
              className="rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[12.5px] text-[var(--st-text)] transition-colors hover:bg-[var(--st-bg-muted)]"
            />
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
    <Card padding="lg">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Out-of-hours Autoresponder"
          description="Sent automatically when a message arrives outside working hours."
        />
        <Button variant="primary" size="sm" iconLeft={Save} onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      <div className="mt-5 mb-4 flex items-start justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
        <div>
          <Label htmlFor="ar-enabled" className="text-[13px]">
            Enable autoresponder
          </Label>
          <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
            Send the message below when an agent is unavailable.
          </p>
        </div>
        <Switch
          id="ar-enabled"
          checked={value.enabled}
          onCheckedChange={(c) => onChange({ ...value, enabled: !!c })}
        />
      </div>
      <Field label="English Message (Default)" className="mb-4">
        <Textarea
          rows={3}
          value={value.message}
          onChange={(e) => onChange({ ...value, message: e.target.value })}
        />
      </Field>
      <Field label="Spanish Message (Multi-language Support)">
        <Textarea rows={2} defaultValue="Hola! Actualmente estamos desconectados." />
      </Field>
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
    <Card padding="lg">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Basic Routing"
          description="How new conversations are assigned to agents."
        />
        <Button variant="primary" size="sm" iconLeft={Save} onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field
          label="Default assignee"
          help={'Use "unassigned" to keep new conversations in queue.'}
        >
          <Input
            placeholder="unassigned"
            value={value.defaultAssignee}
            onChange={(e) => onChange({ ...value, defaultAssignee: e.target.value })}
          />
        </Field>
        <div className="flex items-start justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
          <div>
            <Label htmlFor="rt-roundRobin" className="text-[13px]">
              Round-robin
            </Label>
            <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
              Distribute incoming chats equally.
            </p>
          </div>
          <Switch
            id="rt-roundRobin"
            checked={value.roundRobin}
            onCheckedChange={(c) => onChange({ ...value, roundRobin: !!c })}
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
  const { toast } = useToast();

  function sendTest() {
    if (!value.url) return toast.error('Add a webhook URL first.');
    toast.info('Test webhook queued.');
  }

  return (
    <Card padding="lg">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Webhooks"
          description="Forward inbound messages and events to your own endpoint."
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" iconLeft={Send} onClick={sendTest}>
            Send test
          </Button>
          <Button variant="primary" size="sm" iconLeft={Save} onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Webhook URL">
          <Input
            type="url"
            placeholder="https://..."
            value={value.url}
            onChange={(e) => onChange({ ...value, url: e.target.value })}
          />
        </Field>
        <Field label="Signing secret">
          <Input
            type="password"
            value={value.secret}
            onChange={(e) => onChange({ ...value, secret: e.target.value })}
          />
        </Field>
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
    <Card padding="lg">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Notifications &amp; Alerts"
          description="Control which events your agents are notified about."
          icon={<BellRing className="h-4 w-4" />}
        />
        <Button variant="primary" size="sm" iconLeft={Save} onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      <div className="mt-5 grid gap-3">
        <div className="flex items-start justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
          <div>
            <Label className="text-[13px]">Desktop Push Notifications</Label>
            <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
              Receive native OS notifications for new messages.
            </p>
          </div>
          <Button variant="outline" size="sm">
            Enable Push
          </Button>
        </div>
        <div className="flex items-start justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
          <div>
            <Label htmlFor="notif-sound" className="text-[13px]">
              Widget Sound Alerts
            </Label>
            <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
              Play a sound "ding" when a new message arrives.
            </p>
          </div>
          <Switch id="notif-sound" defaultChecked aria-label="Widget sound alerts" />
        </div>

        <Separator className="my-2" />

        {[
          {
            key: 'newMessage' as const,
            label: 'Email: New message',
            desc: 'Notify when a new inbound message lands.',
          },
          {
            key: 'escalation' as const,
            label: 'Email: Escalation',
            desc: 'Alert when a conversation is escalated.',
          },
          {
            key: 'agentMention' as const,
            label: 'Email: Agent mention',
            desc: 'Ping an agent when they are @mentioned.',
          },
        ].map((row) => (
          <div key={row.key} className="flex items-start justify-between gap-4 px-1 py-2">
            <div>
              <Label htmlFor={`notif-${row.key}`} className="text-[13px]">
                {row.label}
              </Label>
              <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">{row.desc}</p>
            </div>
            <Switch
              id={`notif-${row.key}`}
              checked={value[row.key]}
              onCheckedChange={(c) => onChange({ ...value, [row.key]: !!c })}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
