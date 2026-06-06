'use client';

import { Button, Card, CardBody, Input, Label, Skeleton, Switch } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import {
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  LoaderCircle,
  Users,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  ConnectionHeader,
  IntegrationActivityFeed,
  IntegrationKpiGrid,
  IntegrationSection,
  IntegrationSyncHistory,
  useIntegrationToast,
  type ConnectionState,
} from '@/components/crm/integration-console';
import {
  getGoogleCalendarSetting,
  saveGoogleCalendarSetting,
  testIntegration,
  disconnectIntegration,
  getIntegrationEvents,
  getIntegrationStats,
  type IntegrationEvent,
  type IntegrationStats,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsGoogleCalendarSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsGoogleCalendarSetting & { _id: unknown }) | null;

export default function GoogleCalendarIntegrationPage() {
  const { reportResult } = useIntegrationToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [, startLoading] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveGoogleCalendarSetting,
    { message: '', error: '' } as { message?: string; error?: string; id?: string },
  );
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [d, ev, st] = await Promise.all([
        getGoogleCalendarSetting() as Promise<Doc>,
        getIntegrationEvents('google-calendar', 10),
        getIntegrationStats('google-calendar'),
      ]);
      setDoc(d);
      setEnabled(Boolean(d?.enabled));
      setEvents(ev);
      setStats(st);
    });
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      reportResult('google-calendar', saveState);
      refresh();
    } else if (saveState?.error) {
      reportResult('google-calendar', saveState);
    }
  }, [saveState, reportResult, refresh]);

  const v = (k: keyof WsGoogleCalendarSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';
  const hasOAuthApp = Boolean(doc?.client_id && doc?.client_secret);
  const state: ConnectionState = hasOAuthApp
    ? enabled
      ? 'connected'
      : 'disconnected'
    : 'disconnected';

  const onTest = () => {
    startTesting(async () => {
      const res = await testIntegration('google-calendar');
      reportResult('google-calendar', res);
      refresh();
    });
  };

  const onDisconnect = () => {
    startDisconnect(async () => {
      const res = await disconnectIntegration('google-calendar');
      reportResult('google-calendar', res);
      setEnabled(false);
      refresh();
    });
  };

  const conflicts = events.filter(
    (e) => e.status === 'failure' && /conflict/i.test(e.message || ''),
  ).length;

  if (!mounted) {
    return (
      <div className="flex h-60 items-center justify-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-[var(--st-text-secondary)]" />
      </div>
    );
  }

  return (
    <EntityListShell
      title="Google Calendar"
      subtitle="Two-way sync between CRM events and Google Calendar."
    >
      <div className="space-y-4">
        <ConnectionHeader
          name="Google Calendar"
          description="OAuth-based per-member calendar sync."
          icon={CalendarDays}
          state={state}
          connectedAs={doc?.client_id ? `OAuth app ${String(doc.client_id).slice(0, 12)}…` : null}
          connectedAt={(doc as any)?.updatedAt || (doc as any)?.createdAt || null}
          scopes={hasOAuthApp ? ['calendar.events', 'calendar.readonly'] : []}
          onTest={hasOAuthApp ? onTest : undefined}
          isTesting={isTesting}
          onDisconnect={onDisconnect}
          isDisconnecting={isDisconnecting}
        />

        <IntegrationKpiGrid
          kpis={[
            {
              label: 'Connected accounts',
              value: hasOAuthApp ? (enabled ? 1 : 0) : 0,
              period: enabled ? 'Workspace enabled' : 'Workspace disabled',
              icon: <Users />,
            },
            {
              label: 'Events synced today',
              value: stats?.deliveriesToday ?? 0,
              period: `${stats?.deliveriesThisMonth ?? 0} this month`,
              icon: <CalendarPlus />,
            },
            {
              label: 'Conflicts',
              value: conflicts,
              period: conflicts > 0 ? 'Review activity log' : 'No conflicts',
              icon: <AlertCircle />,
              invertDelta: true,
              delta: conflicts,
            },
            {
              label: 'Last sync',
              value: stats?.lastSuccessAt
                ? new Date(stats.lastSuccessAt).toLocaleString()
                : 'Never',
              period: stats?.failuresToday
                ? `${stats.failuresToday} failed today`
                : 'Healthy',
              icon: <CalendarDays />,
            },
          ]}
        />

        <IntegrationSection
          title="OAuth credentials"
          description="Client credentials from Google Cloud Console."
        >
          {!doc && !id ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          <form action={saveFormAction} className="space-y-4">
            {id ? <input type="hidden" name="_id" value={id} /> : null}
            <input type="hidden" name="enabled" value={enabled ? 'true' : 'false'} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="client_id">Client ID</Label>
                <div className="mt-1.5">
                  <Input id="client_id" name="client_id" defaultValue={v('client_id')} />
                </div>
              </div>
              <div>
                <Label htmlFor="client_secret">Client Secret</Label>
                <div className="mt-1.5">
                  <Input id="client_secret" name="client_secret" type="password" defaultValue={v('client_secret')} />
                </div>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="redirect_uri">Redirect URI</Label>
                <div className="mt-1.5">
                  <Input id="redirect_uri" name="redirect_uri" defaultValue={v('redirect_uri')} />
                </div>
              </div>

              <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-3">
                <div>
                  <div className="text-[13px] text-[var(--st-text)]">Workspace enabled</div>
                  <div className="text-[12px] text-[var(--st-text-secondary)]">
                    Allow members to connect their Google Calendar.
                  </div>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Google Calendar enabled" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          </form>
        </IntegrationSection>

        {stats?.lastErrorMessage ? (
          <Card>
            <CardBody className="flex items-start gap-3 border-l-2 border-[var(--st-danger)]/40 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--st-danger)]" />
              <div>
                <p className="text-sm font-medium text-[var(--st-text)]">Last sync error</p>
                <p className="mt-0.5 text-xs text-[var(--st-text-secondary)] break-words">
                  {stats.lastErrorMessage}
                </p>
              </div>
            </CardBody>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <IntegrationSyncHistory events={events} />
          <IntegrationActivityFeed events={events} />
        </div>
      </div>
    </EntityListShell>
  );
}
