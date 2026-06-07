'use client';

import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  IconButton,
  Switch,
  Label,
  Input,
  Badge,
  Separator,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  Bell,
  Mail,
  Monitor,
  Smartphone,
  Volume2,
  Plus,
  Play,
  Trash2,
} from 'lucide-react';

import * as React from 'react';

import { useProject } from '@/context/project-context';
import { SettingsTabs } from '../_components/settings-tabs';
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  type SabwaNotificationPrefs,
  type SabwaDigestFrequency,
  type SabwaMuteWindow,
} from '@/app/actions/sabwa.actions';

const SOUND_PRESETS = [
  { value: 'chime', label: 'Chime' },
  { value: 'ding', label: 'Ding' },
  { value: 'pop', label: 'Pop' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'silent', label: 'Silent' },
];

const DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const DEFAULT_PREFS: SabwaNotificationPrefs = {
  desktop: { enabled: true, sound: 'chime' },
  email: { enabled: false, frequency: 'daily', recipients: [] },
  push: { enabled: false },
  incomingSound: 'chime',
  muteSchedules: [],
  events: {
    groupMentions: true,
    directMessages: true,
    systemAlerts: true,
  },
};

function newWindow(): SabwaMuteWindow {
  return {
    id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: 'Quiet hours',
    start: '22:00',
    end: '07:00',
    days: [0, 1, 2, 3, 4, 5, 6],
  };
}

