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
  KeyRound,
  LoaderCircle,
  LogIn,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  Input,
  Label,
  Skeleton,
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
  getSocialAuthSetting,
  saveSocialAuthSetting,
  testIntegration,
  disconnectIntegration,
  getIntegrationEvents,
  getIntegrationStats,
  type IntegrationEvent,
  type IntegrationStats,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsSocialAuthSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsSocialAuthSetting & { _id: unknown }) | null;

const PROVIDERS: Array<{
  title: string;
  idKey: keyof WsSocialAuthSetting;
  secretKey: keyof WsSocialAuthSetting;
  idLabel: string;
  secretLabel: string;
}> = [
  {
    title: 'Google',
    idKey: 'google_client_id',
    secretKey: 'google_client_secret',
    idLabel: 'Client ID',
    secretLabel: 'Client Secret',
  },
  {
    title: 'Facebook',
    idKey: 'facebook_app_id',
    secretKey: 'facebook_app_secret',
    idLabel: 'App ID',
    secretLabel: 'App Secret',
  },
  {
    title: 'LinkedIn',
    idKey: 'linkedin_client_id',
    secretKey: 'linkedin_client_secret',
    idLabel: 'Client ID',
    secretLabel: 'Client Secret',
  },
  {
    title: 'Twitter',
    idKey: 'twitter_api_key',
    secretKey: 'twitter_api_secret',
    idLabel: 'API Key',
    secretLabel: 'API Secret',
  },
  {
    title: 'Microsoft',
    idKey: 'microsoft_client_id',
    secretKey: 'microsoft_client_secret',
    idLabel: 'Client ID',
    secretLabel: 'Client Secret',
  },
];

export default function SocialAuthIntegrationPage() {
  const { reportResult } = useIntegrationToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [, startLoading] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveSocialAuthSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [d, ev, st] = await Promise.all([
        getSocialAuthSetting() as Promise<Doc>,
        getIntegrationEvents('social-auth', 10),
        getIntegrationStats('social-auth'),
      ]);
      setDoc(d);
      setEvents(ev);
      setStats(st);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      reportResult('social-auth', saveState);
      refresh();
    } else if (saveState?.error) {
      reportResult('social-auth', saveState);
    }
  }, [saveState, reportResult, refresh]);

  const v = (k: keyof WsSocialAuthSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const docId = doc && (doc as any)._id ? String((doc as any)._id) : '';

  const enabledProviders = useMemo(() => {
    if (!doc) return [] as string[];
    return PROVIDERS.filter((p) => Boolean((doc as any)[p.idKey])).map(
      (p) => p.title,
    );
  }, [doc]);

  const ssoEnabledPct = useMemo(
    () =>
      PROVIDERS.length > 0
        ? Math.round((enabledProviders.length / PROVIDERS.length) * 100)
        : 0,
    [enabledProviders.length],
  );

  const state: ConnectionState = enabledProviders.length > 0
    ? stats?.lastErrorMessage
      ? 'error'
      : 'connected'
    : 'disconnected';

  const onTest = () => {
    startTesting(async () => {
      const res = await testIntegration('social-auth');
      reportResult('social-auth', res);
      refresh();
    });
  };

  const onDisconnect = () => {
    startDisconnect(async () => {
      const res = await disconnectIntegration('social-auth');
      reportResult('social-auth', res);
      refresh();
    });
  };

  return (
    <EntityListShell
      title="Social Auth"
      subtitle="OAuth credentials for social sign-in providers."
    >
      <div className="space-y-4">
        <ConnectionHeader
          name="Social Auth"
          description="Enable sign-in with Google, Facebook, LinkedIn, Twitter and Microsoft."
          icon={KeyRound}
          state={state}
          connectedAs={
            enabledProviders.length
              ? `${enabledProviders.length} provider${enabledProviders.length === 1 ? '' : 's'} live`
              : null
          }
          connectedAt={(doc as any)?.updatedAt || (doc as any)?.createdAt || null}
          scopes={enabledProviders}
          onTest={enabledProviders.length ? onTest : undefined}
          isTesting={isTesting}
          onDisconnect={onDisconnect}
          isDisconnecting={isDisconnecting}
        />

        <IntegrationKpiGrid
          kpis={[
            {
              label: 'Enabled providers',
              value: `${enabledProviders.length} / ${PROVIDERS.length}`,
              period: enabledProviders.length
                ? enabledProviders.join(', ')
                : 'None configured',
              icon: <ShieldCheck />,
            },
            {
              label: 'Sign-ups today',
              value: stats?.deliveriesToday ?? 0,
              period: `${stats?.deliveriesThisMonth ?? 0} this month`,
              icon: <UserPlus />,
            },
            {
              label: 'SSO coverage',
              value: `${ssoEnabledPct}%`,
              period:
                ssoEnabledPct === 100
                  ? 'All providers active'
                  : `${PROVIDERS.length - enabledProviders.length} remaining`,
              icon: <LogIn />,
              delta: ssoEnabledPct,
            },
            {
              label: 'Last auth error',
              value: stats?.failuresToday ?? 0,
              period: stats?.lastErrorMessage
                ? 'See last-error card'
                : 'No recent errors',
              icon: <AlertCircle />,
              invertDelta: true,
              delta: stats?.failuresToday ?? 0,
            },
          ]}
        />

        <IntegrationSection
          title="Provider credentials"
          description="OAuth credentials per social provider. Leave a row blank to disable that provider."
        >
          {!doc && !docId ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          <form action={saveFormAction} className="space-y-6">
            {docId ? <input type="hidden" name="_id" value={docId} /> : null}

            {PROVIDERS.map((p) => {
              const on = Boolean(v(p.idKey));
              return (
                <div key={p.title} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-medium text-zoru-ink">
                      {p.title}
                    </h3>
                    <Badge
                      variant={on ? 'success' : 'ghost'}
                      className="font-normal"
                    >
                      {on ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor={String(p.idKey)}>
                        {p.idLabel}
                      </Label>
                      <div className="mt-1.5">
                        <Input
                          id={String(p.idKey)}
                          name={String(p.idKey)}
                          defaultValue={v(p.idKey)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={String(p.secretKey)}>
                        {p.secretLabel}
                      </Label>
                      <div className="mt-1.5">
                        <Input
                          id={String(p.secretKey)}
                          name={String(p.secretKey)}
                          type="password"
                          defaultValue={v(p.secretKey)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

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
                  Last auth error
                </p>
                <p className="mt-0.5 text-xs text-zoru-ink-muted break-words">
                  {stats.lastErrorMessage}
                </p>
              </div>
            </ZoruCardContent>
          </Card>
        ) : null}

        <IntegrationActivityFeed
          title="Sign-in activity"
          description="OAuth handshakes, token refreshes and sign-up events."
          events={events}
          emptyMessage="No sign-in events yet."
        />
      </div>
    </EntityListShell>
  );
}
