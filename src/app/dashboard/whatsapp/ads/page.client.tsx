'use client';

import { fmtINR } from "@/lib/utils";
import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  EmptyState,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  StatCard,
  cn,
  zoruSonnerToast,
} from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  ChevronDown,
  DollarSign,
  ExternalLink,
  Eye,
  Megaphone,
  MessagesSquare,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Target,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getAdAccounts,
  getInsights,
  listCampaigns,
  updateEntityStatus,
  } from '@/app/actions/ad-manager.actions';

/**
 * Wachat → WhatsApp Ads.
 *
 * Click-to-WhatsApp workspace. Wraps the Meta Marketing API surface
 * (`@/app/actions/ad-manager.actions`) and shows a CTW-focused
 * dashboard: ad-account selector, last-30d KPIs, campaign list with
 * pause/resume, and shortcuts into the full Ad Manager. Heavy
 * creation flows route to `/dashboard/ad-manager/create` with a
 * destination/objective preset.
 */

import * as React from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'wachat:whatsapp-ads:adAccountId';
// Heuristic: the objectives that can carry a click-to-WhatsApp adset
// (destination_type=WHATSAPP lives on the ad-set, not the campaign).
const CTW_OBJECTIVES = new Set([
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_LEADS',
  'OUTCOME_AWARENESS',
  'OUTCOME_TRAFFIC',
  'MESSAGES',
  'LEAD_GENERATION',
]);

const CTW_ACTION_TYPES = new Set([
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'onsite_conversion.total_messaging_connection',
  'messaging_conversation_started_7d',
  'whatsapp_message',
  'whatsapp_message_received',
]);

type AdAccount = {
  id: string;
  account_id?: string;
  name?: string;
  currency?: string;
  account_status?: number;
};

type Campaign = {
  id: string;
  name: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string | number;
  created_time?: string;
  updated_time?: string;
};

type InsightRow = {
  campaign_id?: string;
  campaign_name?: string;
  impressions?: string;
  spend?: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  cpc?: string;
  actions?: Array<{ action_type: string; value: string }>;
};

