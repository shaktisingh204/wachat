'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  Input,
  Label,
  Skeleton,
  Switch,
} from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import {
  AlertCircle,
  LoaderCircle,
  MessageSquareDot,
  Radio,
  Signal,
  Zap,
} from 'lucide-react';

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
  getPusherSetting,
  savePusherSetting,
  testIntegration,
  disconnectIntegration,
  getIntegrationEvents,
  getIntegrationStats,
  type IntegrationEvent,
  type IntegrationStats,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsPusherSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsPusherSetting & { _id: unknown }) | null;

export default function PusherIntegrationPage() {
  const { reportResult } = useIntegrationToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [isActive, setIsActive] = useState(false);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [, startLoading] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    savePusherSetting,
    { message: '', error: '' } as { message?: string; error?: string; id?: string },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [d, ev, st] = await Promise.all([
        getPusherSetting() as Promise<Doc>,
        getIntegrationEvents('pusher', 10),
        getIntegrationStats('pusher'),
      ]);
      setDoc(d);
      setIsActive(Boolean(d?.is_active));
      setEvents(ev);
      setStats(st);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      reportResult('pusher', saveState);
      refresh();
    } else if (saveState?.error) {
      reportResult('pusher', saveState);
    }
  }, [saveState, reportResult, refresh]);

  const v = (k: keyof WsPusherSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';
  const isConfigured = Boolean(doc?.app_id && doc?.app_key && doc?.app_secret);
  const state: ConnectionState = isConfigured
    ? isActive
      ? 'connected'
      : 'disconnected'
    : 'disconnected';

  const onTest = () => {
    startTesting(async () => {
      const res = await testIntegration('pusher');
      reportResult('pusher', res);
      refresh();
    });
  };

  const onDisconnect = () => {
    startDisconnect(async () => {
      const res = await disconnectIntegration('pusher');
      reportResult('pusher', res);
      setIsActive(false);
      refresh();
    });
  };

  // Pusher doesn't expose channel counts from the singleton doc — surface the
  // configured cluster + activity-derived counts instead.
  const connectionLabel = isConfigured
    ? isActive
      ? 'Online'
      : 'Idle'
    : 'Not configured';

  return (
    <EntityListShell
      title="Pusher"
      subtitle="Realtime channels for live CRM updates."
    >
      <div className="space-y-4">
        <ConnectionHeader
          name="Pusher Channels"
          description="Realtime pub/sub for the in-app inbox and live indicators."
          icon={Radio}
          state={state}
          connectedAs={doc?.app_id ? `App ${doc.app_id}` : null}
          connectedAt={(doc as any)?.updatedAt || (doc as any)?.createdAt || null}
          scopes={doc?.cluster ? [`cluster:${doc.cluster}`] : []}
          onTest={isConfigured ? onTest : undefined}
          isTesting={isTesting}
          onDisconnect={onDisconnect}
          isDisconnecting={isDisconnecting}
        />

        <IntegrationKpiGrid
          kpis={[
            {
              label: 'Connection state',
              value: connectionLabel,
              period: doc?.cluster ? `Cluster ${doc.cluster}` : 'No cluster',
              icon: <Signal />,
            },
            {
              label: 'Active channels',
              value: isActive && isConfigured ? '—' : 0,
              period: 'Live count via Pusher API',
              icon: <Radio />,
            },
            {
              label: 'Messages today',
              value: stats?.deliveriesToday ?? 0,
              period: `${stats?.deliveriesThisMonth ?? 0} this month`,
              icon: <MessageSquareDot />,
            },
            {
              label: 'Failures today',
              value: stats?.failuresToday ?? 0,
              period: stats?.failuresToday
                ? 'Check activity log'
                : 'All deliveries OK',
              icon: <Zap />,
              invertDelta: true,
              delta: stats?.failuresToday ?? 0,
            },
          ]}
        />

        <IntegrationSection
          title="App credentials"
          description="App ID, key, secret and cluster from your Pusher dashboard."
        >
          {!doc && !id ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          <form action={saveFormAction} className="space-y-4">
            {id ? <input type="hidden" name="_id" value={id} /> : null}
            <input type="hidden" name="is_active" value={isActive ? 'true' : 'false'} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="app_id">App ID</Label>
                <div className="mt-1.5">
                  <Input id="app_id" name="app_id" defaultValue={v('app_id')} />
                </div>
              </div>
              <div>
                <Label htmlFor="cluster">Cluster</Label>
                <div className="mt-1.5">
                  <Input id="cluster" name="cluster" defaultValue={v('cluster')} placeholder="mt1" />
                </div>
              </div>
              <div>
                <Label htmlFor="app_key">App Key</Label>
                <div className="mt-1.5">
                  <Input id="app_key" name="app_key" defaultValue={v('app_key')} />
                </div>
              </div>
              <div>
                <Label htmlFor="app_secret">App Secret</Label>
                <div className="mt-1.5">
                  <Input id="app_secret" name="app_secret" type="password" defaultValue={v('app_secret')} />
                </div>
              </div>

              <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
                <div>
                  <div className="text-[13px] text-zoru-ink">Active</div>
                  <div className="text-[12px] text-zoru-ink-muted">
                    Enable Pusher realtime broadcasts.
                  </div>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Pusher active" />
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
            <ZoruCardContent className="flex items-start gap-3 border-l-2 border-zoru-danger/40 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 text-zoru-danger" />
              <div>
                <p className="text-sm font-medium text-zoru-ink">Last error</p>
                <p className="mt-0.5 text-xs text-zoru-ink-muted break-words">
                  {stats.lastErrorMessage}
                </p>
              </div>
            </ZoruCardContent>
          </Card>
        ) : null}

        <IntegrationActivityFeed
          title="Broadcast log"
          description="Test events and delivery attempts."
          events={events}
        />
      </div>
    </EntityListShell>
  );
}
