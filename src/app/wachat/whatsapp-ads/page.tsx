'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { m, useReducedMotion } from 'motion/react';
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
import {
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Textarea,
  zoruSonnerToast,
} from '@/components/zoruui';
import { fmtINR } from '@/lib/utils';

import { useProject } from '@/context/project-context';
import {
  getAdAccounts,
  getInsights,
  listCampaigns,
  updateEntityStatus,
} from '@/app/actions/ad-manager.actions';

import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  StatusPill,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

/**
 * WhatsApp Ads - CTW (click-to-WhatsApp) workspace. Wraps the Meta
 * Marketing API server actions and presents a CTW-scoped dashboard.
 */

const STORAGE_KEY = 'wachat:whatsapp-ads:adAccountId';
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

type AdAccount = { id: string; account_id?: string; name?: string; currency?: string; account_status?: number };
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

const toNum = (v: string | number | undefined) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const fmtMoney = (v: string | number | undefined, currency = 'USD') => fmtINR(toNum(v), currency);
const fmtNum = (v: string | number | undefined) => new Intl.NumberFormat().format(Math.round(toNum(v)));
const fmtPct = (v: string | number | undefined) => `${toNum(v).toFixed(2)}%`;
const budgetMajor = (d: string | number | undefined) => toNum(d) / 100;

const countCtwMessages = (rows: InsightRow[] | undefined) => {
  if (!rows) return 0;
  let total = 0;
  for (const r of rows) for (const a of r.actions || []) {
    if (CTW_ACTION_TYPES.has(a.action_type) || a.action_type?.toLowerCase?.().includes('whatsapp')) total += toNum(a.value);
  }
  return total;
};

const statusTone = (s?: string): StatusTone => {
  const v = (s || '').toUpperCase();
  if (v === 'ACTIVE') return 'live';
  if (v === 'PAUSED') return 'paused';
  if (v.includes('DISAPPROVED') || v.includes('ARCHIVED') || v.includes('DELETED')) return 'failed';
  return 'draft';
};

