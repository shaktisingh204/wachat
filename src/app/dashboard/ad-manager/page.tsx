'use client';

import {
  Button,
  Card,
  CardBody,
  StatCard,
  Badge,
  EmptyState,
  IconButton,
} from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';
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
import { getInsights, listCampaigns } from '@/app/actions/ad-manager.actions';
import {
  formatMoney,
  formatNumber,
  formatPercent,
} from '@/components/20ui-domain/ad-manager/constants';

/**
 * /dashboard/ad-manager - Meta Suite overview built on the 20ui design system.
 *
 * Shows account-level KPIs, top campaigns, and quick actions.
 * All data is real, pulled from Meta Graph API via server actions.
 */

import * as React from 'react';
import Link from 'next/link';

import { AmBreadcrumb, AmHeader } from './_components/am-page-shell';

/* types */

type Kpi = {
  id: string;
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; size?: number }>;
};

/* skeleton */

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardBody className="p-4">
            <div className="h-3 w-16 animate-pulse rounded-full bg-[var(--st-bg-muted)]" />
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-[var(--st-bg-muted)]" />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function CampaignsSkeleton() {
  return (
    <Card>
      <CardBody className="space-y-3 p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--st-bg-muted)]" />
        ))}
      </CardBody>
    </Card>
  );
}

/* no account state */

function NoAccountState() {
  const router = useRouter();
  return (
    <EmptyState
      className="py-20"
      icon={Megaphone}
      title="Welcome to Meta Ads Manager"
      description="Connect your Meta ad account to start creating, managing, and measuring your Facebook and Instagram ad campaigns."
      action={
        <Button
          variant="primary"
          size="md"
          iconLeft={Plus}
          onClick={() => router.push('/dashboard/ad-manager/ad-accounts')}
        >
          Connect ad account
        </Button>
      }
    />
  );
}

/* status badge */

function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase();
  const isActive = s === 'ACTIVE';
  const isPaused = s === 'PAUSED';
  const tone = isActive ? 'success' : isPaused ? 'warning' : 'neutral';
  const Icon = isActive ? Play : isPaused ? Pause : Circle;
  return (
    <Badge tone={tone} kind="soft" className="uppercase">
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {status?.replace(/_/g, ' ') || 'Unknown'}
    </Badge>
  );
}

/* page */

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

  const refresh = React.useCallback(() => {
    if (!activeAccount) return;
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
        },
        {
          id: 'impressions',
          label: 'Impressions',
          value: formatNumber(agg.impressions || 0),
          icon: Eye,
        },
        {
          id: 'reach',
          label: 'Reach',
          value: formatNumber(agg.reach || 0),
          icon: Users,
        },
        {
          id: 'clicks',
          label: 'Link clicks',
          value: formatNumber(agg.inline_link_clicks || agg.clicks || 0),
          icon: MousePointerClick,
        },
        {
          id: 'ctr',
          label: 'CTR',
          value: formatPercent(agg.ctr || 0),
          icon: TrendingUp,
        },
        {
          id: 'cpc',
          label: 'CPC',
          value: formatMoney(agg.cpc || 0),
          icon: TrendingDown,
        },
      ]);

      setTopCampaigns((campaignsRes.data || []).slice(0, 6));
      setLoading(false);
    })();
  }, [activeAccount, preset]);

  React.useEffect(() => {
    if (!activeAccount) {
      setLoading(false);
      return;
    }
    refresh();
  }, [activeAccount, preset, refresh]);

  function exportKpis() {
    const data = kpis.map((k) => ({ id: k.id, label: k.label, value: k.value }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kpi-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
            {kpis.map((kpi) => (
              <StatCard
                key={kpi.id}
                icon={kpi.icon}
                label={kpi.label}
                value={kpi.value}
              />
            ))}
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
              iconRight={ArrowRight}
              onClick={() => router.push('/dashboard/ad-manager/campaigns')}
            >
              View all
            </Button>
          </div>

          {loading ? (
            <CampaignsSkeleton />
          ) : topCampaigns.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  size="sm"
                  icon={Megaphone}
                  title="No campaigns yet"
                  description="Create your first campaign to see results here."
                />
              </CardBody>
            </Card>
          ) : (
            <Card padding="none">
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
                        <StatusBadge status={c.effective_status || c.status} />
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
              <IconButton
                label="Refresh data"
                icon={RefreshCw}
                size="sm"
                onClick={refresh}
                className={cn(loading && '[&_svg]:animate-spin')}
              />
              <IconButton
                label="Export KPIs as JSON"
                icon={Download}
                size="sm"
                onClick={exportKpis}
              />
            </div>
          </div>

          <Card>
            <CardBody className="space-y-2 p-4">
              <QuickAction
                label="Create campaign"
                description="Launch new ads on Facebook and Instagram"
                onClick={() => router.push('/dashboard/ad-manager/create')}
              />
              <QuickAction
                label="Manage audiences"
                description="Build custom and lookalike audiences"
                onClick={() => router.push('/dashboard/ad-manager/audiences')}
              />
              <QuickAction
                label="Creative library"
                description="Upload and manage ad images and videos"
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
            </CardBody>
          </Card>

          {/* Account info */}
          <Card>
            <CardBody className="p-4">
              <p className="text-[11px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
                Active account
              </p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--st-text)] truncate">
                {activeAccount.name}
              </p>
              <p className="text-[11px] text-[var(--st-text-secondary)] font-mono">
                {activeAccount.account_id}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

/* quick action row */

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
    <Button
      variant="ghost"
      block
      onClick={onClick}
      className="group h-auto justify-between gap-3 p-2.5 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold text-[var(--st-text)]">{label}</span>
        <span className="block text-[11px] font-normal text-[var(--st-text-secondary)]">
          {description}
        </span>
      </span>
      <ArrowRight
        className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-tertiary)] transition group-hover:translate-x-0.5 group-hover:text-[var(--st-text)]"
        aria-hidden="true"
      />
    </Button>
  );
}
