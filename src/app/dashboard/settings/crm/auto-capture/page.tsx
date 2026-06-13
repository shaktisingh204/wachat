'use client';

/**
 * SabCRM — Activity auto-capture (`/dashboard/settings/crm/auto-capture`).
 *
 * Automatically log inbound email + Google Calendar events as CRM activities
 * on the matching person/lead record — no manual logging. Toggle the master
 * switch + per-channel switches, run an on-demand calendar pull, and see the
 * last-run summary.
 *
 * Pure 20ui; auth/RBAC/project enforced by the layout + re-checked per action.
 */

import * as React from 'react';
import { Inbox, Mail, CalendarClock, RefreshCw } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Button,
  Card,
  Field,
  Switch,
  Alert,
  Skeleton,
  Badge,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  getAutoCaptureConfigTw,
  saveAutoCaptureConfigTw,
  runCalendarCaptureTw,
} from '@/app/actions/sabcrm-autocapture.actions';
import type { AutoCaptureConfig } from '@/lib/sabcrm/auto-capture.server';

function fmt(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleString();
}

export default function AutoCapturePage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [cfg, setCfg] = React.useState<AutoCaptureConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await getAutoCaptureConfigTw(activeProjectId);
      if (!alive) return;
      if (res.ok) setCfg(res.data);
      else setError(res.error);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  async function patch(
    key: 'enabled' | 'captureEmail' | 'captureCalendar',
    value: boolean,
  ): Promise<void> {
    if (!activeProjectId || !cfg) return;
    setSavingKey(key);
    const res = await saveAutoCaptureConfigTw({ [key]: value }, activeProjectId);
    setSavingKey(null);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    setCfg(res.data);
    toast({ title: 'Saved', tone: 'success' });
  }

  async function runCalendar(): Promise<void> {
    if (!activeProjectId) return;
    setRunning(true);
    const res = await runCalendarCaptureTw(activeProjectId);
    setRunning(false);
    if (!res.ok) {
      toast({ title: 'Capture failed', description: res.error, tone: 'danger' });
      return;
    }
    const { eventsScanned, activitiesLogged, reason } = res.data;
    toast({
      title: activitiesLogged > 0 ? 'Calendar captured' : 'Nothing new to capture',
      description:
        activitiesLogged > 0
          ? `Logged ${activitiesLogged} meeting${activitiesLogged === 1 ? '' : 's'} from ${eventsScanned} event${eventsScanned === 1 ? '' : 's'}.`
          : reason === 'not-connected'
            ? 'No Google Calendar is connected for your account.'
            : reason === 'disabled'
              ? 'Calendar capture is turned off.'
              : `Scanned ${eventsScanned} event${eventsScanned === 1 ? '' : 's'}; no matching records.`,
      tone: activitiesLogged > 0 ? 'success' : 'neutral',
    });
    // Refresh last-run.
    const refreshed = await getAutoCaptureConfigTw(activeProjectId);
    if (refreshed.ok) setCfg(refreshed.data);
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Activity auto-capture</PageTitle>
          <PageDescription>
            Automatically log inbound email and Google Calendar events as CRM
            activities on the matching person or lead — no manual logging.
            Matching is by email address; every captured activity is
            de-duplicated so re-deliveries never double-log.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      {loading || isLoadingProject || !cfg ? (
        <div className="flex flex-col gap-[var(--st-space-2)]">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <Card className="flex items-center justify-between gap-[var(--st-space-3)] p-[var(--st-space-4)]">
            <div className="flex items-start gap-[var(--st-space-3)]">
              <span aria-hidden="true" className="mt-[2px]">
                <Inbox size={18} />
              </span>
              <div>
                <div className="font-medium">Auto-capture</div>
                <div className="text-[var(--ui20-fg-muted,#666)] text-sm">
                  Master switch. When off, nothing is captured.
                </div>
              </div>
            </div>
            <Switch
              checked={cfg.enabled}
              aria-label="Enable auto-capture"
              disabled={savingKey === 'enabled'}
              onCheckedChange={(v) => patch('enabled', v)}
            />
          </Card>

          <Card className="flex items-center justify-between gap-[var(--st-space-3)] p-[var(--st-space-4)]">
            <div className="flex items-start gap-[var(--st-space-3)]">
              <span aria-hidden="true" className="mt-[2px]">
                <Mail size={18} />
              </span>
              <div>
                <div className="font-medium">Inbound email</div>
                <div className="text-[var(--ui20-fg-muted,#666)] text-sm">
                  Log an EMAIL activity whenever an inbound message&rsquo;s sender
                  matches a record.
                </div>
              </div>
            </div>
            <Switch
              checked={cfg.captureEmail}
              aria-label="Capture inbound email"
              disabled={!cfg.enabled || savingKey === 'captureEmail'}
              onCheckedChange={(v) => patch('captureEmail', v)}
            />
          </Card>

          <Card className="flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-4)]">
            <div className="flex items-center justify-between gap-[var(--st-space-3)]">
              <div className="flex items-start gap-[var(--st-space-3)]">
                <span aria-hidden="true" className="mt-[2px]">
                  <CalendarClock size={18} />
                </span>
                <div>
                  <div className="font-medium">Google Calendar</div>
                  <div className="text-[var(--ui20-fg-muted,#666)] text-sm">
                    Log a MEETING activity for events whose attendees match a
                    record. Runs on a schedule; pull on demand below.
                  </div>
                </div>
              </div>
              <Switch
                checked={cfg.captureCalendar}
                aria-label="Capture calendar events"
                disabled={!cfg.enabled || savingKey === 'captureCalendar'}
                onCheckedChange={(v) => patch('captureCalendar', v)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-[var(--st-space-3)] border-t border-[var(--ui20-border,#e5e5e5)] pt-[var(--st-space-3)]">
              <Field label="Last calendar run" className="min-w-[160px]">
                <Badge tone="neutral">{fmt(cfg.lastCalendarRunAt)}</Badge>
              </Field>
              <Field label="Last captured" className="min-w-[120px]">
                <Badge tone={cfg.lastCalendarCaptured > 0 ? 'success' : 'neutral'}>
                  {cfg.lastCalendarCaptured} meeting
                  {cfg.lastCalendarCaptured === 1 ? '' : 's'}
                </Badge>
              </Field>
              <div className="ml-auto">
                <Button
                  variant="secondary"
                  iconLeft={RefreshCw}
                  onClick={runCalendar}
                  loading={running}
                  disabled={running || !cfg.enabled || !cfg.captureCalendar}
                >
                  Capture now
                </Button>
              </div>
            </div>
          </Card>

          <Card className="flex flex-wrap items-center gap-[var(--st-space-4)] p-[var(--st-space-4)] text-sm">
            <div>
              <div className="text-[var(--ui20-fg-muted,#666)]">
                Last inbound-email capture
              </div>
              <div className="font-medium">{fmt(cfg.lastEmailRunAt)}</div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