function WhatsAppAdsPageContent(): React.ReactElement {
  const router = useRouter();
  const { activeProject } = useProject();
  const reduce = useReducedMotion();

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

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setSelectedAccountId(saved);
    } catch { /* ignore */ }
  }, []);

  React.useEffect(() => {
    let active = true;
    setAccountsLoading(true);
    getAdAccounts()
      .then((res) => {
        if (!active) return;
        if (res.error) setAccountsError(res.error);
        const list = (res.accounts || []) as AdAccount[];
        setAccounts(list);
        setSelectedAccountId((prev) => (prev && list.some((a) => a.id === prev) ? prev : list[0]?.id ?? null));
      })
      .catch((e) => { if (active) setAccountsError(e instanceof Error ? e.message : 'Failed to load ad accounts'); })
      .finally(() => { if (active) setAccountsLoading(false); });
    return () => { active = false; };
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
        fields: ['campaign_id', 'campaign_name', 'spend', 'impressions', 'clicks', 'ctr', 'cpm', 'cpc', 'actions'],
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
        for (const row of (ins.data || []) as InsightRow[]) if (row.campaign_id) map[row.campaign_id] = row;
        setInsightsMap(map);
        setAccountInsight(((acct.data || []) as InsightRow[])[0] ?? null);
      })
      .catch((err) => { if (active) setDataError(err instanceof Error ? err.message : 'Meta API request failed'); })
      .finally(() => { if (active) setDataLoading(false); });
    return () => { active = false; };
  }, [selectedAccountId]);

  React.useEffect(() => {
    if (!selectedAccountId) return;
    try { window.localStorage.setItem(STORAGE_KEY, selectedAccountId); } catch { /* ignore */ }
    loadData();
  }, [selectedAccountId, loadData]);

  const handleStatusToggle = React.useCallback(
    async (campaign: Campaign) => {
      const next: 'ACTIVE' | 'PAUSED' = campaign.effective_status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      setPendingTogglesId(campaign.id);
      try {
        const res = await updateEntityStatus(campaign.id, 'campaign', next);
        if (res.error) {
          zoruSonnerToast.error(`Couldn't ${next === 'PAUSED' ? 'pause' : 'resume'} "${campaign.name}": ${res.error}`);
        } else {
          zoruSonnerToast.success(`${campaign.name} ${next === 'PAUSED' ? 'paused' : 'activated'}`);
          loadData();
        }
      } finally {
        setPendingTogglesId(null);
      }
    },
    [loadData],
  );

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

  if (accountsLoading) {
    return (
      <WaPage>
        <PageHeader title="WhatsApp ads" description="Click-to-WhatsApp campaigns across Facebook and Instagram." kicker="Wachat · ads" eyebrowIcon={Megaphone} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          ))}
        </div>
      </WaPage>
    );
  }

  if (accounts.length === 0) {
    return (
      <WaPage>
        <PageHeader title="WhatsApp ads" description="Click-to-WhatsApp campaigns across Facebook and Instagram." kicker="Wachat · ads" eyebrowIcon={Megaphone} />
        <EmptyState
          icon={Megaphone}
          title="Connect an ad account to launch click-to-WhatsApp"
          description={
            accountsError
              ? `Couldn't load your ad accounts: ${accountsError}`
              : "Click-to-WhatsApp ads send a tap on Facebook or Instagram straight into your WhatsApp inbox. You'll need a funded Meta ad account linked to this workspace."
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <WaButton onClick={() => router.push('/dashboard/ad-manager/ad-accounts')} leftIcon={Plus}>Connect ad account</WaButton>
              <WaButton variant="outline" onClick={() => router.push('/wachat/whatsapp-ads/setup')}>Setup guide</WaButton>
              <WaButton variant="ghost" onClick={() => router.push('/wachat/whatsapp-ads/roadmap')} rightIcon={ArrowUpRight}>Roadmap</WaButton>
            </div>
          }
        />
      </WaPage>
    );
  }

  return (
    <WaPage>
      <PageHeader
        title="WhatsApp ads"
        description={`Click-to-WhatsApp campaigns across Facebook and Instagram${activeProject?.name ? ` for ${activeProject.name}` : ''}.`}
        kicker="Wachat · ads"
        eyebrowIcon={Megaphone}
        actions={
          <>
            <div className="flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white pl-3 pr-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Account</span>
              <Select value={selectedAccountId ?? undefined} onValueChange={(v) => setSelectedAccountId(v)}>
                <ZoruSelectTrigger className="h-8 w-[200px] border-0 bg-transparent shadow-none">
                  <ZoruSelectValue placeholder="Pick an ad account" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {accounts.map((a) => (
                    <ZoruSelectItem key={a.id} value={a.id}>
                      {a.name || `Ad account ${a.account_id ?? a.id}`}{a.currency ? ` · ${a.currency}` : ''}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
            <WaButton variant="outline" onClick={loadData} disabled={dataLoading} leftIcon={RefreshCw}>Refresh</WaButton>
            <WaButton onClick={() => router.push('/dashboard/ad-manager/create?destination=WHATSAPP&objective=OUTCOME_ENGAGEMENT')} leftIcon={Plus}>
              New CTW campaign
            </WaButton>
            <AiCampaignDialog />
          </>
        }
      />

      {/* KPI strip */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Spend (30d)" value={fmtMoney(kpi.spend, currency)} icon={DollarSign} delay={0.02} />
        <MetricTile label="Impressions" value={fmtNum(kpi.impressions)} icon={Eye} delay={0.04} />
        <MetricTile label="Link clicks" value={fmtNum(kpi.clicks)} icon={MousePointerClick} delay={0.06} />
        <MetricTile label="CTR" value={fmtPct(kpi.ctr)} icon={Target} delay={0.08} />
        <MetricTile label="Avg. CPC" value={fmtMoney(kpi.cpc, currency)} icon={DollarSign} delay={0.1} />
        <MetricTile label="Chats started" value={fmtNum(kpi.msgs)} icon={MessagesSquare} delay={0.12} />
      </section>

      {accountKpi && (
        <p className="mb-6 text-[11.5px] text-zinc-500">
          Account-wide totals (30d): {fmtMoney(accountKpi.spend, currency)} spend · {fmtNum(accountKpi.impressions)} impressions · {fmtNum(accountKpi.clicks)} clicks · {fmtNum(accountKpi.msgs)} chats.
        </p>
      )}

      <Section
        title="Campaigns"
        description={
          dataLoading && campaigns.length === 0
            ? 'Loading...'
            : `${campaigns.length} CTW-eligible campaign${campaigns.length === 1 ? '' : 's'} · last 30 days`
        }
        padded={false}
        action={
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <button className="inline-flex h-8 items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-zinc-700 hover:border-zinc-900 active:scale-[0.97]">
                More <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuLabel>Manage</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem onSelect={() => router.push('/dashboard/ad-manager/campaigns')}>All campaigns</ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem onSelect={() => router.push('/dashboard/ad-manager/insights')}>Open insights</ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem onSelect={() => router.push('/dashboard/ad-manager/audiences')}>Audiences</ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem onSelect={() => router.push('/dashboard/ad-manager/creative-library')}>Creative library</ZoruDropdownMenuItem>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem onSelect={() => router.push('/wachat/whatsapp-ads/roadmap')}>Roadmap</ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
          </DropdownMenu>
        }
      >
        {dataLoading && campaigns.length === 0 ? (
          <div className="flex flex-col gap-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-100" />
            ))}
          </div>
        ) : dataError ? (
          <div className="p-5">
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load campaigns"
              description={dataError}
              action={<WaButton variant="outline" onClick={loadData} leftIcon={RefreshCw}>Retry</WaButton>}
            />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={MessagesSquare}
              title="No CTW campaigns yet"
              description="Launch your first click-to-WhatsApp campaign and start collecting inbound conversations."
              action={
                <WaButton
                  onClick={() => router.push('/dashboard/ad-manager/create?destination=WHATSAPP&objective=OUTCOME_ENGAGEMENT')}
                  leftIcon={Plus}
                >
                  Create campaign
                </WaButton>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {campaigns.map((c, i) => (
              <m.li
                key={c.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : i * 0.03, ease: EASE_OUT }}
              >
                <CampaignRow
                  campaign={c}
                  insight={insightsMap[c.id]}
                  currency={currency}
                  toggling={pendingTogglesId === c.id}
                  onToggle={handleStatusToggle}
                  onOpen={() => router.push(`/dashboard/ad-manager/campaigns/${c.id}`)}
                />
              </m.li>
            ))}
          </ul>
        )}
      </Section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'var(--mt-accent-soft)' }}>
            <ExternalLink className="h-4 w-4" strokeWidth={2} style={{ color: 'var(--mt-accent)' }} aria-hidden />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-zinc-900">Full ad manager</p>
            <p className="text-[11.5px] text-zinc-500">Audiences, creatives, A/B tests, and detailed insights live in the unified ad manager.</p>
          </div>
        </div>
        <WaButton variant="outline" rightIcon={ArrowUpRight} onClick={() => router.push('/dashboard/ad-manager')}>
          Open ad manager
        </WaButton>
      </div>
    </WaPage>
  );
}

