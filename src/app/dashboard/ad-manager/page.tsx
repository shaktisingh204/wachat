'use client';

/**
 * /dashboard/ad-manager — Meta Suite overview built on Clay primitives.
 *
 * Shows account-level KPIs, top campaigns, and quick actions.
 * All data is real — pulled from Meta Graph API via server actions.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LuDollarSign,
  LuEye,
  LuUsers,
  LuMousePointerClick,
  LuTrendingUp,
  LuTrendingDown,
  LuArrowRight,
  LuMegaphone,
  LuPlus,
  LuCircle,
  LuPause,
  LuPlay,
} from 'react-icons/lu';

import { cn } from '@/lib/utils';
import { useAdManager } from '@/context/ad-manager-context';
import { useAdManagerShell } from './layout';
import { getInsights, listCampaigns } from '@/app/actions/ad-manager.actions';
import { formatMoney, formatNumber, formatPercent } from '@/components/wabasimplify/ad-manager/constants';
import {
  ClayBreadcrumbs,
  ClayButton,
  ClayCard,
  ClayListRow,
} from '@/components/clay';

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
        <ClayCard key={i} className="!p-4">
          <div className="h-3 w-16 animate-pulse rounded-full bg-clay-bg-2" />
          <div className="mt-3 h-7 w-20 animate-pulse rounded bg-clay-bg-2" />
        </ClayCard>
      ))}
    </div>
  );
}

function CampaignsSkeleton() {
  return (
    <ClayCard>
      <div className="space-y-3 p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-clay-bg-2" />
        ))}
      </div>
    </ClayCard>
  );
}

/* ── no account state ──────────────────────────────────────────── */

