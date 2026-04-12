'use client';

/**
 * Wachat Overview — project-scoped dashboard built on Clay primitives.
 *
 * Shows WhatsApp messaging performance for the currently selected
 * project: total messages, delivery funnel, recent campaigns, and
 * quick actions. All data is real — pulled from getDashboardStats +
 * getBroadcasts via the selected project's _id.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  LuSend,
  LuCheckCheck,
  LuEye,
  LuCircleX,
  LuMessagesSquare,
  LuChevronDown,
  LuDownload,
  LuRefreshCw,
  LuPlus,
  LuArrowUpRight,
  LuTrendingUp,
  LuTrendingDown,
  LuInbox,
  LuBookCopy,
  LuUsers,
  LuEllipsis,
} from 'react-icons/lu';

import { cn } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import {
  getDashboardStats,
  getDashboardChartData,
} from '@/app/actions/dashboard.actions';
import { getBroadcasts } from '@/app/actions/broadcast.actions';
import {
  ClayBreadcrumbs,
  ClayButton,
  ClayCard,
  ClayListRow,
  ClayNotificationCard,
} from '@/components/clay';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ── types ──────────────────────────────────────────────────────── */

type Stats = {
  totalMessages: number;
  totalSent: number;
  totalFailed: number;
  totalDelivered: number;
  totalRead: number;
  totalCampaigns: number;
};

type ChartPoint = {
  date: string;
  sent: number;
  delivered: number;
  read: number;
};

type RecentBroadcast = {
  _id: any;
  fileName?: string;
  templateName?: string;
  contactCount?: number;
  successCount?: number;
  deliveredCount?: number;
  readCount?: number;
  errorCount?: number;
  status?: string;
  createdAt?: string | Date;
};

/* ── helpers ────────────────────────────────────────────────────── */