function toNum(v: string | number | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(v: string | number | undefined, currency = 'USD'): string {
  const n = toNum(v);
  try {
    return fmtINR(n, "INR");
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function fmtNum(v: string | number | undefined): string {
  const n = toNum(v);
  return fmtINR(Math.round(n), "INR");
}

function fmtPct(v: string | number | undefined): string {
  const n = toNum(v);
  return `${n.toFixed(2)}%`;
}

// Meta returns budgets in the account currency's minor units.
function budgetMajor(daily: string | number | undefined): number {
  return toNum(daily) / 100;
}

function countCtwMessages(rows: InsightRow[] | undefined): number {
  if (!rows) return 0;
  let total = 0;
  for (const r of rows) {
    for (const a of r.actions || []) {
      if (
        CTW_ACTION_TYPES.has(a.action_type) ||
        a.action_type?.toLowerCase?.().includes('whatsapp')
      ) {
        total += toNum(a.value);
      }
    }
  }
  return total;
}

export default function WhatsAppAdsPage(): React.ReactElement {
  const router = useRouter();
  const { activeProject } = useProject();

  const [accounts, setAccounts] = React.useState<AdAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = React.useState(true);
  const [accountsError, setAccountsError] = React.useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);

  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [insightsMap, setInsightsMap] = React.useState<Record<string, InsightRow>>({});
  const [accountInsight, setAccountInsight] = React.useState<InsightRow | null>(null);
  const [dataLoading, setDataLoading] = React.useState(false);
  const [pendingTogglesId, setPendingTogglesId] = React.useState<string | null>(null);

  // Restore last-used ad-account selection before fetch.
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setSelectedAccountId(saved);
    } catch {
      // localStorage may be unavailable in private mode — silently skip.
    }
  }, []);

  // Load ad accounts once.
  React.useEffect(() => {
    let active = true;
    setAccountsLoading(true);
    getAdAccounts()
      .then((res) => {
        if (!active) return;
        if (res.error) setAccountsError(res.error);
        const list = (res.accounts || []) as AdAccount[];
        setAccounts(list);
        setSelectedAccountId((prev) => {
          if (prev && list.some((a) => a.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      })
      .catch((e) => {
        if (active) setAccountsError(e instanceof Error ? e.message : 'Failed to load ad accounts');
      })
      .finally(() => {
        if (active) setAccountsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeAccount = React.useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );
  const currency = activeAccount?.currency || 'USD';

  const loadData = React.useCallback(() => {
    if (!selectedAccountId) return;
    let active = true;
    setDataLoading(true);
    Promise.all([
      listCampaigns(selectedAccountId, { limit: 200 }),
      getInsights(selectedAccountId, {
        level: 'campaign',
        date_preset: 'last_30d',
        fields: [
          'campaign_id',
          'campaign_name',
          'spend',
          'impressions',
          'clicks',
          'ctr',
          'cpm',
          'cpc',
          'actions',
        ],
        limit: 200,
      }),
      getInsights(selectedAccountId, {
        level: 'account',
        date_preset: 'last_30d',
        fields: ['spend', 'impressions', 'clicks', 'ctr', 'cpm', 'cpc', 'actions'],
      }),
    ])
      .then(([camps, ins, acct]) => {
        if (!active) return;
        const all = (camps.data || []) as Campaign[];
        const filtered = all.filter((c) => !c.objective || CTW_OBJECTIVES.has(c.objective));
        setCampaigns(filtered);

        const map: Record<string, InsightRow> = {};
        for (const row of (ins.data || []) as InsightRow[]) {
          if (row.campaign_id) map[row.campaign_id] = row;
        }
        setInsightsMap(map);
        const acctRow = ((acct.data || []) as InsightRow[])[0] ?? null;
        setAccountInsight(acctRow);
      })
      .finally(() => {
        if (active) setDataLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedAccountId]);

  React.useEffect(() => {
    if (!selectedAccountId) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, selectedAccountId);
    } catch {
      /* ignore */
    }
    loadData();
  }, [selectedAccountId, loadData]);

  const handleStatusToggle = React.useCallback(
    async (campaign: Campaign) => {
      const next: 'ACTIVE' | 'PAUSED' =
        campaign.effective_status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      setPendingTogglesId(campaign.id);
      try {
        const res = await updateEntityStatus(campaign.id, 'campaign', next);
        if (res.error) {
          zoruSonnerToast.error(
            `Couldn't ${next === 'PAUSED' ? 'pause' : 'resume'} "${campaign.name}": ${res.error}`,
          );
        } else {
          zoruSonnerToast.success(
            `${campaign.name} ${next === 'PAUSED' ? 'paused' : 'activated'}`,
          );
          loadData();
        }
      } finally {
        setPendingTogglesId(null);
      }
    },
    [loadData],
  );

  // Aggregate KPIs from the campaigns visible on this page.
  const kpi = React.useMemo(() => {
    const rows = campaigns.map((c) => insightsMap[c.id]).filter(Boolean) as InsightRow[];
    const spend = rows.reduce((s, r) => s + toNum(r.spend), 0);
    const impressions = rows.reduce((s, r) => s + toNum(r.impressions), 0);
    const clicks = rows.reduce((s, r) => s + toNum(r.clicks), 0);
    const msgs = countCtwMessages(rows);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    return { spend, impressions, clicks, ctr, cpc, msgs };
  }, [campaigns, insightsMap]);

  const accountKpi = React.useMemo(() => {
    if (!accountInsight) return null;
    return {
      spend: toNum(accountInsight.spend),
      impressions: toNum(accountInsight.impressions),
      clicks: toNum(accountInsight.clicks),
      msgs: countCtwMessages([accountInsight]),
    };
  }, [accountInsight]);

  const breadcrumbs = (
    <Breadcrumb>
      <ZoruBreadcrumbList>
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />

        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbPage>WhatsApp Ads</ZoruBreadcrumbPage>
        </ZoruBreadcrumbItem>
      </ZoruBreadcrumbList>
    </Breadcrumb>
  );

  // Empty/setup states.
  if (accountsLoading) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[118px]" />
          ))}
        </div>
        <Skeleton className="h-[260px]" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <EmptyState
          icon={<Megaphone className="h-10 w-10" />}
          title="Connect an ad account to launch click-to-WhatsApp campaigns"
          description={
            accountsError
              ? `We couldn't load your ad accounts: ${accountsError}`
              : "Click-to-WhatsApp ads send a tap on Facebook or Instagram straight into your WhatsApp inbox. You'll need a funded Meta ad account linked to this workspace."
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => router.push('/dashboard/ad-manager/ad-accounts')}>
                <Plus className="h-3.5 w-3.5" />
                Connect ad account
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/wachat/whatsapp-ads/setup')}
              >
                Setup guide
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push('/wachat/whatsapp-ads/roadmap')}
              >
                Roadmap
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-6">
      {breadcrumbs}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>WhatsApp Ads</ZoruPageTitle>
            <ZoruPageDescription>
              Click-to-WhatsApp campaigns across Facebook & Instagram
              {activeProject?.name ? ` · ${activeProject.name}` : ''}
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedAccountId ?? undefined}
            onValueChange={(v) => setSelectedAccountId(v)}
          >
            <ZoruSelectTrigger className="w-[240px]">
              <ZoruSelectValue placeholder="Pick an ad account" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {accounts.map((a) => (
                <ZoruSelectItem key={a.id} value={a.id}>
                  {a.name || `Ad Account ${a.account_id ?? a.id}`}
                  {a.currency ? ` · ${a.currency}` : ''}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData} disabled={dataLoading}>
            <RefreshCw className={cn('h-3.5 w-3.5', dataLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            onClick={() =>
              router.push(
                '/dashboard/ad-manager/create?destination=WHATSAPP&objective=OUTCOME_ENGAGEMENT',
              )
            }
          >
            <Plus className="h-3.5 w-3.5" />
            New CTW campaign
          </Button>
        </div>
      </div>

      {/* KPI strip — last 30 days, scoped to CTW-eligible campaigns */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Spend (30d)"
          value={fmtMoney(kpi.spend, currency)}
          icon={<DollarSign className="h-4 w-4" />}
          period={accountKpi ? `${fmtMoney(accountKpi.spend, currency)} account total` : undefined}
        />
        <StatCard
          label="Impressions"
          value={fmtNum(kpi.impressions)}
          icon={<Eye className="h-4 w-4" />}
          period={accountKpi ? `${fmtNum(accountKpi.impressions)} account total` : undefined}
        />
        <StatCard
          label="Link clicks"
          value={fmtNum(kpi.clicks)}
          icon={<MousePointerClick className="h-4 w-4" />}
          period={accountKpi ? `${fmtNum(accountKpi.clicks)} account total` : undefined}
        />
        <StatCard label="CTR" value={fmtPct(kpi.ctr)} icon={<Target className="h-4 w-4" />} />
        <StatCard
          label="Avg. CPC"
          value={fmtMoney(kpi.cpc, currency)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Chats started"
          value={fmtNum(kpi.msgs)}
          icon={<MessagesSquare className="h-4 w-4" />}
          period={accountKpi ? `${fmtNum(accountKpi.msgs)} account total` : undefined}
        />
      </div>

      {/* Campaigns list */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[22px] leading-none tracking-tight text-[var(--st-text)]">Campaigns</h2>
            <p className="mt-1.5 text-[12.5px] text-[var(--st-text-secondary)]">
              {dataLoading && campaigns.length === 0
                ? 'Loading…'
                : `${campaigns.length} CTW-eligible campaign${campaigns.length === 1 ? '' : 's'} · last 30 days insights`}
            </p>
          </div>
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                More
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuLabel>Manage</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem
                onSelect={() => router.push('/dashboard/ad-manager/campaigns')}
              >
                All campaigns
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem
                onSelect={() => router.push('/dashboard/ad-manager/insights')}
              >
                Open Insights
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem
                onSelect={() => router.push('/dashboard/ad-manager/audiences')}
              >
                Audiences
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem
                onSelect={() => router.push('/dashboard/ad-manager/creative-library')}
              >
                Creative library
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem onSelect={() => router.push('/wachat/whatsapp-ads/roadmap')}>
                Roadmap
              </ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
          </DropdownMenu>
        </div>

        <Card className="mt-5">
          {dataLoading && campaigns.length === 0 ? (
            <div className="flex flex-col gap-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<MessagesSquare className="h-10 w-10" />}
                title="No CTW campaigns yet"
                description="Launch your first click-to-WhatsApp campaign and start collecting inbound conversations."
                action={
                  <Button
                    onClick={() =>
                      router.push(
                        '/dashboard/ad-manager/create?destination=WHATSAPP&objective=OUTCOME_ENGAGEMENT',
                      )
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create campaign
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--st-border)]">
              {campaigns.map((c) => (
                <CampaignRow
                  key={c.id}
                  campaign={c}
                  insight={insightsMap[c.id]}
                  currency={currency}
                  toggling={pendingTogglesId === c.id}
                  onToggle={handleStatusToggle}
                  onOpen={() => router.push(`/dashboard/ad-manager/campaigns/${c.id}`)}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Cross-link to full Ad Manager */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <ExternalLink className="h-4 w-4 text-[var(--st-text-secondary)]" />
          <div>
            <div className="text-sm text-[var(--st-text)]">Full Ad Manager</div>
            <div className="text-[11.5px] text-[var(--st-text-secondary)]">
              Audiences, creatives, A/B tests, and detailed insights live in the unified Ad Manager.
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/ad-manager')}>
          Open Ad Manager
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      </Card>
    </div>
  );
}

function CampaignRow({
  campaign,
  insight,
  currency,
  toggling,
  onToggle,
  onOpen,
}: {
  campaign: Campaign;
  insight: InsightRow | undefined;
  currency: string;
  toggling: boolean;
  onToggle: (c: Campaign) => void;
  onOpen: () => void;
}): React.ReactElement {
  const isActive = campaign.effective_status === 'ACTIVE';
  const status = campaign.effective_status || campaign.status || 'UNKNOWN';
  const badgeVariant: 'success' | 'warning' | 'danger' | 'secondary' = isActive
    ? 'success'
    : status === 'PAUSED'
      ? 'warning'
      : status.includes('DISAPPROVED') || status.includes('ARCHIVED') || status.includes('DELETED')
        ? 'danger'
        : 'secondary';

  return (
    <div className="flex flex-wrap items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <Link
          href={`/dashboard/ad-manager/campaigns/${campaign.id}`}
          className="block truncate text-sm font-medium text-[var(--st-text)] hover:underline"
        >
          {campaign.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--st-text-secondary)]">
          <Badge variant={badgeVariant}>{status}</Badge>
          {campaign.objective && <span>{campaign.objective.replace(/^OUTCOME_/, '')}</span>}
          {campaign.daily_budget !== undefined && campaign.daily_budget !== null && (
            <span>{fmtMoney(budgetMajor(campaign.daily_budget), currency)}/day</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-x-6 text-right text-[12px] sm:grid-cols-4">
        <Metric label="Spend" value={fmtMoney(insight?.spend, currency)} />
        <Metric label="Clicks" value={fmtNum(insight?.clicks)} />
        <Metric label="CTR" value={fmtPct(insight?.ctr)} />
        <Metric
          label="CPC"
          value={fmtMoney(insight?.cpc, currency)}
          className="hidden sm:flex"
        />
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={isActive ? 'Pause campaign' : 'Resume campaign'}
          onClick={() => onToggle(campaign)}
          disabled={toggling}
        >
          {isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Open campaign" onClick={onOpen}>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn('flex flex-col items-end', className)}>
      <span className="text-[11px] text-[var(--st-text-secondary)]">{label}</span>
      <span className="text-[12.5px] tabular-nums text-[var(--st-text)]">{value}</span>
    </div>
  );
}
