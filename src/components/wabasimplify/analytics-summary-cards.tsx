'use client';

import { Card, Skeleton } from '@/components/zoruui';
import { MousePointerClick, Users, TrendingUp, Globe2 } from 'lucide-react';

interface AnalyticsSummaryCardsProps {
  totalClicks: number;
  uniqueClicks: number;
  clicksToday: number;
  topCountry: string | null;
  isLoading?: boolean;
}

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  sub?: string;
}

function MetricCard({ label, value, icon, sub }: MetricCardProps) {
  return (
    <ZoruCard className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">{label}</p>
          <p className="mt-1.5 text-[26px] leading-tight text-zoru-ink tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 text-[11px] text-zoru-ink-muted">{sub}</p>}
        </div>
        <div className="shrink-0 rounded-lg bg-zoru-surface-2 p-2 text-zoru-ink-muted">
          {icon}
        </div>
      </div>
    </ZoruCard>
  );
}

function SkeletonCard() {
  return (
    <ZoruCard className="p-4">
      <ZoruSkeleton className="h-3 w-24 mb-3" />
      <ZoruSkeleton className="h-8 w-16" />
    </ZoruCard>
  );
}

export function AnalyticsSummaryCards({
  totalClicks,
  uniqueClicks,
  clicksToday,
  topCountry,
  isLoading,
}: AnalyticsSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard
        label="Total Clicks"
        value={totalClicks.toLocaleString()}
        icon={<MousePointerClick className="h-4 w-4" />}
      />
      <MetricCard
        label="Unique Clicks"
        value={uniqueClicks.toLocaleString()}
        icon={<Users className="h-4 w-4" />}
        sub="by IP address"
      />
      <MetricCard
        label="Clicks Today"
        value={clicksToday.toLocaleString()}
        icon={<TrendingUp className="h-4 w-4" />}
      />
      <MetricCard
        label="Top Country"
        value={topCountry ?? '—'}
        icon={<Globe2 className="h-4 w-4" />}
      />
    </div>
  );
}
