'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { m } from 'motion/react';
import dynamic from 'next/dynamic';
import {
  ArrowUpRight,
  BookCopy,
  CheckCheck,
  CircleX,
  ChevronDown,
  Download,
  Eye,
  Inbox,
  MessagesSquare,
  Plus,
  RefreshCw,
  Send,
  TrendingUp,
  Users,
  LayoutTemplate,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
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
import {
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuCheckboxItem,
} from '@/components/zoruui';

const OverviewChart = dynamic(() => import('./overview-chart'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full animate-pulse rounded-xl bg-zinc-50" />,
});

/**
 * Wachat Overview - project-scoped dashboard rebuilt on wachat-ui chrome.
 */

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

type WidgetKey = 'kpi' | 'funnel' | 'actions' | 'chart' | 'campaigns';

const DEFAULT_LAYOUT: Record<WidgetKey, boolean> = {
  kpi: true,
  funnel: true,
  actions: true,
  chart: true,
  campaigns: true,
};

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
  const prev7 = points.slice(-14, -7).reduce((s, p) => s + (p.sent || 0), 0);
  if (!prev7) return { delta: last7 > 0 ? 100 : 0, up: true };
  const d = ((last7 - prev7) / prev7) * 100;
  return { delta: Math.round(d * 10) / 10, up: d >= 0 };
}

