'use client';

import { Button, Card, ZoruCardContent } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import {
  DollarSign,
  Eye,
  Users,
  MousePointerClick,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Megaphone,
  Plus,
  Circle,
  Pause,
  Play,
  RefreshCw,
  Download,
  } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAdManager } from '@/context/ad-manager-context';
import { useAdManagerShell } from '@/context/ad-manager-shell-context';
import { getInsights,
  listCampaigns } from '@/app/actions/ad-manager.actions';
import { formatMoney,
  formatNumber,
  formatPercent } from '@/components/zoruui-domain/ad-manager/constants';

/**
 * /dashboard/ad-manager — Meta Suite overview built on ZoruUI primitives.
 *
 * Shows account-level KPIs, top campaigns, and quick actions.
 * All data is real — pulled from Meta Graph API via server actions.
 */

import * as React from 'react';
import Link from 'next/link';

import { AmBreadcrumb, AmHeader } from './_components/am-page-shell';

/* ── types ──────────────────────────────────────────────────────── */

type Kpi = {
  id: string;
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  color: string;
};

/* ── skeleton ──────────────────────────────────────────────────── */

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <ZoruCardContent className="p-4">
            <div className="h-3 w-16 animate-pulse rounded-full bg-[var(--st-bg-muted)]" />
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-[var(--st-bg-muted)]" />
          </ZoruCardContent>
        </Card>
      ))}
    </div>
  );
}

function CampaignsSkeleton() {
  return (
    <Card>
      <ZoruCardContent className="space-y-3 p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--st-bg-muted)]" />
        ))}
      </ZoruCardContent>
    </Card>
  );
}

/* ── no account state ──────────────────────────────────────────── */

function NoAccountState() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--st-bg-muted)]">
        <Megaphone className="h-7 w-7 text-[var(--st-text)]" strokeWidth={1.75} />
      </div>
      <div>
        <h2 className="text-[20px] font-semibold text-[var(--st-text)]">Welcome to Meta Ads Manager</h2>
        <p className="mt-1.5 max-w-md text-[13px] text-[var(--st-text-secondary)] leading-relaxed">
          Connect your Meta ad account to start creating, managing, and measuring
          your Facebook & Instagram ad campaigns.
        </p>
      </div>
      <Button variant="default" size="md" onClick={() => router.push('/dashboard/ad-manager/ad-accounts')}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Connect ad account
      </Button>
    </div>
  );
}

/* ── status badge ──────────────────────────────────────────────── */

function StatusDot({ status }: { status: string }) {
  const s = status?.toUpperCase();
  const isActive = s === 'ACTIVE';
  const isPaused = s === 'PAUSED';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        isActive && 'bg-[var(--st-bg-muted)] text-[var(--st-text)]',
        isPaused && 'bg-[var(--st-bg-muted)] text-[var(--st-text)]',
        !isActive && !isPaused && 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]',
      )}
    >
      {isActive && <Play className="h-2.5 w-2.5" />}
      {isPaused && <Pause className="h-2.5 w-2.5" />}
      {!isActive && !isPaused && <Circle className="h-2.5 w-2.5" />}
      {status?.replace(/_/g, ' ') || 'Unknown'}
    </span>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

