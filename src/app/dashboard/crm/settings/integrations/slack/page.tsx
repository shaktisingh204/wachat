'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  Input,
  Label,
  Skeleton,
  Switch,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { Hash, LoaderCircle, Send, Slack as SlackIcon, AlertCircle, MessagesSquare } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  ConnectionHeader,
  IntegrationActivityFeed,
  IntegrationKpiGrid,
  IntegrationSection,
  useIntegrationToast,
  type ConnectionState,
} from '@/components/crm/integration-console';
import {
  getSlackSetting,
  saveSlackSetting,
  testIntegration,
  disconnectIntegration,
  getIntegrationEvents,
  getIntegrationStats,
  type IntegrationEvent,
  type IntegrationStats,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsSlackSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsSlackSetting & { _id: unknown }) | null;

export default function SlackIntegrationPage() {
  const { reportResult } = useIntegrationToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [isActive, setIsActive] = useState(false);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [, startLoading] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveSlackSetting,
    { message: '', error: '' } as { message?: string; error?: string; id?: string },
  );
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [d, ev, st] = await Promise.all([
        getSlackSetting() as Promise<Doc>,
        getIntegrationEvents('slack', 10),
        getIntegrationStats('slack'),
      ]);
      setDoc(d);
      setIsActive(Boolean(d?.is_active));
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
      reportResult('slack', saveState);
      refresh();
    } else if (saveState?.error) {
      reportResult('slack', saveState);
    }
  }, [saveState, reportResult, refresh]);

  const v = (k: keyof WsSlackSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';
  const state: ConnectionState = doc?.webhook_url
    ? isActive
      ? 'connected'
      : 'disconnected'
    : 'disconnected';

  const onTest = () => {
    startTesting(async () => {
      const res = await testIntegration('slack');
      reportResult('slack', res);
      refresh();
    });
  };

  const onDisconnect = () => {
    startDisconnect(async () => {
      const res = await disconnectIntegration('slack');
      reportResult('slack', res);
      setIsActive(false);
      refresh();
    });
  };

  const errorRatePct = useMemo(
    () => (stats ? Math.round(stats.errorRate30d * 1000) / 10 : 0),
    [stats],
  );

  const channelLabel = doc?.channel || 'not set';
  const lastDelivery = events.find((e) => e.status === 'success' && (e.kind === 'delivery' || e.kind === 'test'));
  const lastDeliveryLabel = lastDelivery
    ? new Date(lastDelivery.createdAt).toLocaleString()
    : 'Never';

  if (!mounted) {
    return (
      <div className="flex h-60 items-center justify-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-[var(--st-text-secondary)]" />
      </div>
    );
  }

  return (
    <EntityListShell title="Slack" subtitle="Post notifications to a Slack channel via incoming webhook.">
      <div className="space-y-4">
        <ConnectionHeader
          name="Slack"
          description="Incoming-webhook delivery for CRM notifications."
          icon={SlackIcon}
          state={state}
          connectedAs={doc?.username || null}
          connectedAt={(doc as any)?.updatedAt || (doc as any)?.createdAt || null}
          scopes={doc?.webhook_url ? ['incoming-webhook'] : []}
          onTest={doc?.webhook_url ? onTest : undefined}
          isTesting={isTesting}
          onDisconnect={onDisconnect}
          isDisconnecting={isDisconnecting}
        />

        <IntegrationKpiGrid
          kpis={[
            {
              label: 'Channel',
              value: doc?.channel ? <span className="inline-flex items-center gap-1"><Hash className="h-4 w-4" />{doc.channel.replace(/^#/, '')}</span> : '—',
              period: channelLabel === 'not set' ? 'Configure below' : 'Active channel',
              icon: <Hash />,
            },
            {
              label: 'Messages this month',
              value: stats?.deliveriesThisMonth ?? 0,
              period: `${stats?.deliveriesToday ?? 0} today`,
              icon: <MessagesSquare />,
            },
            {
              label: 'Last delivery',
              value: lastDeliveryLabel,
              period: `${stats?.failuresToday ?? 0} failed today`,
              icon: <Send />,
            },
            {
              label: 'Error rate (30d)',
              value: `${errorRatePct}%`,
              period: stats?.lastErrorMessage ? 'Last error logged' : 'No recent errors',
              icon: <AlertCircle />,
              invertDelta: true,
              delta: errorRatePct,
            },
          ]}
        />

        <IntegrationSection
          title="Configuration"
          description="Webhook URL and default channel for outbound messages."
        >
          {!doc && !id ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          <form action={saveFormAction} className="space-y-4">
            {id ? <input type="hidden" name="_id" value={id} /> : null}
            <input type="hidden" name="is_active" value={isActive ? 'true' : 'false'} />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="webhook_url">Webhook URL</Label>
                <div className="mt-1.5">
                  <Input
                    id="webhook_url"
                    name="webhook_url"
                    defaultValue={v('webhook_url')}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="channel">Channel</Label>
                <div className="mt-1.5">
                  <Input
                    id="channel"
                    name="channel"
                    defaultValue={v('channel')}
                    placeholder="#general"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="username">Username</Label>
                <div className="mt-1.5">
                  <Input
                    id="username"
                    name="username"
                    defaultValue={v('username')}
                    placeholder="SabNode"
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-3">
                <div>
                  <div className="text-[13px] text-[var(--st-text)]">Active</div>
                  <div className="text-[12px] text-[var(--st-text-secondary)]">
                    Enable Slack notifications.
                  </div>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  aria-label="Slack active"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          </form>
        </IntegrationSection>

        {stats?.lastErrorMessage ? (
          <Card>
            <ZoruCardContent className="flex items-start gap-3 border-l-2 border-[var(--st-danger)]/40 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--st-danger)]" />
              <div>
                <p className="text-sm font-medium text-[var(--st-text)]">Last error</p>
                <p className="mt-0.5 text-xs text-[var(--st-text-secondary)] break-words">
                  {stats.lastErrorMessage}
                </p>
              </div>
            </ZoruCardContent>
          </Card>
        ) : null}

        <IntegrationActivityFeed
          title="Delivery & test history"
          description="Last 10 webhook events from this integration."
          events={events}
          emptyMessage="No deliveries yet — send a test message to verify the webhook."
        />
      </div>
    </EntityListShell>
  );
}
