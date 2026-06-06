'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import {
  AlertCircle,
  Bell,
  LoaderCircle,
  MousePointerClick,
  Send,
  Users,
} from 'lucide-react';

import {
  Button,
  Card,
  ZoruCardContent,
  Label,
  Skeleton,
  Switch,
  Textarea,
} from '@/components/sabcrm/20ui/compat';
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
  getPushNotificationSetting,
  savePushNotificationSetting,
  testIntegration,
  disconnectIntegration,
  getIntegrationEvents,
  getIntegrationStats,
  type IntegrationEvent,
  type IntegrationStats,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsPushNotificationSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsPushNotificationSetting & { _id: unknown }) | null;

function configValidJson(raw: string): { ok: boolean; projectId?: string } {
  if (!raw.trim()) return { ok: false };
  try {
    const parsed = JSON.parse(raw);
    return {
      ok: true,
      projectId:
        typeof parsed?.projectId === 'string' ? parsed.projectId : undefined,
    };
  } catch {
    return { ok: false };
  }
}

export default function PushNotificationsIntegrationPage() {
  const { reportResult } = useIntegrationToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [, startLoading] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    savePushNotificationSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [d, ev, st] = await Promise.all([
        getPushNotificationSetting() as Promise<Doc>,
        getIntegrationEvents('push-notifications', 10),
        getIntegrationStats('push-notifications'),
      ]);
      setDoc(d);
      setEnabled(Boolean(d?.is_enabled));
      setEvents(ev);
      setStats(st);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      reportResult('push-notifications', saveState);
      refresh();
    } else if (saveState?.error) {
      reportResult('push-notifications', saveState);
    }
  }, [saveState, reportResult, refresh]);

  const docId = doc && (doc as any)._id ? String((doc as any)._id) : '';
  const firebaseConfigStr = doc?.firebase_config
    ? typeof doc.firebase_config === 'string'
      ? String(doc.firebase_config)
      : JSON.stringify(doc.firebase_config, null, 2)
    : '';

  const parsed = useMemo(
    () => configValidJson(firebaseConfigStr),
    [firebaseConfigStr],
  );

  const isConfigured = parsed.ok;
  const state: ConnectionState = isConfigured
    ? enabled
      ? stats?.lastErrorMessage
        ? 'error'
        : 'connected'
      : 'disconnected'
    : 'disconnected';

  // Subscribers count is derived from the most recent successful "subscribers"
  // event (when emitted) — falls back to deliveriesThisMonth as a soft proxy.
  const subscribers = useMemo(() => {
    const sub = events.find(
      (e) => e.kind === 'subscribers' && e.status === 'success',
    );
    if (sub?.count != null) return sub.count;
    return stats?.deliveriesThisMonth ?? 0;
  }, [events, stats]);

  // Click-through rate proxy — successful "click" events / "delivery" events.
  const clickRatePct = useMemo(() => {
    const clicks = events
      .filter((e) => e.kind === 'click' && e.status === 'success')
      .reduce((n, e) => n + (e.count ?? 1), 0);
    const sent = stats?.deliveriesToday ?? 0;
    if (sent === 0) return 0;
    return Math.min(100, Math.round((clicks / sent) * 1000) / 10);
  }, [events, stats]);

  const lastDelivery = events.find(
    (e) =>
      e.status === 'success' && (e.kind === 'delivery' || e.kind === 'test'),
  );
  const lastDeliveryLabel = lastDelivery
    ? new Date(lastDelivery.createdAt).toLocaleString()
    : 'Never';

  const onTest = () => {
    startTesting(async () => {
      const res = await testIntegration('push-notifications');
      reportResult('push-notifications', res);
      refresh();
    });
  };

  const onDisconnect = () => {
    startDisconnect(async () => {
      const res = await disconnectIntegration('push-notifications');
      reportResult('push-notifications', res);
      setEnabled(false);
      refresh();
    });
  };

  return (
    <EntityListShell
      title="Push Notifications"
      subtitle="Firebase Cloud Messaging configuration."
    >
      <div className="space-y-4">
        <ConnectionHeader
          name="Push Notifications"
          description="Realtime push delivery via Firebase Cloud Messaging."
          icon={Bell}
          state={state}
          connectedAs={
            parsed.projectId
              ? `Firebase project ${parsed.projectId}`
              : isConfigured
                ? 'Firebase config present'
                : null
          }
          connectedAt={(doc as any)?.updatedAt || (doc as any)?.createdAt || null}
          scopes={isConfigured ? ['fcm.send'] : []}
          onTest={isConfigured ? onTest : undefined}
          isTesting={isTesting}
          onDisconnect={onDisconnect}
          isDisconnecting={isDisconnecting}
        />

        <IntegrationKpiGrid
          kpis={[
            {
              label: 'Subscribers',
              value: subscribers,
              period: 'Active device tokens',
              icon: <Users />,
            },
            {
              label: 'Sent today',
              value: stats?.deliveriesToday ?? 0,
              period: `${stats?.deliveriesThisMonth ?? 0} this month`,
              icon: <Send />,
            },
            {
              label: 'Click rate',
              value: `${clickRatePct}%`,
              period: 'Click / delivery (today)',
              icon: <MousePointerClick />,
              delta: clickRatePct,
            },
            {
              label: 'Last delivery',
              value: lastDeliveryLabel,
              period: stats?.failuresToday
                ? `${stats.failuresToday} failed today`
                : 'Healthy',
              icon: <Bell />,
              invertDelta: true,
              delta: stats?.failuresToday ?? 0,
            },
          ]}
        />

        <IntegrationSection
          title="Firebase configuration"
          description="Paste the Firebase web-app config JSON. Used to push notifications to subscribed devices."
        >
          {!doc && !docId ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : null}

          <form action={saveFormAction} className="space-y-4">
            {docId ? <input type="hidden" name="_id" value={docId} /> : null}
            <input
              type="hidden"
              name="is_enabled"
              value={enabled ? 'true' : 'false'}
            />

            <div className="flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
              <div>
                <div className="text-[13px] text-zoru-ink">
                  Push notifications enabled
                </div>
                <div className="text-[12px] text-zoru-ink-muted">
                  Deliver realtime notifications via FCM.
                </div>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                aria-label="Push notifications enabled"
              />
            </div>

            <div>
              <Label htmlFor="firebase_config">
                Firebase config (JSON)
              </Label>
              <div className="mt-1.5">
                <Textarea
                  id="firebase_config"
                  name="firebase_config"
                  rows={10}
                  defaultValue={firebaseConfigStr}
                  placeholder='{"apiKey":"...","projectId":"..."}'
                  className="font-mono text-[12.5px]"
                />
              </div>
              {firebaseConfigStr && !parsed.ok ? (
                <p className="mt-1.5 text-xs text-zoru-danger">
                  Config is not valid JSON.
                </p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : null}
                Save changes
              </Button>
            </div>
          </form>
        </IntegrationSection>

        {stats?.lastErrorMessage ? (
          <Card>
            <ZoruCardContent className="flex items-start gap-3 border-l-2 border-zoru-danger/40 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 text-zoru-danger" />
              <div>
                <p className="text-sm font-medium text-zoru-ink">
                  Last delivery error
                </p>
                <p className="mt-0.5 text-xs text-zoru-ink-muted break-words">
                  {stats.lastErrorMessage}
                </p>
              </div>
            </ZoruCardContent>
          </Card>
        ) : null}

        <IntegrationActivityFeed
          title="Delivery log"
          description="Push deliveries, test sends and FCM responses."
          events={events}
          emptyMessage="No push deliveries yet."
        />
      </div>
    </EntityListShell>
  );
}
