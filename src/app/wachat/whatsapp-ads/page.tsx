'use client';

import {
  Badge,
  Button,
  IconButton,
  Card,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  EmptyState,
  Select,
  Skeleton,
  StatCard,
  Alert,
  Modal,
  Field,
  Textarea,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { toast } from '@/hooks/use-toast';
import {
  useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  ChevronDown,
  DollarSign,
  ExternalLink,
  Eye,
  Loader2,
  Megaphone,
  MessagesSquare,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  AlertTriangle,
  } from 'lucide-react';
import { fmtINR } from '@/lib/utils';

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

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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

const ADS_BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'WhatsApp Ads' },
];

function toNum(v: string | number | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(v: string | number | undefined, currency = 'USD'): string {
  const n = toNum(v);
  return fmtINR(n, currency);
}

function fmtNum(v: string | number | undefined): string {
  const n = toNum(v);
  return new Intl.NumberFormat().format(Math.round(n));
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

function WhatsAppAdsPageContent(): React.ReactElement {
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
  const [dataError, setDataError] = React.useState<string | null>(null);
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
    setDataError(null);
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

        if (camps.error || ins.error || acct.error) {
          setDataError(camps.error || ins.error || acct.error || 'Failed to fetch Meta API data');
          return;
        }

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
      .catch((err) => {
        if (active) setDataError(err instanceof Error ? err.message : 'Meta API request failed');
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
          toast({
            variant: 'destructive',
            title: `Couldn't ${next === 'PAUSED' ? 'pause' : 'resume'} "${campaign.name}"`,
            description: res.error,
          });
        } else {
          toast({
            title: `${campaign.name} ${next === 'PAUSED' ? 'paused' : 'activated'}`,
          });
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

  // Empty/setup states.
  if (accountsLoading) {
    return (
      <WachatPage breadcrumb={ADS_BREADCRUMB} title="WhatsApp Ads">
        <div className="flex flex-col gap-6">
          <Skeleton height={36} width={256} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={118} />
            ))}
          </div>
          <Skeleton height={260} />
        </div>
      </WachatPage>
    );
  }

  if (accounts.length === 0) {
    return (
      <WachatPage breadcrumb={ADS_BREADCRUMB} title="WhatsApp Ads">
        <EmptyState
          icon={Megaphone}
          title="Connect an ad account to launch click-to-WhatsApp campaigns"
          description={
            accountsError
              ? `We couldn't load your ad accounts: ${accountsError}`
              : "Click-to-WhatsApp ads send a tap on Facebook or Instagram straight into your WhatsApp inbox. You'll need a funded Meta ad account linked to this workspace."
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => router.push('/dashboard/ad-manager/ad-accounts')}
              >
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
                iconRight={ArrowUpRight}
                onClick={() => router.push('/wachat/whatsapp-ads/roadmap')}
              >
                Roadmap
              </Button>
            </div>
          }
        />
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={ADS_BREADCRUMB}
      title="WhatsApp Ads"
      description={`Click-to-WhatsApp campaigns across Facebook & Instagram${
        activeProject?.name ? ` · ${activeProject.name}` : ''
      }`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedAccountId}
            onChange={(v) => setSelectedAccountId(v)}
            placeholder="Pick an ad account"
            aria-label="Ad account"
            className="w-[240px]"
            options={accounts.map((a) => ({
              value: a.id,
              label: `${a.name || `Ad Account ${a.account_id ?? a.id}`}${
                a.currency ? ` · ${a.currency}` : ''
              }`,
            }))}
          />
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            onClick={loadData}
            loading={dataLoading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() =>
              router.push(
                '/dashboard/ad-manager/create?destination=WHATSAPP&objective=OUTCOME_ENGAGEMENT',
              )
            }
          >
            New CTW campaign
          </Button>
          <AiCampaignDialog />
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* KPI strip — last 30 days, scoped to CTW-eligible campaigns */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Spend (30d)"
            value={fmtMoney(kpi.spend, currency)}
            icon={DollarSign}
            delta={
              accountKpi
                ? { value: `${fmtMoney(accountKpi.spend, currency)} account total`, tone: 'neutral' }
                : undefined
            }
          />
          <StatCard
            label="Impressions"
            value={fmtNum(kpi.impressions)}
            icon={Eye}
            delta={
              accountKpi
                ? { value: `${fmtNum(accountKpi.impressions)} account total`, tone: 'neutral' }
                : undefined
            }
          />
          <StatCard
            label="Link clicks"
            value={fmtNum(kpi.clicks)}
            icon={MousePointerClick}
            delta={
              accountKpi
                ? { value: `${fmtNum(accountKpi.clicks)} account total`, tone: 'neutral' }
                : undefined
            }
          />
          <StatCard label="CTR" value={fmtPct(kpi.ctr)} icon={Target} />
          <StatCard label="Avg. CPC" value={fmtMoney(kpi.cpc, currency)} icon={DollarSign} />
          <StatCard
            label="Chats started"
            value={fmtNum(kpi.msgs)}
            icon={MessagesSquare}
            delta={
              accountKpi
                ? { value: `${fmtNum(accountKpi.msgs)} account total`, tone: 'neutral' }
                : undefined
            }
          />
        </div>

        {/* Campaigns list */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="text-[22px] leading-none tracking-tight"
                style={{ color: 'var(--st-text)' }}
              >
                Campaigns
              </h2>
              <p
                className="mt-1.5 text-[12.5px]"
                style={{ color: 'var(--st-text-secondary)' }}
              >
                {dataLoading && campaigns.length === 0
                  ? 'Loading…'
                  : `${campaigns.length} CTW-eligible campaign${campaigns.length === 1 ? '' : 's'} · last 30 days insights`}
              </p>
            </div>
            <Menu
              align="end"
              label="Manage campaigns"
              trigger={
                <Button variant="outline" size="sm" iconRight={ChevronDown}>
                  More
                </Button>
              }
            >
              <MenuLabel>Manage</MenuLabel>
              <MenuSeparator />
              <MenuItem onSelect={() => router.push('/dashboard/ad-manager/campaigns')}>
                All campaigns
              </MenuItem>
              <MenuItem onSelect={() => router.push('/dashboard/ad-manager/insights')}>
                Open Insights
              </MenuItem>
              <MenuItem onSelect={() => router.push('/dashboard/ad-manager/audiences')}>
                Audiences
              </MenuItem>
              <MenuItem onSelect={() => router.push('/dashboard/ad-manager/creative-library')}>
                Creative library
              </MenuItem>
              <MenuSeparator />
              <MenuItem onSelect={() => router.push('/wachat/whatsapp-ads/roadmap')}>
                Roadmap
              </MenuItem>
            </Menu>
          </div>

          <Card padding="none" className="mt-5">
            {dataLoading && campaigns.length === 0 ? (
              <div className="flex flex-col gap-3 p-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} height={56} />
                ))}
              </div>
            ) : dataError ? (
              <div className="p-6">
                <EmptyState
                  icon={AlertTriangle}
                  tone="danger"
                  title="Failed to load campaigns"
                  description={dataError}
                  action={
                    <Button variant="outline" iconLeft={RefreshCw} onClick={loadData}>
                      Retry
                    </Button>
                  }
                />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={MessagesSquare}
                  title="No CTW campaigns yet"
                  description="Launch your first click-to-WhatsApp campaign and start collecting inbound conversations."
                  action={
                    <Button
                      variant="primary"
                      iconLeft={Plus}
                      onClick={() =>
                        router.push(
                          '/dashboard/ad-manager/create?destination=WHATSAPP&objective=OUTCOME_ENGAGEMENT',
                        )
                      }
                    >
                      Create campaign
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--st-border)' }}>
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
        <Card padding="md" className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ExternalLink
              className="h-4 w-4"
              style={{ color: 'var(--st-text-secondary)' }}
              aria-hidden="true"
            />
            <div>
              <div className="text-sm" style={{ color: 'var(--st-text)' }}>
                Full Ad Manager
              </div>
              <div className="text-[11.5px]" style={{ color: 'var(--st-text-secondary)' }}>
                Audiences, creatives, A/B tests, and detailed insights live in the unified Ad Manager.
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            iconRight={ArrowUpRight}
            onClick={() => router.push('/dashboard/ad-manager')}
          >
            Open Ad Manager
          </Button>
        </Card>
      </div>
    </WachatPage>
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
  const badgeTone: 'success' | 'warning' | 'danger' | 'neutral' = isActive
    ? 'success'
    : status === 'PAUSED'
      ? 'warning'
      : status.includes('DISAPPROVED') || status.includes('ARCHIVED') || status.includes('DELETED')
        ? 'danger'
        : 'neutral';

  return (
    <div className="flex flex-wrap items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <Link
          href={`/dashboard/ad-manager/campaigns/${campaign.id}`}
          className="block truncate text-sm font-medium hover:underline"
          style={{ color: 'var(--st-text)' }}
        >
          {campaign.name}
        </Link>
        <div
          className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px]"
          style={{ color: 'var(--st-text-secondary)' }}
        >
          <Badge tone={badgeTone}>{status}</Badge>
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
        <IconButton
          variant="ghost"
          size="sm"
          icon={isActive ? Pause : Play}
          label={isActive ? 'Pause campaign' : 'Resume campaign'}
          onClick={() => onToggle(campaign)}
          disabled={toggling}
        />
        <IconButton
          variant="ghost"
          size="sm"
          icon={ArrowUpRight}
          label="Open campaign"
          onClick={onOpen}
        />
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
    <div className={cx('flex flex-col items-end', className)}>
      <span className="text-[11px]" style={{ color: 'var(--st-text-secondary)' }}>
        {label}
      </span>
      <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--st-text)' }}>
        {value}
      </span>
    </div>
  );
}