function compact(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

function trend7d(points: ChartPoint[]): { delta: number; up: boolean } {
  if (points.length < 14) return { delta: 0, up: true };
  const last7 = points.slice(-7).reduce((s, p) => s + (p.sent || 0), 0);
  const prev7 = points
    .slice(-14, -7)
    .reduce((s, p) => s + (p.sent || 0), 0);
  if (!prev7) return { delta: last7 > 0 ? 100 : 0, up: true };
  const d = ((last7 - prev7) / prev7) * 100;
  return { delta: Math.round(d * 10) / 10, up: d >= 0 };
}

/* ── page ───────────────────────────────────────────────────────── */

export default function OverviewPage() {
  const router = useRouter();
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString();

  const [stats, setStats] = useState<Stats | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [broadcasts, setBroadcasts] = useState<RecentBroadcast[]>([]);
  const [loading, startTransition] = useTransition();

  const fetch = React.useCallback(() => {
    if (!projectId) return;
    startTransition(() => {
      Promise.all([
        getDashboardStats(projectId),
        getDashboardChartData(projectId),
        getBroadcasts(projectId, 1, 6),
      ]).then(([s, c, b]) => {
        setStats(s);
        setChart((c as ChartPoint[]) || []);
        setBroadcasts(b.broadcasts || []);
      });
    });
  }, [projectId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const derived = useMemo(() => {
    if (!stats) return null;
    return {
      deliveryRate: pct(stats.totalDelivered, stats.totalSent),
      readRate: pct(stats.totalRead, stats.totalDelivered),
      failRate: pct(stats.totalFailed, stats.totalMessages),
      trend: trend7d(chart),
    };
  }, [stats, chart]);

  const handleExport = () => {
    if (!stats) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      project: activeProject?.name,
      projectId,
      stats,
      chart,
      recentBroadcasts: broadcasts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wachat-overview-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-3 w-52 animate-pulse rounded-full bg-clay-bg-2" />
        <div className="h-9 w-64 animate-pulse rounded-md bg-clay-bg-2" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[118px] animate-pulse rounded-[14px] bg-clay-bg-2"
            />
          ))}
        </div>
        <div className="h-[260px] animate-pulse rounded-clay-lg bg-clay-bg-2" />
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      {/* Breadcrumb */}
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Overview' },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
            Project overview
          </h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">
            {activeProject?.name
              ? `${activeProject.name} · Last 30 days of messaging activity`
              : 'Last 30 days of messaging activity'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ClayButton
                variant="pill"
                size="md"
                trailing={<LuChevronDown className="h-3 w-3 opacity-60" />}
              >
                Last 30 days
              </ClayButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Time range</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={fetch}>Refresh now</DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => router.push('/dashboard/analytics')}
              >
                Open analytics
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ClayButton
            variant="pill"
            size="md"
            leading={<LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />}
            onClick={fetch}
          >
            Refresh
          </ClayButton>
          <ClayButton
            variant="pill"
            size="md"
            leading={<LuDownload className="h-3.5 w-3.5" strokeWidth={2} />}
            onClick={handleExport}
          >
            Export
          </ClayButton>
          <ClayButton
            variant="obsidian"
            size="md"
            className="px-5"
            leading={<LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            onClick={() => router.push('/dashboard/broadcasts')}
          >
            New campaign
          </ClayButton>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi
          icon={<LuSend className="h-4 w-4" strokeWidth={2} />}
          label="Messages sent"
          value={compact(stats?.totalSent)}
          hint={`${compact(stats?.totalMessages)} total`}
          delta={derived?.trend.delta}
          up={derived?.trend.up}
          accent="green"
        />
        <Kpi
          icon={<LuCheckCheck className="h-4 w-4" strokeWidth={2} />}
          label="Delivery rate"
          value={`${derived?.deliveryRate ?? 0}%`}
          hint={`${compact(stats?.totalDelivered)} delivered`}
          accent="teal"
        />
        <Kpi
          icon={<LuEye className="h-4 w-4" strokeWidth={2} />}
          label="Read rate"
          value={`${derived?.readRate ?? 0}%`}
          hint={`${compact(stats?.totalRead)} read`}
          accent="indigo"
        />
        <Kpi
          icon={<LuCircleX className="h-4 w-4" strokeWidth={2} />}
          label="Failed"
          value={compact(stats?.totalFailed)}
          hint={`${derived?.failRate ?? 0}% fail rate`}
          accent="rose"
        />
      </div>

      {/* Funnel + quick actions row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Funnel card */}
        <ClayCard padded={false} className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] font-semibold text-clay-ink">
                Delivery funnel
              </div>
              <div className="mt-1 text-[11.5px] text-clay-ink-muted">
                How your messages moved through WhatsApp
              </div>
            </div>
            <ClayButton
              variant="pill"
              size="sm"
              leading={<LuTrendingUp className="h-3 w-3" strokeWidth={2.5} />}
              onClick={() => router.push('/dashboard/broadcasts')}
            >
              Campaigns
            </ClayButton>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <FunnelBar
              label="Queued"
              count={stats?.totalMessages ?? 0}
              total={stats?.totalMessages ?? 0}
              color="bg-clay-ink/70"
            />
            <FunnelBar
              label="Sent"
              count={stats?.totalSent ?? 0}
              total={stats?.totalMessages ?? 0}
              color="bg-clay-blue"
            />
            <FunnelBar
              label="Delivered"
              count={stats?.totalDelivered ?? 0}
              total={stats?.totalMessages ?? 0}
              color="bg-clay-green"
            />
            <FunnelBar
              label="Read"
              count={stats?.totalRead ?? 0}
              total={stats?.totalMessages ?? 0}
              color="bg-clay-amber"
            />
            <FunnelBar
              label="Failed"
              count={stats?.totalFailed ?? 0}
              total={stats?.totalMessages ?? 0}
              color="bg-clay-red"
            />
          </div>
        </ClayCard>

        {/* Quick actions rail */}
        <div className="flex flex-col gap-2">
          <ClayNotificationCard
            icon={<LuInbox className="h-3.5 w-3.5" strokeWidth={2} />}
            title="Open Live Chat"
            onClick={() => router.push('/dashboard/chat')}
          />
          <ClayNotificationCard
            icon={<LuBookCopy className="h-3.5 w-3.5" strokeWidth={2} />}
            title="Manage templates"
            onClick={() => router.push('/dashboard/templates')}
          />
          <ClayNotificationCard
            icon={<LuUsers className="h-3.5 w-3.5" strokeWidth={2} />}
            title="Import contacts"
            onClick={() => router.push('/dashboard/contacts')}
          />
          <ClayNotificationCard
            icon={<LuSend className="h-3.5 w-3.5" strokeWidth={2} />}
            title="Start a broadcast"
            tone="obsidian"
            onClick={() => router.push('/dashboard/broadcasts')}
          />
          <button
            type="button"
            onClick={() => router.push('/dashboard/integrations')}
            className="mt-1.5 flex items-center justify-between px-2 text-[11.5px] text-clay-ink-muted hover:text-clay-ink transition-colors"
          >
            <span>Connect an integration</span>
            <LuArrowUpRight className="h-3 w-3" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Recent campaigns */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-clay-ink leading-none">
              Recent Campaigns
            </h2>
            <p className="mt-1.5 text-[12.5px] text-clay-ink-muted">
              {stats?.totalCampaigns ?? 0} campaigns all-time ·{' '}
              {broadcasts.length} shown
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ClayButton
              variant="pill"
              size="icon"
              aria-label="New campaign"
              onClick={() => router.push('/dashboard/broadcasts')}
            >
              <LuPlus className="h-4 w-4" />
            </ClayButton>
            <ClayButton
              variant="pill"
              size="icon"
              aria-label="More"
              onClick={() => router.push('/dashboard/broadcasts')}
            >
              <LuEllipsis className="h-4 w-4" />
            </ClayButton>
          </div>
        </div>

        <ClayCard padded={false} className="mt-5 p-6">
          {broadcasts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-clay-md border border-dashed border-clay-border bg-clay-surface-2 px-4 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-bg text-clay-ink-muted">
                <LuMessagesSquare className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div className="text-[13px] font-semibold text-clay-ink">
                No campaigns yet
              </div>
              <div className="max-w-[340px] text-[11.5px] text-clay-ink-muted">
                Launch your first WhatsApp broadcast to reach your audience.
              </div>
              <ClayButton
                variant="rose"
                size="sm"
                onClick={() => router.push('/dashboard/broadcasts')}
                className="mt-1"
              >
                Create broadcast
              </ClayButton>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {broadcasts.map((b, i) => {
                const total = b.contactCount ?? 0;
                const delivered = b.deliveredCount ?? 0;
                const rate = pct(delivered, total);
                const statusTone =
                  (b.status || '').toLowerCase() === 'completed'
                    ? 'bg-clay-green'
                    : (b.status || '').toLowerCase() === 'failed'
                      ? 'bg-clay-red'
                      : 'bg-clay-amber';
                const createdDate = b.createdAt
                  ? new Date(b.createdAt as any)
                  : null;
                return (
                  <ClayListRow
                    key={b._id?.toString?.() ?? i}
                    index={i + 1}
                    title={b.fileName || b.templateName || 'Untitled campaign'}
                    meta={
                      <span className="flex items-center gap-2">
                        {b.templateName ? (
                          <span className="font-medium text-clay-ink-2">
                            {b.templateName}
                          </span>
                        ) : null}
                        {b.templateName ? (
                          <span className="text-clay-ink-fade">·</span>
                        ) : null}
                        <span>
                          {createdDate
                            ? formatDistanceToNow(createdDate, {
                                addSuffix: true,
                              })
                            : 'unknown time'}
                        </span>
                        <span className="text-clay-ink-fade">·</span>
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              statusTone,
                            )}
                          />
                          {b.status || 'unknown'}
                        </span>
                      </span>
                    }
                    trailing={
                      <>
                        <div className="flex flex-col items-end pr-1 text-[11.5px]">
                          <div className="font-semibold text-clay-ink">
                            {rate}%
                          </div>
                          <div className="text-clay-ink-muted">
                            {compact(delivered)}/{compact(total)}
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label="View broadcast"
                          onClick={() =>
                            router.push(
                              `/dashboard/broadcasts/${b._id}/report`,
                            )
                          }
                          className="flex h-7 w-7 items-center justify-center rounded-md text-clay-ink-muted hover:bg-clay-bg-2 hover:text-clay-ink transition-colors"
                        >
                          <LuArrowUpRight
                            className="h-3.5 w-3.5"
                            strokeWidth={1.75}
                          />
                        </button>
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
        </ClayCard>
      </div>

      <div className="h-6" />
    </div>
  );
}

/* ── helper components ──────────────────────────────────────────── */

type KpiAccent =
  | 'rose'
  | 'green'
  | 'teal'
  | 'indigo'
  | 'blue'
  | 'amber'
  | 'violet';

const kpiAccent: Record<KpiAccent, string> = {
  rose: 'bg-clay-rose-soft text-clay-rose-ink',
  green: 'bg-[#DCFCE7] text-[#166534]',
  teal: 'bg-[#CCFBF1] text-[#115E59]',
  indigo: 'bg-[#E0E7FF] text-[#3730A3]',
  blue: 'bg-[#DBEAFE] text-[#1E40AF]',
  amber: 'bg-[#FEF3C7] text-[#92400E]',
  violet: 'bg-[#EEE8FF] text-[#5B21B6]',
};

function Kpi({
  icon,
  label,
  value,
  hint,
  delta,
  up,
  accent = 'rose',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  up?: boolean;
  accent?: KpiAccent;
}) {
  return (
    <div className="rounded-[14px] border border-clay-border bg-clay-surface p-4 transition-[border-color,box-shadow] hover:border-clay-border-strong hover:shadow-clay-card">
      <div className="flex items-start justify-between">
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-[10px]',
            kpiAccent[accent],
          )}
        >
          <span className="flex h-4 w-4 items-center justify-center">
            {icon}
          </span>
        </span>
        {delta !== undefined ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[10px] font-semibold leading-none',
              up
                ? 'bg-clay-green-soft text-clay-green'
                : 'bg-clay-red-soft text-clay-red',
            )}
          >
            {up ? (
              <LuTrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} />
            ) : (
              <LuTrendingDown className="h-2.5 w-2.5" strokeWidth={2.5} />
            )}
            {Math.abs(delta)}%
          </span>
        ) : null}
      </div>
      <div className="mt-3.5 text-[11.5px] font-medium text-clay-ink-muted leading-none">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.01em] text-clay-ink leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] text-clay-ink-muted leading-tight truncate">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function FunnelBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const width = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="font-medium text-clay-ink">{label}</span>
        <span className="text-clay-ink-muted">
          {count.toLocaleString()} · {width}%
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-clay-bg-2">
        <div
          className={cn('h-full rounded-full transition-[width]', color)}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