export default function NotificationsSettingsPage() {
  const { activeProjectId } = useProject();
  const { toast } = useToast();
  const [prefs, setPrefs] = React.useState<SabwaNotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = React.useState(true);
  const [pending, startTransition] = React.useTransition();
  const [recipientDraft, setRecipientDraft] = React.useState('');

  React.useEffect(() => {
    if (!activeProjectId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getNotificationPrefs(activeProjectId)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          // Merge with defaults in case of missing fields
          setPrefs({ ...DEFAULT_PREFS, ...res.prefs, events: { ...DEFAULT_PREFS.events, ...res.prefs.events } });
        } else {
          toast.error(res.error || 'Failed to fetch notification preferences');
        }
      })
      .catch((e: any) => {
        if (!cancelled) toast.error(e?.message || 'Error connecting to notifications API');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, toast]);

  const persist = (patch: Partial<SabwaNotificationPrefs>, label: string) => {
    if (!activeProjectId) {
      toast.error('No active project.');
      return;
    }
    startTransition(async () => {
      try {
        const res = await updateNotificationPrefs({ projectId: activeProjectId, patch });
        if (res.ok) {
          toast.success(`${label} saved.`);
        } else {
          toast.error(res.error || 'Save failed');
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  const previewSound = () => {
    toast.success(`Previewing sound: ${prefs.desktop.sound}`);
    // Real audio playback would live in a shared hook; the toast keeps the
    // intent visible until that lands.
  };

  const addRecipient = () => {
    const v = recipientDraft.trim();
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast.error('Enter a valid email address.');
      return;
    }
    if (prefs.email.recipients.includes(v)) {
      toast.error('Recipient already added.');
      return;
    }
    setPrefs((p) => ({ ...p, email: { ...p.email, recipients: [...p.email.recipients, v] } }));
    setRecipientDraft('');
  };

  const removeRecipient = (email: string) => {
    setPrefs((p) => ({
      ...p,
      email: { ...p.email, recipients: p.email.recipients.filter((r) => r !== email) },
    }));
  };

  const addMuteWindow = () => {
    setPrefs((p) => ({ ...p, muteSchedules: [...p.muteSchedules, newWindow()] }));
  };

  const updateMuteWindow = (id: string, patch: Partial<SabwaMuteWindow>) => {
    setPrefs((p) => ({
      ...p,
      muteSchedules: p.muteSchedules.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  };

  const removeMuteWindow = (id: string) => {
    setPrefs((p) => ({ ...p, muteSchedules: p.muteSchedules.filter((w) => w.id !== id) }));
  };

  const toggleDay = (id: string, day: number) => {
    setPrefs((p) => ({
      ...p,
      muteSchedules: p.muteSchedules.map((w) =>
        w.id === id
          ? { ...w, days: w.days.includes(day) ? w.days.filter((d) => d !== day) : [...w.days, day] }
          : w,
      ),
    }));
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <PageHeader bordered={false}>
        <PageHeaderHeading>
          <div className="flex items-start gap-3">
            <span className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-3 text-[var(--st-text)]">
              <Bell className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <PageTitle>Settings, Notifications</PageTitle>
              <PageDescription>
                Control where SabWa pings you when new messages, calls, or system events come in.
              </PageDescription>
            </div>
          </div>
        </PageHeaderHeading>
      </PageHeader>
      <SettingsTabs />

      {/* Event triggers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" aria-hidden="true" />
            Events to notify
          </CardTitle>
          <CardDescription>
            Choose exactly what events should trigger a notification.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch
                checked={prefs.events?.directMessages ?? true}
                onCheckedChange={(v) =>
                  setPrefs((p) => ({
                    ...p,
                    events: { ...p.events, directMessages: v } as typeof p.events,
                  }))
                }
                disabled={loading || pending}
                aria-label="Toggle direct messages"
              />
              <Label className="text-sm">Direct messages</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={prefs.events?.groupMentions ?? true}
                onCheckedChange={(v) =>
                  setPrefs((p) => ({
                    ...p,
                    events: { ...p.events, groupMentions: v } as typeof p.events,
                  }))
                }
                disabled={loading || pending}
                aria-label="Toggle group mentions"
              />
              <Label className="text-sm">Group mentions (@mentions)</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={prefs.events?.systemAlerts ?? true}
                onCheckedChange={(v) =>
                  setPrefs((p) => ({
                    ...p,
                    events: { ...p.events, systemAlerts: v } as typeof p.events,
                  }))
                }
                disabled={loading || pending}
                aria-label="Toggle system alerts"
              />
              <Label className="text-sm">System alerts</Label>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="primary"
              onClick={() => persist({ events: prefs.events }, 'Events to notify')}
              disabled={pending}
            >
              Save
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Desktop notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-4 w-4" aria-hidden="true" />
            Desktop notifications
          </CardTitle>
          <CardDescription>
            Browser-level notifications for incoming messages and mentions.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={prefs.desktop.enabled}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, desktop: { ...p.desktop, enabled: v } }))}
              disabled={loading || pending}
              aria-label="Toggle desktop notifications"
            />
            <Label className="text-sm">Show desktop notifications</Label>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="desktop-sound">Notification sound</Label>
              <Select
                value={prefs.desktop.sound}
                onValueChange={(v) => setPrefs((p) => ({ ...p, desktop: { ...p.desktop, sound: v } }))}
                disabled={!prefs.desktop.enabled || loading || pending}
              >
                <SelectTrigger id="desktop-sound">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOUND_PRESETS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" iconLeft={Play} onClick={previewSound} disabled={!prefs.desktop.enabled}>
              Preview
            </Button>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="primary"
              onClick={() => persist({ desktop: prefs.desktop }, 'Desktop notifications')}
              disabled={pending}
            >
              Save
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Email digests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" aria-hidden="true" />
            Email digests
          </CardTitle>
          <CardDescription>Periodic summary emails of SabWa activity.</CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={prefs.email.enabled}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, email: { ...p.email, enabled: v } }))}
              disabled={loading || pending}
              aria-label="Toggle email digests"
            />
            <Label className="text-sm">Send email digests</Label>
          </div>

          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="digest-freq">Frequency</Label>
            <Select
              value={prefs.email.frequency}
              onValueChange={(v) =>
                setPrefs((p) => ({ ...p, email: { ...p.email, frequency: v as SabwaDigestFrequency } }))
              }
              disabled={!prefs.email.enabled || loading || pending}
            >
              <SelectTrigger id="digest-freq">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="digest-recipient">Recipients</Label>
            <div className="flex flex-wrap gap-2">
              {prefs.email.recipients.map((r) => (
                <Badge key={r} variant="secondary" className="gap-1.5">
                  {r}
                  <IconButton
                    label={`Remove ${r}`}
                    icon={Trash2}
                    size="sm"
                    onClick={() => removeRecipient(r)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 max-w-md">
              <Input
                id="digest-recipient"
                type="email"
                value={recipientDraft}
                onChange={(e) => setRecipientDraft(e.target.value)}
                placeholder="name@company.com"
                disabled={!prefs.email.enabled || loading || pending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addRecipient();
                  }
                }}
              />
              <Button
                variant="outline"
                iconLeft={Plus}
                onClick={addRecipient}
                disabled={!prefs.email.enabled || loading || pending}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="primary"
              onClick={() => persist({ email: prefs.email }, 'Email digests')}
              disabled={pending}
            >
              Save
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Push (mobile), coming soon */}
      <Card className="opacity-70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            Push (mobile app)
            <Badge variant="secondary">Coming soon</Badge>
          </CardTitle>
          <CardDescription>
            Native push notifications via the SabNode iOS and Android apps.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="flex items-center gap-3">
            <Switch checked={prefs.push.enabled} disabled aria-label="Toggle push notifications" />
            <Label className="text-sm text-[var(--st-text-secondary)]">Enable mobile push</Label>
          </div>
        </CardBody>
      </Card>

      {/* Sound for incoming */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            Sound for incoming
          </CardTitle>
          <CardDescription>Picked sound plays whenever the SabWa tab is focused.</CardDescription>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="incoming-sound">Preset</Label>
            <Select
              value={prefs.incomingSound}
              onValueChange={(v) => setPrefs((p) => ({ ...p, incomingSound: v }))}
              disabled={loading || pending}
            >
              <SelectTrigger id="incoming-sound">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOUND_PRESETS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="primary"
              onClick={() => persist({ incomingSound: prefs.incomingSound }, 'Incoming sound')}
              disabled={pending}
            >
              Save
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Mute schedules */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Mute schedules</CardTitle>
            <CardDescription>
              Time windows during which SabWa silences notifications. Useful for quiet hours and weekends.
            </CardDescription>
          </div>
          <Button size="sm" variant="primary" iconLeft={Plus} onClick={addMuteWindow} disabled={pending}>
            Add window
          </Button>
        </CardHeader>
        <CardBody>
          {prefs.muteSchedules.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No mute schedules"
              description="Notifications are always on. Add a window to silence SabWa during quiet hours."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Label</Th>
                  <Th>Start</Th>
                  <Th>End</Th>
                  <Th>Days</Th>
                  <Th className="w-10" />
                </Tr>
              </THead>
              <TBody>
                {prefs.muteSchedules.map((w) => (
                  <Tr key={w.id}>
                    <Td>
                      <Input
                        value={w.label ?? ''}
                        onChange={(e) => updateMuteWindow(w.id, { label: e.target.value })}
                        aria-label="Mute window label"
                        className="max-w-40"
                      />
                    </Td>
                    <Td>
                      <Input
                        type="time"
                        value={w.start}
                        onChange={(e) => updateMuteWindow(w.id, { start: e.target.value })}
                        aria-label="Mute window start time"
                        className="max-w-32"
                      />
                    </Td>
                    <Td>
                      <Input
                        type="time"
                        value={w.end}
                        onChange={(e) => updateMuteWindow(w.id, { end: e.target.value })}
                        aria-label="Mute window end time"
                        className="max-w-32"
                      />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {DAYS.map((d) => {
                          const active = w.days.includes(d.value);
                          return (
                            <Button
                              key={d.value}
                              size="sm"
                              variant={active ? 'primary' : 'outline'}
                              aria-pressed={active}
                              onClick={() => toggleDay(w.id, d.value)}
                            >
                              {d.label}
                            </Button>
                          );
                        })}
                      </div>
                    </Td>
                    <Td>
                      <IconButton
                        label={`Remove ${w.label || 'mute window'}`}
                        icon={Trash2}
                        variant="ghost"
                        onClick={() => removeMuteWindow(w.id)}
                      />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={() => persist({ muteSchedules: prefs.muteSchedules }, 'Mute schedules')}
          disabled={pending}
        >
          Save mute schedules
        </Button>
      </div>
    </div>
  );
}
