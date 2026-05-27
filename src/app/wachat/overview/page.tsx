'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { m, useReducedMotion } from 'motion/react';
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
  Activity,
  Clock,
  Flame,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';

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

// Tiny sparkline bound to the last N days of a chart series.
function Sparkline({
  points,
  dataKey = 'sent',
  color = '#25D366',
  width = 64,
  height = 20,
}: {
  points: ChartPoint[];
  dataKey?: 'sent' | 'delivered' | 'read';
  color?: string;
  width?: number;
  height?: number;
}) {
  const data = points.slice(-7);
  if (data.length < 2) return <div style={{ width, height }} />;
  return (
    <div style={{ width, height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString();
  const reduceMotion = useReducedMotion();

  const [stats, setStats] = useState<Stats | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [broadcasts, setBroadcasts] = useState<RecentBroadcast[]>([]);
  const [loading, startTransition] = useTransition();
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

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
            setLastSyncAt(new Date());
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
      respondedRate: pct(stats.totalRead, stats.totalSent),
      trend: trend7d(chart),
    };
  }, [stats, chart]);

  // 7-day delivery sparkline trends per metric
  const deliveredTrend = useMemo(() => {
    if (chart.length < 14) return { delta: 0, up: true };
    const last7 = chart.slice(-7).reduce((s, p) => s + (p.delivered || 0), 0);
    const prev7 = chart.slice(-14, -7).reduce((s, p) => s + (p.delivered || 0), 0);
    if (!prev7) return { delta: last7 > 0 ? 100 : 0, up: true };
    const d = ((last7 - prev7) / prev7) * 100;
    return { delta: Math.round(d * 10) / 10, up: d >= 0 };
  }, [chart]);

  const readTrend = useMemo(() => {
    if (chart.length < 14) return { delta: 0, up: true };
    const last7 = chart.slice(-7).reduce((s, p) => s + (p.read || 0), 0);
    const prev7 = chart.slice(-14, -7).reduce((s, p) => s + (p.read || 0), 0);
    if (!prev7) return { delta: last7 > 0 ? 100 : 0, up: true };
    const d = ((last7 - prev7) / prev7) * 100;
    return { delta: Math.round(d * 10) / 10, up: d >= 0 };
  }, [chart]);

  // Per-day-of-week heatmap built from chart series
  const dayOfWeekVolume = useMemo(() => {
    const buckets = Array.from({ length: 7 }).map(() => 0);
    chart.forEach((p) => {
      if (!p.date) return;
      const d = new Date(p.date);
      if (Number.isNaN(d.getTime())) return;
      buckets[d.getDay()] += p.sent || 0;
    });
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return buckets.map((v, i) => ({ name: names[i], value: v }));
  }, [chart]);

  const peakDay = useMemo(() => {
    if (!dayOfWeekVolume.length) return null;
    const top = [...dayOfWeekVolume].sort((a, b) => b.value - a.value)[0];
    return top.value > 0 ? top : null;
  }, [dayOfWeekVolume]);

  // Broadcast status breakdown (real data only)
  const broadcastStatusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    broadcasts.forEach((b) => {
      const k = (b.status || 'unknown').toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [broadcasts]);

  // Top 5 broadcasts by delivery rate (must have recipients)
  const topBroadcasts = useMemo(() => {
    return [...broadcasts]
      .filter((b) => (b.contactCount ?? 0) > 0)
      .map((b) => ({
        ...b,
        _rate: pct(b.deliveredCount ?? 0, b.contactCount ?? 0),
      }))
      .sort((a, b) => b._rate - a._rate)
      .slice(0, 5);
  }, [broadcasts]);

  // Slowest / most-failed broadcasts (real data — errorCount field)
  const failingBroadcasts = useMemo(() => {
    return [...broadcasts]
      .filter((b) => (b.errorCount ?? 0) > 0)
      .sort((a, b) => (b.errorCount ?? 0) - (a.errorCount ?? 0))
      .slice(0, 5);
  }, [broadcasts]);

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

  const peakHeat = Math.max(1, ...dayOfWeekVolume.map((d) => d.value));

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
            {lastSyncAt && (
              <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Synced {formatDistanceToNow(lastSyncAt, { addSuffix: true })}
              </span>
            )}
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

      {/* KPI grid — 6 tiles with sparklines */}
      {layout.kpi && (
        <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="relative">
            <MetricTile
              icon={Send}
              label="Messages sent"
              value={compact(stats?.totalSent)}
              delta={
                derived?.trend.delta
                  ? { value: `${Math.abs(derived.trend.delta)}%`, positive: derived.trend.up }
                  : undefined
              }
              delay={reduceMotion ? 0 : 0.02}
            />
            <div className="pointer-events-none absolute bottom-3 right-3">
              <Sparkline points={chart} dataKey="sent" color="#25D366" />
            </div>
          </div>
          <div className="relative">
            <MetricTile
              icon={CheckCheck}
              label="Delivery rate"
              value={`${derived?.deliveryRate ?? 0}%`}
              delta={
                deliveredTrend.delta
                  ? { value: `${Math.abs(deliveredTrend.delta)}%`, positive: deliveredTrend.up }
                  : undefined
              }
              delay={reduceMotion ? 0 : 0.04}
            />
            <div className="pointer-events-none absolute bottom-3 right-3">
              <Sparkline points={chart} dataKey="delivered" color="#10b981" />
            </div>
          </div>
          <div className="relative">
            <MetricTile
              icon={Eye}
              label="Read rate"
              value={`${derived?.readRate ?? 0}%`}
              delta={
                readTrend.delta
                  ? { value: `${Math.abs(readTrend.delta)}%`, positive: readTrend.up }
                  : undefined
              }
              delay={reduceMotion ? 0 : 0.06}
            />
            <div className="pointer-events-none absolute bottom-3 right-3">
              <Sparkline points={chart} dataKey="read" color="#0d9488" />
            </div>
          </div>
          <MetricTile
            icon={CircleX}
            label="Failed"
            value={compact(stats?.totalFailed)}
            delta={
              derived?.failRate
                ? { value: `${derived.failRate}%`, positive: false }
                : undefined
            }
            delay={reduceMotion ? 0 : 0.08}
          />
          <MetricTile
            icon={MessagesSquare}
            label="Campaigns"
            value={compact(stats?.totalCampaigns)}
            delay={reduceMotion ? 0 : 0.1}
          />
          <MetricTile
            icon={Activity}
            label="Read-through"
            value={`${derived?.respondedRate ?? 0}%`}
            delay={reduceMotion ? 0 : 0.12}
          />
        </section>
      )}

      {/* Funnel + chart + actions row */}
      {(layout.funnel || layout.actions || layout.chart) && (
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {layout.funnel && (
            <Section
              title="Delivery funnel"
              description="Sent → delivered → read → failed"
              action={
                <WaButton size="sm" variant="ghost" onClick={() => router.push('/wachat/broadcasts')} leftIcon={TrendingUp}>
                  View
                </WaButton>
              }
            >
              <div className="flex flex-col gap-2.5">
                <FunnelBar label="Queued" count={stats?.totalMessages ?? 0} total={stats?.totalMessages ?? 0} />
                <FunnelBar
                  label="Sent"
                  count={stats?.totalSent ?? 0}
                  total={stats?.totalMessages ?? 0}
                  trail={stats?.totalMessages ?? 0}
                />
                <FunnelBar
                  label="Delivered"
                  count={stats?.totalDelivered ?? 0}
                  total={stats?.totalMessages ?? 0}
                  trail={stats?.totalSent ?? 0}
                />
                <FunnelBar
                  label="Read"
                  count={stats?.totalRead ?? 0}
                  total={stats?.totalMessages ?? 0}
                  trail={stats?.totalDelivered ?? 0}
                />
                <FunnelBar
                  label="Failed"
                  count={stats?.totalFailed ?? 0}
                  total={stats?.totalMessages ?? 0}
                  muted
                />
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

      {/* Volume-by-day heatmap + side rails */}
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Section
          title="Volume by day of week"
          description={
            peakDay
              ? `Peak: ${peakDay.name} · ${compact(peakDay.value)} messages`
              : 'Heat-mapped send distribution.'
          }
          className="lg:col-span-2"
        >
          {dayOfWeekVolume.every((b) => b.value === 0) ? (
            <EmptyState
              icon={Flame}
              title="No volume yet"
              description="Daily distribution appears once you send messages."
            />
          ) : (
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfWeekVolume} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {dayOfWeekVolume.map((entry, i) => {
                      const ratio = entry.value / peakHeat;
                      const fill =
                        ratio > 0.75
                          ? '#059669'
                          : ratio > 0.5
                          ? '#10b981'
                          : ratio > 0.25
                          ? '#34d399'
                          : ratio > 0
                          ? '#a7f3d0'
                          : '#e4e4e7';
                      return <Cell key={i} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-1 grid grid-cols-7 text-center text-[10px] font-semibold text-zinc-500">
                {dayOfWeekVolume.map((d) => (
                  <span key={d.name}>{d.name}</span>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="Campaign mix" description="Recent campaign statuses">
          {broadcastStatusBreakdown.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No campaigns"
              description="Launch a broadcast to see status mix."
            />
          ) : (
            <ul className="space-y-2">
              {broadcastStatusBreakdown.map(([status, count]) => {
                const s = status.toLowerCase();
                const tone: StatusTone =
                  s === 'completed'
                    ? 'sent'
                    : s === 'failed' || s === 'cancelled' || s === 'partial failure'
                    ? 'failed'
                    : s === 'sending'
                    ? 'sending'
                    : 'queued';
                const max = Math.max(...broadcastStatusBreakdown.map(([, c]) => c));
                const width = max ? Math.round((count / max) * 100) : 0;
                return (
                  <li key={status} className="flex items-center gap-2.5">
                    <StatusPill tone={tone}>{status}</StatusPill>
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <m.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.4, ease: EASE_OUT }}
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ background: 'var(--mt-accent)' }}
                      />
                    </div>
                    <span className="w-7 text-right text-[11.5px] font-semibold tabular-nums text-zinc-900">
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      {/* Top broadcasts + failing broadcasts rails */}
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Section
          title="Top broadcasts by delivery"
          description="Best-performing recent sends"
          padded={false}
        >
          {topBroadcasts.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={TrendingUp}
                title="No delivery data"
                description="Top broadcasts appear once campaigns complete."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {topBroadcasts.map((b, i) => (
                <m.li
                  key={b._id?.toString?.()}
                  initial={{ opacity: 0, x: -4 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.03, ease: EASE_OUT }}
                  className="flex items-center gap-3 px-4 py-2"
                >
                  <span className="w-5 text-center text-[11px] font-semibold tabular-nums text-zinc-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-zinc-900">
                      {b.fileName || b.templateName || 'Untitled campaign'}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {compact(b.deliveredCount ?? 0)} / {compact(b.contactCount ?? 0)} recipients
                    </p>
                  </div>
                  <span className="text-[12.5px] font-semibold tabular-nums text-emerald-600">
                    {b._rate}%
                  </span>
                </m.li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Broadcasts with failures"
          description="Campaigns that need attention"
          padded={false}
        >
          {failingBroadcasts.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={CheckCheck}
                title="No failures recorded"
                description="Recent campaigns are clean."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {failingBroadcasts.map((b, i) => (
                <m.li
                  key={b._id?.toString?.()}
                  initial={{ opacity: 0, x: -4 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.03, ease: EASE_OUT }}
                  className="flex items-center gap-3 px-4 py-2"
                >
                  <AlertTriangle
                    className="h-3.5 w-3.5 shrink-0 text-rose-500"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-zinc-900">
                      {b.fileName || b.templateName || 'Untitled campaign'}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {compact(b.errorCount ?? 0)} failed of {compact(b.contactCount ?? 0)}
                    </p>
                  </div>
                  <span className="text-[12.5px] font-semibold tabular-nums text-rose-600">
                    {pct(b.errorCount ?? 0, b.contactCount ?? 0)}%
                  </span>
                </m.li>
              ))}
            </ul>
          )}
        </Section>
      </div>

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
                const failed = b.errorCount ?? 0;
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
                    transition={{ duration: 0.3, delay: i * 0.03, ease: EASE_OUT }}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-zinc-900">
                        {b.fileName || b.templateName || 'Untitled campaign'}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-zinc-500">
                        {b.templateName && (
                          <>
                            <span className="text-zinc-700">{b.templateName}</span>
                            <span>·</span>
                          </>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                          {createdDate
                            ? formatDistanceToNow(createdDate, { addSuffix: true })
                            : 'unknown time'}
                        </span>
                        <StatusPill tone={tone}>{b.status || 'unknown'}</StatusPill>
                        {failed > 0 && (
                          <StatusPill tone="failed">{compact(failed)} failed</StatusPill>
                        )}
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
  trail,
  muted,
}: {
  label: string;
  count: number;
  total: number;
  trail?: number;
  muted?: boolean;
}) {
  const width = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  const stepPct = trail && trail > 0 ? Math.round((count / trail) * 1000) / 10 : null;
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="font-medium text-zinc-700">{label}</span>
        <span className="text-zinc-500 tabular-nums">
          {count.toLocaleString()} · {width}%
          {stepPct !== null && (
            <span className="ml-1.5 text-emerald-600">({stepPct}% step)</span>
          )}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
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