function CampaignRow({
  campaign, insight, currency, toggling, onToggle, onOpen,
}: {
  campaign: Campaign;
  insight: InsightRow | undefined;
  currency: string;
  toggling: boolean;
  onToggle: (c: Campaign) => void;
  onOpen: () => void;
}) {
  const isActive = campaign.effective_status === 'ACTIVE';
  const status = campaign.effective_status || campaign.status || 'UNKNOWN';
  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <Link href={`/dashboard/ad-manager/campaigns/${campaign.id}`} className="block truncate text-[13.5px] font-semibold text-zinc-900 hover:underline">
          {campaign.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-zinc-500">
          <StatusPill tone={statusTone(status)}>{status}</StatusPill>
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
        <Metric label="CPC" value={fmtMoney(insight?.cpc, currency)} className="hidden sm:flex" />
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onToggle(campaign)}
          disabled={toggling}
          aria-label={isActive ? 'Pause campaign' : 'Resume campaign'}
          className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.94] disabled:opacity-50"
        >
          {isActive ? <Pause className="h-3.5 w-3.5" strokeWidth={2.25} /> : <Play className="h-3.5 w-3.5" strokeWidth={2.25} />}
        </button>
        <button
          type="button"
          onClick={onOpen}
          aria-label="Open campaign"
          className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.94]"
        >
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex flex-col items-end ${className}`}>
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-zinc-500">{label}</span>
      <span className="tabular-nums text-zinc-900">{value}</span>
    </div>
  );
}

function AiCampaignDialog() {
  const [open, setOpen] = React.useState(false);
  const [prompt, setPrompt] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [result, setResult] = React.useState<{ primaryText: string; headline: string; description: string; creativeIdea: string } | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1800));
    setResult({
      primaryText: `Elevate your ${prompt || 'business'} today. Join thousands of happy customers. Tap to chat with us on WhatsApp for an exclusive offer.`,
      headline: 'Chat with us to claim your discount',
      description: 'Available on WhatsApp. Quick response guaranteed.',
      creativeIdea: 'A vibrant, eye-catching image showing your product in action, with a recognizable green WhatsApp chat bubble in the lower right.',
    });
    setGenerating(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) { setResult(null); setPrompt(''); } }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 text-[13px] font-semibold text-zinc-900 transition-colors hover:border-zinc-900 active:scale-[0.97]"
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} />
          Generate with AI
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>AI campaign generator</DialogTitle>
          <DialogDescription>
            Describe your offer or product, and we'll draft WhatsApp-optimized copy and creative suggestions.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label>What are you promoting?</Label>
            <Textarea
              placeholder="e.g. a new summer collection of sneakers with 20% off"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
          {!result && (
            <WaButton onClick={handleGenerate} disabled={generating || !prompt.trim()} leftIcon={generating ? Loader2 : Sparkles}>
              {generating ? 'Generating...' : 'Generate copy'}
            </WaButton>
          )}
          {result && (
            <div className="mt-2 flex flex-col gap-4 border-t border-zinc-100 pt-4">
              <ResultBlock label="Primary text" value={result.primaryText} />
              <ResultBlock label="Headline" value={result.headline} bold />
              <ResultBlock label="Creative suggestion" value={result.creativeIdea} muted />
              <WaButton variant="outline" onClick={() => { setResult(null); setPrompt(''); }}>Start over</WaButton>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultBlock({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-zinc-500">{label}</Label>
      <div className={`rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-[13px] ${bold ? 'font-semibold' : ''} ${muted ? 'text-zinc-500' : 'text-zinc-900'}`}>
        {value}
      </div>
    </div>
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
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('WhatsAppAdsPage Error Boundary:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <WaPage>
          <EmptyState
            icon={AlertTriangle}
            title="Component error"
            description={this.state.error?.message || 'An unexpected error occurred while rendering this page.'}
            action={<WaButton variant="outline" onClick={() => window.location.reload()}>Reload page</WaButton>}
          />
        </WaPage>
      );
    }
    return this.props.children;
  }
}
