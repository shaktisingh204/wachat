'use client';

import * as React from 'react';
import Link from 'next/link';
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
  ArrowUpRight,
  LoaderCircle,
  Megaphone,
  Target,
  TrendingUp,
  Users,
  Workflow,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Switch,
} from '@/components/zoruui';
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
  getFacebookAdsSetting,
  saveFacebookAdsSetting,
  testIntegration,
  disconnectIntegration,
  getIntegrationEvents,
  getIntegrationStats,
  type IntegrationEvent,
  type IntegrationStats,
} from '@/app/actions/worksuite/integrations.actions';
import { getAdAccounts } from '@/app/actions/ad-manager.actions';
import type { WsFacebookAdsSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsFacebookAdsSetting & { _id: unknown }) | null;
type AdAccount = {
  id?: string;
  account_id?: string;
  name?: string;
  currency?: string;
};

export default function FacebookAdsIntegrationPage() {
  const { reportResult } = useIntegrationToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [accounts, setAccounts] = useState<AdAccount[] | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [adAccountId, setAdAccountId] = useState<string>('');
  const [adAccountName, setAdAccountName] = useState<string>('');
  const [isActive, setIsActive] = useState(false);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [, startLoading] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveFacebookAdsSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );
  const [mounted, setMounted] = useState(false);
  const refresh = useCallback(() => {
    startLoading(async () => {
      const [d, ev, st, accs] = await Promise.all([
        getFacebookAdsSetting() as Promise<Doc>,
        getIntegrationEvents('facebook-ads', 10),
        getIntegrationStats('facebook-ads'),
        getAdAccounts(),
      ]);
      setDoc(d);
      setIsActive(Boolean(d?.is_active));
      setAdAccountId(d?.ad_account_id || '');
      setAdAccountName(d?.ad_account_name || '');
      setEvents(ev);
      setStats(st);
      setAccounts(accs.accounts ?? []);
      if (accs.error) setAccountsError(accs.error);
    });
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      reportResult('facebook-ads', saveState);
      refresh();
    } else if (saveState?.error) {
      reportResult('facebook-ads', saveState);
    }
  }, [saveState, reportResult, refresh]);

  const v = (k: keyof WsFacebookAdsSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const docId = doc && (doc as any)._id ? String((doc as any)._id) : '';

  const isConfigured = Boolean(adAccountId);
  const state: ConnectionState = isConfigured
    ? isActive
      ? stats?.lastErrorMessage
        ? 'error'
        : 'connected'
      : 'disconnected'
    : 'disconnected';

  // KPIs:
  //  · connected ad accounts (1 if configured, else 0)
  //  · ads running — from latest `ads-running` event count
  //  · leads imported today — successful `lead-import` events today
  //  · last sync error rate — from stats.errorRate30d
  const adsRunning = useMemo(() => {
    const evt = events.find(
      (e) => e.kind === 'ads-running' && e.status === 'success',
    );
    return evt?.count ?? 0;
  }, [events]);

  const leadsToday = useMemo(() => {
    return events
      .filter((e) => {
        if (e.status !== 'success') return false;
        if (e.kind !== 'lead-import' && e.kind !== 'delivery') return false;
        const t = new Date(e.createdAt).getTime();
        if (!Number.isFinite(t)) return false;
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        return t >= start.getTime();
      })
      .reduce((n, e) => n + (e.count ?? 1), 0);
  }, [events]);

  const errorRatePct = useMemo(
    () => (stats ? Math.round(stats.errorRate30d * 1000) / 10 : 0),
    [stats],
  );

  const onTest = () => {
    startTesting(async () => {
      const res = await testIntegration('facebook-ads');
      reportResult('facebook-ads', res);
      refresh();
    });
  };

  const onDisconnect = () => {
    startDisconnect(async () => {
      const res = await disconnectIntegration('facebook-ads');
      reportResult('facebook-ads', res);
      setIsActive(false);
      refresh();
    });
  };

  if (!mounted) {
    return (
      <div className="flex h-60 items-center justify-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-zoru-ink-muted" />
      </div>
    );
  }

  return (
    <EntityListShell
      title="Facebook ads"
      subtitle="Sync Meta lead-form submissions into the CRM pipeline."
    >
      <div className="space-y-4">
        <ConnectionHeader
          name="Facebook Ads"
          description="Pipe Meta lead-form submissions straight into CRM as new leads."
          icon={Megaphone}
          state={state}
          connectedAs={
            adAccountId
              ? `${adAccountName || 'Ad account'} (${adAccountId})`
              : null
          }
          connectedAt={(doc as any)?.updatedAt || (doc as any)?.createdAt || null}
          scopes={doc?.lead_form_ids ? ['leads_retrieval'] : ['ads_read']}
          onTest={isConfigured ? onTest : undefined}
          isTesting={isTesting}
          onDisconnect={onDisconnect}
          isDisconnecting={isDisconnecting}
        />

        <IntegrationKpiGrid
          kpis={[
            {
              label: 'Connected ad accounts',
              value: isConfigured ? 1 : 0,
              period: isConfigured ? adAccountName || adAccountId : 'None',
              icon: <Users />,
            },
            {
              label: 'Ads running',
              value: adsRunning,
              period: 'From last `ads-running` event',
              icon: <Target />,
            },
            {
              label: 'Leads imported today',
              value: leadsToday,
              period: `${stats?.deliveriesThisMonth ?? 0} this month`,
              icon: <Workflow />,
            },
            {
              label: 'Error rate (30d)',
              value: `${errorRatePct}%`,
              period: stats?.failuresToday
                ? `${stats.failuresToday} failed today`
                : 'No recent errors',
              icon: <TrendingUp />,
              invertDelta: true,
              delta: errorRatePct,
            },
          ]}
        />

        <IntegrationSection
          title="Ad account & routing"
          description="Pick the Meta ad account whose lead forms feed the CRM, then choose where new leads land."
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/ad-manager">
                Open Ad Manager
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        >
          {!doc && !docId ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          <form action={saveFormAction} className="space-y-4">
            {docId ? <input type="hidden" name="_id" value={docId} /> : null}
            <input
              type="hidden"
              name="is_active"
              value={isActive ? 'true' : 'false'}
            />
            <input type="hidden" name="ad_account_id" value={adAccountId} />
            <input type="hidden" name="ad_account_name" value={adAccountName} />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="ad_account_select">Ad account</Label>
                <div className="mt-1.5">
                  {accounts === null ? (
                    <Skeleton className="h-10 w-full" />
                  ) : accounts.length === 0 ? (
                    <div className="rounded-lg border border-zoru-line bg-zoru-bg p-3 text-xs text-zoru-ink-muted">
                      No ad accounts found.{' '}
                      <Link
                        href="/dashboard/ad-manager/ad-accounts"
                        className="underline"
                      >
                        Connect a Meta ad account
                      </Link>{' '}
                      first.
                      {accountsError ? (
                        <span className="block mt-1 text-zoru-danger">
                          {accountsError}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <Select
                      value={adAccountId}
                      onValueChange={(val) => {
                        setAdAccountId(val);
                        const match = accounts.find(
                          (a) => a.id === val || a.account_id === val,
                        );
                        setAdAccountName(match?.name ?? '');
                      }}
                    >
                      <ZoruSelectTrigger id="ad_account_select">
                        <ZoruSelectValue placeholder="Pick an ad account" />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        {accounts.map((a) => {
                          const id = a.id ?? a.account_id ?? '';
                          return (
                            <ZoruSelectItem key={id} value={id}>
                              {a.name ?? a.account_id ?? id}
                            </ZoruSelectItem>
                          );
                        })}
                      </ZoruSelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="lead_form_ids">Lead form IDs</Label>
                <div className="mt-1.5">
                  <Input
                    id="lead_form_ids"
                    name="lead_form_ids"
                    defaultValue={v('lead_form_ids')}
                    placeholder="123456,789012  (leave blank for all)"
                  />
                </div>
                <p className="mt-1 text-xs text-zoru-ink-muted">
                  Comma-separated. Leave blank to ingest all lead forms on the
                  ad account.
                </p>
              </div>

              <div>
                <Label htmlFor="default_pipeline">
                  Default pipeline
                </Label>
                <div className="mt-1.5">
                  <Input
                    id="default_pipeline"
                    name="default_pipeline"
                    defaultValue={v('default_pipeline')}
                    placeholder="Inbound sales"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="default_stage">Default stage</Label>
                <div className="mt-1.5">
                  <Input
                    id="default_stage"
                    name="default_stage"
                    defaultValue={v('default_stage')}
                    placeholder="New"
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
                <div>
                  <div className="text-[13px] text-zoru-ink">Active</div>
                  <div className="text-[12px] text-zoru-ink-muted">
                    Ingest Meta lead-form submissions in real time.
                  </div>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  aria-label="Facebook ads active"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <Badge variant="secondary" className="font-normal">
                {adAccountId
                  ? `Account ${adAccountName || adAccountId}`
                  : 'No account selected'}
              </Badge>
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
                  Last sync error
                </p>
                <p className="mt-0.5 text-xs text-zoru-ink-muted break-words">
                  {stats.lastErrorMessage}
                </p>
              </div>
            </ZoruCardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <IntegrationSyncHistory events={events} />
          <IntegrationActivityFeed
            title="Lead-import log"
            description="Sync attempts, lead-form ingest results and webhook deliveries."
            events={events}
            emptyMessage="No lead-imports yet."
          />
        </div>
      </div>
    </EntityListShell>
  );
}