export default function AdManagerOverviewPage() {
  const router = useRouter();
  const { activeAccount } = useAdManager();
  const { preset } = useAdManagerShell();

  const [loading, setLoading] = React.useState(true);
  const [kpis, setKpis] = React.useState<Kpi[]>([]);
  const [topCampaigns, setTopCampaigns] = React.useState<any[]>([]);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (!activeAccount) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const actId = `act_${activeAccount.account_id.replace(/^act_/, '')}`;
      const [insightsRes, campaignsRes] = await Promise.all([
        getInsights(actId, {
          level: 'account',
          date_preset: preset && preset !== 'custom' ? preset : 'last_7d',
        }),
        listCampaigns(activeAccount.account_id),
      ]);

      const agg = insightsRes.data?.[0] || {};
      setKpis([
        {
          id: 'spend',
          label: 'Amount spent',
          value: formatMoney(agg.spend || 0),
          icon: DollarSign,
          color: 'text-[var(--st-text)]',
        },
        {
          id: 'impressions',
          label: 'Impressions',
          value: formatNumber(agg.impressions || 0),
          icon: Eye,
          color: 'text-[var(--st-text)]',
        },
        {
          id: 'reach',
          label: 'Reach',
          value: formatNumber(agg.reach || 0),
          icon: Users,
          color: 'text-[var(--st-text)]',
        },
        {
          id: 'clicks',
          label: 'Link clicks',
          value: formatNumber(agg.inline_link_clicks || agg.clicks || 0),
          icon: MousePointerClick,
          color: 'text-[var(--st-text)]',
        },
        {
          id: 'ctr',
          label: 'CTR',
          value: formatPercent(agg.ctr || 0),
          icon: TrendingUp,
          color: 'text-[var(--st-text)]',
        },
        {
          id: 'cpc',
          label: 'CPC',
          value: formatMoney(agg.cpc || 0),
          icon: TrendingDown,
          color: 'text-[var(--st-text)]',
        },
      ]);

      setTopCampaigns((campaignsRes.data || []).slice(0, 6));
      setLoading(false);
    })();
  }, [activeAccount, preset]);

  if (!isMounted) {
    return (
      <>
        <AmBreadcrumb page="Overview" />
        <AmHeader title="Performance overview" description="Loading..." />
        <div className="mt-6">
          <KpiSkeleton />
        </div>
      </>
    );
  }

  if (!activeAccount) {
    return (
      <>
        <AmBreadcrumb page="Overview" />
        <NoAccountState />
      </>
    );
  }

  return (
    <>
      {/* Breadcrumbs */}
      <AmBreadcrumb page="Overview" />

      {/* Header */}
      <AmHeader
        title="Performance overview"
        description={`${activeAccount.name} · ${preset?.replace(/_/g, ' ') || 'last 7 days'}`}
      />

      {/* KPI cards */}
      <div className="mt-6">
        {loading ? (
          <KpiSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Card key={kpi.id}>
                  <ZoruCardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Icon className={cn('h-4 w-4', kpi.color)} strokeWidth={2} />
                    </div>
                    <div className="mt-2">
                      <p className="text-[11px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
                        {kpi.label}
                      </p>
                      <p className="mt-0.5 text-[22px] font-semibold tabular-nums text-[var(--st-text)] leading-tight">
                        {kpi.value}
                      </p>
                    </div>
                  </ZoruCardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Two-column layout: campaigns + quick actions */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        {/* Top campaigns */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[var(--st-text)]">Top campaigns</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/ad-manager/campaigns')}
            >
              View all
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>

          {loading ? (
            <CampaignsSkeleton />
          ) : topCampaigns.length === 0 ? (
            <Card>
              <ZoruCardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Megaphone className="h-6 w-6 text-[var(--st-text-tertiary)]" strokeWidth={1.5} />
                <p className="text-[13px] text-[var(--st-text-secondary)]">
                  No campaigns yet. Create your first campaign to see results here.
                </p>
              </ZoruCardContent>
            </Card>
          ) : (
            <Card>
              <div className="divide-y divide-[var(--st-border)]">
                {topCampaigns.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/ad-manager/campaigns/${c.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-[var(--st-bg-muted)]/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[var(--st-text)]">
                        {c.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--st-text-secondary)]">
                        <span>{c.objective?.replace(/_/g, ' ')}</span>
                        <span className="text-[var(--st-text-tertiary)]">·</span>
                        <StatusDot status={c.effective_status || c.status} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-semibold tabular-nums text-[var(--st-text)]">
                        {formatMoney((c.daily_budget || c.lifetime_budget || 0) / 100)}
                      </p>
                      <p className="text-[10px] text-[var(--st-text-secondary)]">
                        {c.daily_budget ? 'Daily' : 'Lifetime'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Quick actions sidebar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[var(--st-text)]">Quick actions</p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7"
                onClick={() => {
                  setLoading(true);
                  (async () => {
                    const actId = `act_${activeAccount.account_id.replace(/^act_/, '')}`;
                    const [insightsRes, campaignsRes] = await Promise.all([
                      getInsights(actId, {
                        level: 'account',
                        date_preset: preset && preset !== 'custom' ? preset : 'last_7d',
                      }),
                      listCampaigns(activeAccount.account_id),
                    ]);
                    const agg = insightsRes.data?.[0] || {};
                    setKpis([
                      { id: 'spend', label: 'Amount spent', value: formatMoney(agg.spend || 0), icon: DollarSign, color: 'text-[var(--st-text)]' },
                      { id: 'impressions', label: 'Impressions', value: formatNumber(agg.impressions || 0), icon: Eye, color: 'text-[var(--st-text)]' },
                      { id: 'reach', label: 'Reach', value: formatNumber(agg.reach || 0), icon: Users, color: 'text-[var(--st-text)]' },
                      { id: 'clicks', label: 'Link clicks', value: formatNumber(agg.inline_link_clicks || agg.clicks || 0), icon: MousePointerClick, color: 'text-[var(--st-text)]' },
                      { id: 'ctr', label: 'CTR', value: formatPercent(agg.ctr || 0), icon: TrendingUp, color: 'text-[var(--st-text)]' },
                      { id: 'cpc', label: 'CPC', value: formatMoney(agg.cpc || 0), icon: TrendingDown, color: 'text-[var(--st-text)]' },
                    ]);
                    setTopCampaigns((campaignsRes.data || []).slice(0, 6));
                    setLoading(false);
                  })();
                }}
              >
                <RefreshCw className={cn('h-3.5 w-3.5 text-[var(--st-text-secondary)]', loading && 'animate-spin')} strokeWidth={2} />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7"
                onClick={() => {
                  const data = kpis.map((k) => ({ id: k.id, label: k.label, value: k.value }));
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `kpi-export-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" strokeWidth={2} />
              </Button>
            </div>
          </div>

          <Card>
            <ZoruCardContent className="space-y-2 p-4">
              <QuickAction
                label="Create campaign"
                description="Launch new ads on Facebook & Instagram"
                onClick={() => router.push('/dashboard/ad-manager/create')}
              />
              <QuickAction
                label="Manage audiences"
                description="Build custom & lookalike audiences"
                onClick={() => router.push('/dashboard/ad-manager/audiences')}
              />
              <QuickAction
                label="Creative library"
                description="Upload and manage ad images & videos"
                onClick={() => router.push('/dashboard/ad-manager/creative-library')}
              />
              <QuickAction
                label="View insights"
                description="Breakdowns by device, age, placement"
                onClick={() => router.push('/dashboard/ad-manager/insights')}
              />
              <QuickAction
                label="Manage pixels"
                description="Track website conversions"
                onClick={() => router.push('/dashboard/ad-manager/pixels')}
              />
            </ZoruCardContent>
          </Card>

          {/* Account info */}
          <Card>
            <ZoruCardContent className="p-4">
              <p className="text-[11px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
                Active account
              </p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--st-text)] truncate">
                {activeAccount.name}
              </p>
              <p className="text-[11px] text-[var(--st-text-secondary)] font-mono">
                {activeAccount.account_id}
              </p>
            </ZoruCardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

/* ── quick action row ──────────────────────────────────────────── */

function QuickAction({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-3 rounded-lg p-2.5 text-left transition hover:bg-[var(--st-bg-muted)]/60"
    >
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-[var(--st-text)]">{label}</p>
        <p className="text-[11px] text-[var(--st-text-secondary)]">{description}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-tertiary)] transition group-hover:translate-x-0.5 group-hover:text-[var(--st-text)]" />
    </button>
  );
}