export default function OverviewPage() {
  const router = useRouter();
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString();

  const [stats, setStats] = useState<Stats | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [broadcasts, setBroadcasts] = useState<RecentBroadcast[]>([]);
  const [loading, startTransition] = useTransition();

  const [layout, setLayout] = useState<Record<WidgetKey, boolean>>(DEFAULT_LAYOUT);

  useEffect(() => {
    document.title = 'Overview · Wachat';
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('wachat-overview-layout');
      if (stored) {
        setLayout({ ...DEFAULT_LAYOUT, ...JSON.parse(stored) });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleWidget = (key: WidgetKey) => {
    setLayout((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('wachat-overview-layout', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const reload = useCallback(() => {
    if (!projectId) return;
    startTransition(() => {
      fetch(`/api/wachat/dashboard?projectId=${projectId}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) {
            setStats(data.stats as Stats);
            setChart((data.chart as ChartPoint[]) || []);
            setBroadcasts(data.broadcasts || []);
          }
        })
        .catch((err) => {
          console.error('Failed to load overview data:', err);
        });
    });
  }, [projectId]);

  const handleRefresh = useCallback(() => {
    router.refresh();
    reload();
  }, [router, reload]);

  useEffect(() => {
    reload();
  }, [reload]);

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
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wachat-overview-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!projectId) {
    return (
      <WaPage>
        <PageHeader
          title="Project overview"
          description="Pick a WhatsApp project to load messaging activity."
          kicker="Overview"
        />
        <EmptyState
          icon={Inbox}
          title="Select a project to continue"
          description="Overview stats are scoped to a single WhatsApp Business project. Pick one from the projects screen."
          action={
            <WaButton onClick={() => router.push('/wachat')} leftIcon={ArrowUpRight}>
              Go to projects
            </WaButton>
          }
        />
      </WaPage>
    );
  }

  return (
    <WaPage>
      <PageHeader
        title="Project overview"
        kicker="Overview"
        description={
          activeProject?.name
            ? `${activeProject.name} · last 30 days of messaging activity.`
            : 'Last 30 days of messaging activity.'
        }
        actions={
          <>
            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <WaButton variant="outline" size="sm" leftIcon={LayoutTemplate} rightIcon={ChevronDown}>
                  Customize
                </WaButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuLabel>Widgets</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuSeparator />
                <ZoruDropdownMenuCheckboxItem checked={layout.kpi} onCheckedChange={() => toggleWidget('kpi')}>
                  KPI grid
                </ZoruDropdownMenuCheckboxItem>
                <ZoruDropdownMenuCheckboxItem checked={layout.funnel} onCheckedChange={() => toggleWidget('funnel')}>
                  Delivery funnel
                </ZoruDropdownMenuCheckboxItem>
                <ZoruDropdownMenuCheckboxItem checked={layout.actions} onCheckedChange={() => toggleWidget('actions')}>
                  Quick actions
                </ZoruDropdownMenuCheckboxItem>
                <ZoruDropdownMenuCheckboxItem checked={layout.chart} onCheckedChange={() => toggleWidget('chart')}>
                  Activity chart
                </ZoruDropdownMenuCheckboxItem>
                <ZoruDropdownMenuCheckboxItem checked={layout.campaigns} onCheckedChange={() => toggleWidget('campaigns')}>
                  Recent campaigns
                </ZoruDropdownMenuCheckboxItem>
              </ZoruDropdownMenuContent>
            </DropdownMenu>
            <WaButton variant="outline" size="sm" onClick={handleRefresh} leftIcon={RefreshCw}>
              Refresh
            </WaButton>
            <WaButton variant="outline" size="sm" onClick={handleExport} leftIcon={Download}>
              Export
            </WaButton>
            <WaButton size="sm" onClick={() => router.push('/wachat/broadcasts')} leftIcon={Plus}>
              New campaign
            </WaButton>
          </>
        }
      />

      {/* KPI grid */}
      {layout.kpi && (
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <MetricTile
            icon={Send}
            label="Messages sent"
            value={compact(stats?.totalSent)}
            delta={
              derived?.trend.delta
                ? { value: `${Math.abs(derived.trend.delta)}%`, positive: derived.trend.up }
                : undefined
            }
            delay={0.02}
          />
          <MetricTile
            icon={CheckCheck}
            label="Delivery rate"
            value={`${derived?.deliveryRate ?? 0}%`}
            delay={0.06}
          />
          <MetricTile icon={Eye} label="Read rate" value={`${derived?.readRate ?? 0}%`} delay={0.1} />
          <MetricTile icon={CircleX} label="Failed" value={compact(stats?.totalFailed)} delay={0.14} />
        </section>
      )}

      {/* Middle row */}
      {(layout.funnel || layout.actions || layout.chart) && (
        <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {layout.funnel && (
            <Section
              title="Delivery funnel"
              description="How messages move through WhatsApp"
              action={
                <WaButton size="sm" variant="ghost" onClick={() => router.push('/wachat/broadcasts')} leftIcon={TrendingUp}>
                  View
                </WaButton>
              }
            >
              <div className="flex flex-col gap-3.5">
                <FunnelBar label="Queued" count={stats?.totalMessages ?? 0} total={stats?.totalMessages ?? 0} />
                <FunnelBar label="Sent" count={stats?.totalSent ?? 0} total={stats?.totalMessages ?? 0} />
                <FunnelBar label="Delivered" count={stats?.totalDelivered ?? 0} total={stats?.totalMessages ?? 0} />
                <FunnelBar label="Read" count={stats?.totalRead ?? 0} total={stats?.totalMessages ?? 0} />
                <FunnelBar label="Failed" count={stats?.totalFailed ?? 0} total={stats?.totalMessages ?? 0} muted />
              </div>
            </Section>
          )}

          {layout.chart && (
            <Section
              title="Messaging activity"
              description="Last 30 days"
              className={
                !layout.funnel && !layout.actions
                  ? 'lg:col-span-3'
                  : layout.funnel && layout.actions
                  ? 'lg:col-span-1'
                  : 'lg:col-span-2'
              }
            >
              <OverviewChart data={chart} />
            </Section>
          )}

          {layout.actions && (
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.08 }}
              className={`flex flex-col gap-2 ${!layout.funnel && !layout.chart ? 'lg:col-span-3' : ''}`}
            >
              {[
                { icon: Inbox, label: 'Open live chat', href: '/wachat/chat' },
                { icon: BookCopy, label: 'Manage templates', href: '/wachat/templates' },
                { icon: Users, label: 'Import contacts', href: '/wachat/contacts' },
                { icon: Send, label: 'Start a broadcast', href: '/wachat/broadcasts', primary: true },
              ].map((item) => (
                <WaButton
                  key={item.label}
                  variant={item.primary ? 'solid' : 'outline'}
                  onClick={() => router.push(item.href)}
                  leftIcon={item.icon}
                  className="w-full justify-start"
                >
                  {item.label}
                </WaButton>
              ))}
              <WaButton
                variant="ghost"
                size="sm"
                onClick={() => router.push('/wachat/integrations')}
                rightIcon={ArrowUpRight}
                className="w-full justify-start"
              >
                Connect an integration
              </WaButton>
            </m.div>
          )}
        </div>
      )}

      {/* Recent campaigns */}
      {layout.campaigns && (
        <Section
          title="Recent campaigns"
          description={`${stats?.totalCampaigns ?? 0} campaigns total · ${broadcasts.length} shown`}
          action={
            <WaButton size="sm" variant="outline" onClick={() => router.push('/wachat/broadcasts')} leftIcon={Plus}>
              New
            </WaButton>
          }
          padded={false}
        >
          {broadcasts.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={MessagesSquare}
                title="No campaigns yet"
                description="Launch your first WhatsApp broadcast to reach your audience."
                action={
                  <WaButton size="sm" onClick={() => router.push('/wachat/broadcasts')} leftIcon={Plus}>
                    Create broadcast
                  </WaButton>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {broadcasts.map((b, i) => {
                const total = b.contactCount ?? 0;
                const delivered = b.deliveredCount ?? 0;
                const rate = pct(delivered, total);
                const s = (b.status || '').toLowerCase();
                const tone: StatusTone =
                  s === 'completed'
                    ? 'sent'
                    : s === 'failed' || s === 'cancelled' || s === 'partial failure'
                    ? 'failed'
                    : s === 'sending'
                    ? 'sending'
                    : 'queued';
                const createdDate = b.createdAt ? new Date(b.createdAt as any) : null;
                return (
                  <m.li
                    key={b._id?.toString?.()}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04, ease: EASE_OUT }}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-zinc-900">
                        {b.fileName || b.templateName || 'Untitled campaign'}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-zinc-500">
                        {b.templateName && (
                          <>
                            <span className="text-zinc-700">{b.templateName}</span>
                            <span>·</span>
                          </>
                        )}
                        <span>
                          {createdDate
                            ? formatDistanceToNow(createdDate, { addSuffix: true })
                            : 'unknown time'}
                        </span>
                        <StatusPill tone={tone}>{b.status || 'unknown'}</StatusPill>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end pr-1 text-[11.5px]">
                        <div className="font-semibold text-zinc-900 tabular-nums">{rate}%</div>
                        <div className="text-zinc-500 tabular-nums">
                          {compact(delivered)}/{compact(total)}
                        </div>
                      </div>
                      <WaButton
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/wachat/broadcasts/${b._id}/report`)}
                        rightIcon={ArrowUpRight}
                      >
                        View
                      </WaButton>
                    </div>
                  </m.li>
                );
              })}
            </ul>
          )}
        </Section>
      )}
    </WaPage>
  );
}

function FunnelBar({
  label,
  count,
  total,
  muted,
}: {
  label: string;
  count: number;
  total: number;
  muted?: boolean;
}) {
  const width = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="font-medium text-zinc-700">{label}</span>
        <span className="text-zinc-500 tabular-nums">
          {count.toLocaleString()} · {width}%
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <m.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="h-full rounded-full"
          style={{ background: muted ? '#d4d4d8' : 'var(--mt-accent)' }}
        />
      </div>
    </div>
  );
}
