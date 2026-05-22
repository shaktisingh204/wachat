'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Switch,
  Label,
  Input,
  Badge,
  Separator,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
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
import { toast } from 'sonner';

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
        if (res.ok) setPrefs(res.prefs);
      })
      .catch(() => {
        /* Phase 1 stub */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

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
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Bell className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings — Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control where SabWa pings you when new messages, calls, or system events come in.
          </p>
        </div>
      </div>
      <SettingsTabs />

      {/* Desktop notifications */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Desktop notifications
          </ZoruCardTitle>
          <ZoruCardDescription>
            Browser-level notifications for incoming messages and mentions.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <ZoruSwitch
              checked={prefs.desktop.enabled}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, desktop: { ...p.desktop, enabled: v } }))}
              disabled={loading || pending}
              aria-label="Toggle desktop notifications"
            />
            <ZoruLabel className="text-sm">Show desktop notifications</ZoruLabel>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end max-w-md">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="desktop-sound">Notification sound</ZoruLabel>
              <ZoruSelect
                value={prefs.desktop.sound}
                onValueChange={(v) => setPrefs((p) => ({ ...p, desktop: { ...p.desktop, sound: v } }))}
                disabled={!prefs.desktop.enabled || loading || pending}
              >
                <ZoruSelectTrigger id="desktop-sound">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {SOUND_PRESETS.map((s) => (
                    <ZoruSelectItem key={s.value} value={s.value}>
                      {s.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <ZoruButton variant="outline" onClick={previewSound} disabled={!prefs.desktop.enabled}>
              <Play className="mr-2 h-4 w-4" />
              Preview
            </ZoruButton>
          </div>
          <div className="flex justify-end">
            <ZoruButton size="sm" onClick={() => persist({ desktop: prefs.desktop }, 'Desktop notifications')} disabled={pending}>
              Save
            </ZoruButton>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      {/* Email digests */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email digests
          </ZoruCardTitle>
          <ZoruCardDescription>Periodic summary emails of SabWa activity.</ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <ZoruSwitch
              checked={prefs.email.enabled}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, email: { ...p.email, enabled: v } }))}
              disabled={loading || pending}
              aria-label="Toggle email digests"
            />
            <ZoruLabel className="text-sm">Send email digests</ZoruLabel>
          </div>

          <div className="space-y-1.5 max-w-xs">
            <ZoruLabel htmlFor="digest-freq">Frequency</ZoruLabel>
            <ZoruSelect
              value={prefs.email.frequency}
              onValueChange={(v) =>
                setPrefs((p) => ({ ...p, email: { ...p.email, frequency: v as SabwaDigestFrequency } }))
              }
              disabled={!prefs.email.enabled || loading || pending}
            >
              <ZoruSelectTrigger id="digest-freq">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="daily">Daily</ZoruSelectItem>
                <ZoruSelectItem value="weekly">Weekly</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="digest-recipient">Recipients</ZoruLabel>
            <div className="flex flex-wrap gap-2">
              {prefs.email.recipients.map((r) => (
                <ZoruBadge key={r} variant="secondary" className="gap-1.5">
                  {r}
                  <button
                    type="button"
                    onClick={() => removeRecipient(r)}
                    aria-label={`Remove ${r}`}
                    className="hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </ZoruBadge>
              ))}
            </div>
            <div className="flex gap-2 max-w-md">
              <ZoruInput
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
              <ZoruButton
                variant="outline"
                onClick={addRecipient}
                disabled={!prefs.email.enabled || loading || pending}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add
              </ZoruButton>
            </div>
          </div>

          <div className="flex justify-end">
            <ZoruButton size="sm" onClick={() => persist({ email: prefs.email }, 'Email digests')} disabled={pending}>
              Save
            </ZoruButton>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      {/* Push (mobile) — coming soon */}
      <ZoruCard className="opacity-70">
        <ZoruCardHeader>
          <ZoruCardTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Push (mobile app)
            <ZoruBadge variant="secondary">Coming soon</ZoruBadge>
          </ZoruCardTitle>
          <ZoruCardDescription>
            Native push notifications via the SabNode iOS and Android apps.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="flex items-center gap-3">
            <ZoruSwitch checked={prefs.push.enabled} disabled aria-label="Toggle push notifications" />
            <ZoruLabel className="text-sm text-muted-foreground">Enable mobile push</ZoruLabel>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      {/* Sound for incoming */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Sound for incoming
          </ZoruCardTitle>
          <ZoruCardDescription>Picked sound plays whenever the SabWa tab is focused.</ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3">
          <div className="space-y-1.5 max-w-xs">
            <ZoruLabel htmlFor="incoming-sound">Preset</ZoruLabel>
            <ZoruSelect
              value={prefs.incomingSound}
              onValueChange={(v) => setPrefs((p) => ({ ...p, incomingSound: v }))}
              disabled={loading || pending}
            >
              <ZoruSelectTrigger id="incoming-sound">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {SOUND_PRESETS.map((s) => (
                  <ZoruSelectItem key={s.value} value={s.value}>
                    {s.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="flex justify-end">
            <ZoruButton
              size="sm"
              onClick={() => persist({ incomingSound: prefs.incomingSound }, 'Incoming sound')}
              disabled={pending}
            >
              Save
            </ZoruButton>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      {/* Mute schedules */}
      <ZoruCard>
        <ZoruCardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
          <div>
            <ZoruCardTitle>Mute schedules</ZoruCardTitle>
            <ZoruCardDescription>
              Time windows during which SabWa silences notifications. Useful for quiet hours and weekends.
            </ZoruCardDescription>
          </div>
          <ZoruButton size="sm" onClick={addMuteWindow} disabled={pending}>
            <Plus className="mr-2 h-4 w-4" />
            Add window
          </ZoruButton>
        </ZoruCardHeader>
        <ZoruCardContent>
          {prefs.muteSchedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mute schedules — notifications are always on.</p>
          ) : (
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Label</ZoruTableHead>
                  <ZoruTableHead>Start</ZoruTableHead>
                  <ZoruTableHead>End</ZoruTableHead>
                  <ZoruTableHead>Days</ZoruTableHead>
                  <ZoruTableHead className="w-10" />
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {prefs.muteSchedules.map((w) => (
                  <ZoruTableRow key={w.id}>
                    <ZoruTableCell>
                      <ZoruInput
                        value={w.label ?? ''}
                        onChange={(e) => updateMuteWindow(w.id, { label: e.target.value })}
                        className="max-w-40"
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruInput
                        type="time"
                        value={w.start}
                        onChange={(e) => updateMuteWindow(w.id, { start: e.target.value })}
                        className="max-w-32"
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruInput
                        type="time"
                        value={w.end}
                        onChange={(e) => updateMuteWindow(w.id, { end: e.target.value })}
                        className="max-w-32"
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <div className="flex flex-wrap gap-1">
                        {DAYS.map((d) => {
                          const active = w.days.includes(d.value);
                          return (
                            <button
                              type="button"
                              key={d.value}
                              onClick={() => toggleDay(w.id, d.value)}
                              className={
                                active
                                  ? 'rounded-md bg-primary text-primary-foreground px-2 py-1 text-xs font-medium'
                                  : 'rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground'
                              }
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruButton
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMuteWindow(w.id)}
                        aria-label={`Remove ${w.label || 'mute window'}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </ZoruButton>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </ZoruTable>
          )}
        </ZoruCardContent>
      </ZoruCard>

      <ZoruSeparator />

      <div className="flex justify-end">
        <ZoruButton
          onClick={() =>
            persist({ muteSchedules: prefs.muteSchedules }, 'Mute schedules')
          }
          disabled={pending}
        >
          Save mute schedules
        </ZoruButton>
      </div>
    </div>
  );
}
