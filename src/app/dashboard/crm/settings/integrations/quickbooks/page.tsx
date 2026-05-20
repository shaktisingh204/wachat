'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
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
  BookOpen,
  Database,
  LoaderCircle,
  Plug,
  RefreshCw,
  Receipt,
} from 'lucide-react';

import { EnumFormField } from '@/components/crm/enum-form-field';
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
  getQuickBooksSetting,
  saveQuickBooksSetting,
  disconnectIntegration,
  syncQuickBooks,
  testIntegration,
  getIntegrationEvents,
  getIntegrationStats,
  type IntegrationEvent,
  type IntegrationStats,
} from '@/app/actions/worksuite/integrations.actions';
import type {
  WsQuickBooksSetting,
  WsQuickBooksEnv,
} from '@/lib/worksuite/integrations-types';

type Doc = (WsQuickBooksSetting & { _id: unknown }) | null;

export default function QuickBooksIntegrationPage() {
  const { reportResult, toast } = useIntegrationToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [env, setEnv] = useState<WsQuickBooksEnv>('sandbox');
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [, startLoading] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [isSyncing, startSync] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveQuickBooksSetting,
    { message: '', error: '' } as { message?: string; error?: string; id?: string },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [d, ev, st] = await Promise.all([
        getQuickBooksSetting() as Promise<Doc>,
        getIntegrationEvents('quickbooks', 10),
        getIntegrationStats('quickbooks'),
      ]);
      setDoc(d);
      setEnv((d?.environment as WsQuickBooksEnv) || 'sandbox');
      setEvents(ev);
      setStats(st);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      reportResult('quickbooks', saveState);
      refresh();
    } else if (saveState?.error) {
      reportResult('quickbooks', saveState);
    }
  }, [saveState, reportResult, refresh]);

  const v = (k: keyof WsQuickBooksSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';
  const isConnected = Boolean(doc?.access_token && doc?.realm_id);
  const state: ConnectionState = isConnected ? 'connected' : 'disconnected';
  const lastSyncedAt = doc?.last_synced_at
    ? new Date(doc.last_synced_at as any).toLocaleString()
    : 'Never';

  const onDisconnect = () => {
    startDisconnect(async () => {
      const res = await disconnectIntegration('quickbooks');
      reportResult('quickbooks', res);
      refresh();
    });
  };

  const onSync = () => {
    startSync(async () => {
      const res = await syncQuickBooks();
      reportResult('quickbooks', res);
      refresh();
    });
  };

  const onTest = () => {
    startTesting(async () => {
      const res = await testIntegration('quickbooks');
      reportResult('quickbooks', res);
      refresh();
    });
  };

  const pendingErrors = events.filter((e) => e.status === 'failure').length;
  const syncCount = events.filter((e) => e.kind === 'sync' && e.status === 'success').length;

  return (
    <EntityListShell
      title="QuickBooks"
      subtitle="Sync invoices, customers and payments with QuickBooks Online."
    >
      <div className="space-y-4">
        <ConnectionHeader
          name="QuickBooks Online"
          description="Two-way sync for invoices, customers and items."
          icon={BookOpen}
          state={state}
          connectedAs={doc?.realm_id ? `Realm ${doc.realm_id}` : null}
          connectedAt={(doc as any)?.updatedAt || (doc as any)?.createdAt || null}
          scopes={isConnected ? [`${env}`, 'com.intuit.quickbooks.accounting'] : []}
          onTest={isConnected ? onTest : undefined}
          isTesting={isTesting}
          onDisconnect={onDisconnect}
          isDisconnecting={isDisconnecting}
          connectAction={
            <ZoruButton
              type="button"
              onClick={() =>
                toast({
                  title: 'QuickBooks',
                  description: 'OAuth connect is not wired yet (stub).',
                })
              }
            >
              <Plug className="h-4 w-4" />
              Connect
            </ZoruButton>
          }
        />

        <IntegrationKpiGrid
          kpis={[
            {
              label: 'Last sync',
              value: lastSyncedAt,
              period: isConnected ? `Environment: ${env}` : 'Not connected',
              icon: <RefreshCw />,
            },
            {
              label: 'Successful syncs',
              value: syncCount,
              period: `${stats?.deliveriesThisMonth ?? 0} ops this month`,
              icon: <Database />,
            },
            {
              label: 'Synced records (today)',
              value: stats?.deliveriesToday ?? 0,
              period: 'Invoices · Customers · Items',
              icon: <Receipt />,
            },
            {
              label: 'Pending sync errors',
              value: pendingErrors,
              period: pendingErrors > 0 ? 'Review activity log' : 'No issues',
              icon: <AlertCircle />,
              invertDelta: true,
              delta: pendingErrors,
            },
          ]}
        />

        <div className="flex flex-wrap justify-end gap-2">
          <ZoruButton
            type="button"
            variant="outline"
            onClick={onSync}
            disabled={isSyncing || !isConnected}
          >
            {isSyncing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync now
          </ZoruButton>
        </div>

        <IntegrationSection
          title="OAuth credentials"
          description="App credentials issued by Intuit Developer."
        >
          {!doc && !id ? (
            <div className="space-y-4">
              <ZoruSkeleton className="h-10 w-full" />
              <ZoruSkeleton className="h-10 w-full" />
            </div>
          ) : null}

          <form action={saveFormAction} className="space-y-4">
            {id ? <input type="hidden" name="_id" value={id} /> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <ZoruLabel htmlFor="client_id">Client ID</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput id="client_id" name="client_id" defaultValue={v('client_id')} />
                </div>
              </div>
              <div>
                <ZoruLabel htmlFor="client_secret">Client Secret</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput id="client_secret" name="client_secret" type="password" defaultValue={v('client_secret')} />
                </div>
              </div>

              <div className="md:col-span-2">
                <ZoruLabel htmlFor="redirect_uri">Redirect URI</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput
                    id="redirect_uri"
                    name="redirect_uri"
                    defaultValue={v('redirect_uri')}
                    placeholder="https://example.com/oauth/quickbooks/callback"
                  />
                </div>
              </div>

              <div>
                <ZoruLabel htmlFor="realm_id">Realm ID</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput id="realm_id" name="realm_id" defaultValue={v('realm_id')} />
                </div>
              </div>
              <div>
                <ZoruLabel htmlFor="environment">Environment</ZoruLabel>
                <div className="mt-1.5">
                  <EnumFormField
                    name="environment"
                    enumName="quickbooksEnvironment"
                    initialId={env}
                    onChange={(id) => setEnv((id ?? 'sandbox') as WsQuickBooksEnv)}
                    placeholder="Select environment"
                  />
                </div>
              </div>

              <div>
                <ZoruLabel htmlFor="access_token">Access Token</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput id="access_token" name="access_token" type="password" defaultValue={v('access_token')} />
                </div>
              </div>
              <div>
                <ZoruLabel htmlFor="refresh_token">Refresh Token</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput id="refresh_token" name="refresh_token" type="password" defaultValue={v('refresh_token')} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <ZoruButton type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save changes
              </ZoruButton>
            </div>
          </form>
        </IntegrationSection>

        {stats?.lastErrorMessage ? (
          <ZoruCard>
            <ZoruCardContent className="flex items-start gap-3 border-l-2 border-zoru-danger/40 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 text-zoru-danger" />
              <div>
                <p className="text-sm font-medium text-zoru-ink">Last sync error</p>
                <p className="mt-0.5 text-xs text-zoru-ink-muted break-words">
                  {stats.lastErrorMessage}
                </p>
              </div>
            </ZoruCardContent>
          </ZoruCard>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <IntegrationSyncHistory events={events} />
          <IntegrationActivityFeed
            title="Activity log"
            description="All QuickBooks events for this tenant."
            events={events}
          />
        </div>
      </div>
    </EntityListShell>
  );
}