function AiCampaignDialog() {
  const [open, setOpen] = React.useState(false);
  const [prompt, setPrompt] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [result, setResult] = React.useState<{ primaryText: string; headline: string; description: string; creativeIdea: string } | null>(null);

  const closeAndReset = (val: boolean) => {
    setOpen(val);
    if (!val) {
      setResult(null);
      setPrompt('');
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    // Simulate an AI API call delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setResult({
      primaryText: `🚀 Elevate your ${prompt || 'business'} today! Join thousands of happy customers. Tap to chat with us on WhatsApp for an exclusive offer! 💬`,
      headline: "Chat with us to claim your discount!",
      description: "Available on WhatsApp. Quick response guaranteed.",
      creativeIdea: "A vibrant, eye-catching image showing your product in action, with a recognizable green WhatsApp chat bubble in the lower right."
    });
    setGenerating(false);
  };

  return (
    <>
      <Button variant="secondary" iconLeft={Sparkles} onClick={() => setOpen(true)}>
        Generate with AI
      </Button>
      <Modal
        open={open}
        onClose={() => closeAndReset(false)}
        title="AI Campaign Generator"
        description="Describe your offer or product, and we'll generate WhatsApp-optimized ad copy and creative suggestions using AI."
        size="md"
      >
        <div className="grid gap-4">
          <Field label="What are you promoting?">
            <Textarea
              placeholder="e.g. A new summer collection of sneakers with 20% off"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </Field>
          {!result && (
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              iconLeft={generating ? undefined : Sparkles}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {generating ? 'Generating...' : 'Generate AI Copy'}
            </Button>
          )}
          {result && (
            <div
              className="flex flex-col gap-4 mt-2 pt-4 border-t"
              style={{ borderColor: 'var(--st-border)' }}
            >
              <div className="flex flex-col gap-1.5">
                <span
                  className="text-[12px] font-medium"
                  style={{ color: 'var(--st-text-secondary)' }}
                >
                  Primary Text
                </span>
                <div
                  className="text-sm p-3"
                  style={{
                    background: 'var(--st-bg-secondary)',
                    borderRadius: 'var(--st-radius-lg)',
                    border: '1px solid var(--st-border)',
                    color: 'var(--st-text)',
                  }}
                >
                  {result.primaryText}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span
                  className="text-[12px] font-medium"
                  style={{ color: 'var(--st-text-secondary)' }}
                >
                  Headline
                </span>
                <div
                  className="text-sm font-semibold p-3"
                  style={{
                    background: 'var(--st-bg-secondary)',
                    borderRadius: 'var(--st-radius-lg)',
                    border: '1px solid var(--st-border)',
                    color: 'var(--st-text)',
                  }}
                >
                  {result.headline}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span
                  className="text-[12px] font-medium"
                  style={{ color: 'var(--st-text-secondary)' }}
                >
                  Creative Suggestion
                </span>
                <div
                  className="text-sm p-3"
                  style={{
                    background: 'var(--st-bg-secondary)',
                    borderRadius: 'var(--st-radius-lg)',
                    border: '1px solid var(--st-border)',
                    color: 'var(--st-text-secondary)',
                  }}
                >
                  {result.creativeIdea}
                </div>
              </div>
              <Button variant="outline" onClick={() => { setResult(null); setPrompt(''); }}>
                Start over
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

export default function WhatsAppAdsPage(): React.ReactElement {
  return (
    <ErrorBoundary>
      <WhatsAppAdsPageContent />
    </ErrorBoundary>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("WhatsAppAdsPage Error Boundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <WachatPage breadcrumb={ADS_BREADCRUMB} title="WhatsApp Ads">
          <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
            <Alert tone="danger" title="Component Error" className="max-w-xl text-left mb-4">
              {this.state.error?.message || "An unexpected error occurred while rendering the page."}
            </Alert>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </WachatPage>
      );
    }
    return this.props.children;
  }
}