function NoAccountState() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
        <LuMegaphone className="h-7 w-7 text-indigo-600" strokeWidth={1.75} />
      </div>
      <div>
        <h2 className="text-[20px] font-semibold text-clay-ink">Welcome to Meta Ads Manager</h2>
        <p className="mt-1.5 max-w-md text-[13px] text-clay-ink-muted leading-relaxed">
          Connect your Meta ad account to start creating, managing, and measuring
          your Facebook & Instagram ad campaigns.
        </p>
      </div>
      <ClayButton variant="obsidian" size="md" onClick={() => router.push('/dashboard/ad-manager/ad-accounts')}>
        <LuPlus className="mr-1.5 h-3.5 w-3.5" />
        Connect ad account
      </ClayButton>
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
        isActive && 'bg-emerald-50 text-emerald-700',
        isPaused && 'bg-amber-50 text-amber-700',
        !isActive && !isPaused && 'bg-clay-bg-2 text-clay-ink-muted',
      )}
    >
      {isActive && <LuPlay className="h-2.5 w-2.5" />}
      {isPaused && <LuPause className="h-2.5 w-2.5" />}
      {!isActive && !isPaused && <LuCircle className="h-2.5 w-2.5" />}
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
          icon: LuDollarSign,
          color: 'text-emerald-600',
        },
        {
          id: 'impressions',
          label: 'Impressions',
          value: formatNumber(agg.impressions || 0),
          icon: LuEye,
          color: 'text-blue-600',
        },
        {
          id: 'reach',
          label: 'Reach',
          value: formatNumber(agg.reach || 0),
          icon: LuUsers,
          color: 'text-violet-600',
        },
        {
          id: 'clicks',
          label: 'Link clicks',
          value: formatNumber(agg.inline_link_clicks || agg.clicks || 0),
          icon: LuMousePointerClick,
          color: 'text-indigo-600',
        },
        {
          id: 'ctr',
          label: 'CTR',
          value: formatPercent(agg.ctr || 0),
          icon: LuTrendingUp,
          color: 'text-amber-600',
        },
        {
          id: 'cpc',
          label: 'CPC',
          value: formatMoney(agg.cpc || 0),
          icon: LuTrendingDown,
          color: 'text-rose-600',
        },
      ]);

      setTopCampaigns((campaignsRes.data || []).slice(0, 6));
      setLoading(false);
    })();
  }, [activeAccount, preset]);

  if (!activeAccount) {
    return (
      <>
        <ClayBreadcrumbs
          items={[
            { label: 'SabNode', href: '/home' },
            { label: 'Meta Suite', href: '/dashboard/ad-manager' },
            { label: 'Overview' },
          ]}
        />
        <NoAccountState />
      </>
    );
  }

  return (
    <>
      {/* Breadcrumbs */}
      <ClayBreadcrumbs
        items={[
          { label: 'SabNode', href: '/home' },
          { label: 'Meta Suite', href: '/dashboard/ad-manager' },
          { label: 'Overview' },
        ]}
      />

      {/* Header */}
      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.15]">
            Performance overview
          </h1>
          <p className="mt-1 text-[13px] text-clay-ink-muted">
            {activeAccount.name} · {preset?.replace(/_/g, ' ') || 'last 7 days'}
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mt-6">
        {loading ? (
          <KpiSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <ClayCard key={kpi.id} className="!p-4">
                  <div className="flex items-center justify-between">
                    <Icon className={cn('h-4 w-4', kpi.color)} strokeWidth={2} />
                  </div>
                  <div className="mt-2">
                    <p className="text-[11px] font-medium text-clay-ink-muted uppercase tracking-wide">
                      {kpi.label}
                    </p>
                    <p className="mt-0.5 text-[22px] font-semibold tabular-nums text-clay-ink leading-tight">
                      {kpi.value}
                    </p>
                  </div>
                </ClayCard>
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
            <p className="text-[13px] font-semibold text-clay-ink">Top campaigns</p>
            <ClayButton
              variant="ghost"
              size="sm"
              trailing={<LuArrowRight className="h-3 w-3" />}
              onClick={() => router.push('/dashboard/ad-manager/campaigns')}
            >
              View all
            </ClayButton>
          </div>

          {loading ? (
            <CampaignsSkeleton />
          ) : topCampaigns.length === 0 ? (
            <ClayCard variant="soft" className="flex flex-col items-center gap-3 py-12 text-center">
              <LuMegaphone className="h-6 w-6 text-clay-ink-muted/40" strokeWidth={1.5} />
              <p className="text-[13px] text-clay-ink-muted">
                No campaigns yet. Create your first campaign to see results here.
              </p>
            </ClayCard>
          ) : (
            <ClayCard padded={false}>
              <div className="divide-y divide-clay-border">
                {topCampaigns.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/ad-manager/campaigns/${c.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-clay-bg-2/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-clay-ink">
                        {c.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-clay-ink-muted">
                        <span>{c.objective?.replace(/_/g, ' ')}</span>
                        <span className="text-clay-ink-muted/30">·</span>
                        <StatusDot status={c.effective_status || c.status} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-semibold tabular-nums text-clay-ink">
                        {formatMoney((c.daily_budget || c.lifetime_budget || 0) / 100)}
                      </p>
                      <p className="text-[10px] text-clay-ink-muted">
                        {c.daily_budget ? 'Daily' : 'Lifetime'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </ClayCard>
          )}
        </div>

        {/* Quick actions sidebar */}
        <div className="space-y-4">
          <p className="text-[13px] font-semibold text-clay-ink">Quick actions</p>

          <ClayCard className="space-y-2 !p-4">
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
          </ClayCard>

          {/* Account info */}
          <ClayCard variant="soft" className="!p-4">
            <p className="text-[11px] font-medium text-clay-ink-muted uppercase tracking-wide">
              Active account
            </p>
            <p className="mt-1 text-[13px] font-semibold text-clay-ink truncate">
              {activeAccount.name}
            </p>
            <p className="text-[11px] text-clay-ink-muted font-mono">
              {activeAccount.account_id}
            </p>
          </ClayCard>
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
      className="group flex w-full items-center justify-between gap-3 rounded-lg p-2.5 text-left transition hover:bg-clay-bg-2/60"
    >
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-clay-ink">{label}</p>
        <p className="text-[11px] text-clay-ink-muted">{description}</p>
      </div>
      <LuArrowRight className="h-3.5 w-3.5 shrink-0 text-clay-ink-muted/40 transition group-hover:translate-x-0.5 group-hover:text-clay-ink" />
    </button>
  );
}
