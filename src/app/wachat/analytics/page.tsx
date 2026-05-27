'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Activity,
  ArrowDown,
  CircleAlert,
  CheckCheck,
  Eye,
  MessageSquare,
  RefreshCw,
  Send,
  TrendingUp,
  TrendingDown,
  Flame,
  Layers,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { m, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getLocalMessageAnalytics,
  getBroadcastAnalytics,
} from '@/app/actions/whatsapp-analytics.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  StatusPill,
  Tabs,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  useZoruToast,
} from '@/components/zoruui';

/**
 * Wachat Analytics - WhatsApp messaging analytics dashboard.
 */

type AnalyticsData = {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  totalIncoming: number;
  dailyBreakdown: Array<{
    date: string;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    incoming: number;
  }>;
};

type BroadcastData = {
  totalBroadcasts: number;
  totalContacts: number;
  totalSuccess: number;
  totalFailed: number;
  broadcasts: Array<{
    name: string;
    templateName: string;
    contactCount: number;
    successCount: number;
    failedCount: number;
    status: string;
    createdAt: Date;
  }>;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.12)]">
        <p className="mb-2 text-[12.5px] font-semibold text-zinc-900">{label}</p>
        <div className="flex flex-col gap-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-[11.5px]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-zinc-500">{entry.name}:</span>
              <span className="font-medium text-zinc-900 tabular-nums">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

function Sparkline({
  data,
  dataKey,
  color,
}: {
  data: any[];
  dataKey: string;
  color: string;
}) {
  if (data.length < 2) return <div style={{ width: 60, height: 20 }} />;
  return (
    <div style={{ width: 60, height: 20 }} aria-hidden>
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

function trendPct(data: any[], key: string) {
  if (data.length < 14) return null;
  const last7 = data.slice(-7).reduce((s, d) => s + (d[key] || 0), 0);
  const prev7 = data.slice(-14, -7).reduce((s, d) => s + (d[key] || 0), 0);
  if (!prev7) return last7 > 0 ? { value: 100, up: true } : null;
  const d = ((last7 - prev7) / prev7) * 100;
  return { value: Math.round(d * 10) / 10, up: d >= 0 };
}

export default function AnalyticsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const reduceMotion = useReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [broadcastData, setBroadcastData] = useState<BroadcastData | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('all');
  const [yAxisLimit, setYAxisLimit] = useState<string>('auto');

  useEffect(() => {
    document.title = 'Analytics · Wachat';
  }, []);

  const fetchAnalytics = useCallback(() => {
    if (!activeProject?._id) return;

    startTransition(async () => {
      const now = new Date();
      const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      const [localResult, broadcastResult] = await Promise.all([
        getLocalMessageAnalytics(activeProject._id.toString(), startDate, now),
        getBroadcastAnalytics(activeProject._id.toString(), startDate, now),
      ]);

      if (localResult.error) {
        toast({ title: 'Error', description: localResult.error, variant: 'destructive' });
      } else {
        setAnalytics(localResult);
      }

      if (!broadcastResult.error) {
        setBroadcastData(broadcastResult);
      }

      setLastSyncAt(new Date());
    });
  }, [activeProject?._id, dateRange, toast]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const filteredBroadcasts = useMemo(() => {
    if (!broadcastData) return [];
    return broadcastData.broadcasts.filter((b) => {
      if (selectedCampaign !== 'all' && b.name !== selectedCampaign) return false;
      if (selectedTemplate !== 'all' && b.templateName !== selectedTemplate) return false;
      return true;
    });
  }, [broadcastData, selectedCampaign, selectedTemplate]);

  const displayBroadcastData = useMemo(() => {
    if (!broadcastData) return null;
    return {
      totalBroadcasts: filteredBroadcasts.length,
      totalContacts: filteredBroadcasts.reduce((acc, b) => acc + b.contactCount, 0),
      totalSuccess: filteredBroadcasts.reduce((acc, b) => acc + b.successCount, 0),
      totalFailed: filteredBroadcasts.reduce((acc, b) => acc + b.failedCount, 0),
    };
  }, [broadcastData, filteredBroadcasts]);

  // Per-day-of-week volume from daily breakdown
  const dayOfWeekVolume = useMemo(() => {
    if (!analytics) return [];
    const buckets = Array.from({ length: 7 }).map(() => 0);
    analytics.dailyBreakdown.forEach((d) => {
      const dt = new Date(d.date);
      if (Number.isNaN(dt.getTime())) return;
      buckets[dt.getDay()] += d.sent || 0;
    });
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return buckets.map((v, i) => ({ name: names[i], value: v }));
  }, [analytics]);

  const peakDay = useMemo(() => {
    if (!dayOfWeekVolume.length) return null;
    const top = [...dayOfWeekVolume].sort((a, b) => b.value - a.value)[0];
    return top.value > 0 ? top : null;
  }, [dayOfWeekVolume]);

  // Top 5 campaigns by recipients
  const topCampaigns = useMemo(() => {
    return [...filteredBroadcasts]
      .sort((a, b) => b.contactCount - a.contactCount)
      .slice(0, 5);
  }, [filteredBroadcasts]);

  // Top 5 templates by usage
  const topTemplates = useMemo(() => {
    const map = new Map<string, { name: string; sends: number; success: number }>();
    filteredBroadcasts.forEach((b) => {
      const k = b.templateName || 'untitled';
      const cur = map.get(k) || { name: k, sends: 0, success: 0 };
      cur.sends += b.contactCount;
      cur.success += b.successCount;
      map.set(k, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => b.sends - a.sends)
      .slice(0, 5);
  }, [filteredBroadcasts]);

  const sentTrend = useMemo(
    () => (analytics ? trendPct(analytics.dailyBreakdown, 'sent') : null),
    [analytics],
  );
  const deliveredTrend = useMemo(
    () => (analytics ? trendPct(analytics.dailyBreakdown, 'delivered') : null),
    [analytics],
  );
  const readTrend = useMemo(
    () => (analytics ? trendPct(analytics.dailyBreakdown, 'read') : null),
    [analytics],
  );
  const failedTrend = useMemo(
    () => (analytics ? trendPct(analytics.dailyBreakdown, 'failed') : null),
    [analytics],
  );
  const incomingTrend = useMemo(
    () => (analytics ? trendPct(analytics.dailyBreakdown, 'incoming') : null),
    [analytics],
  );

  const statCards = [
    {
      label: 'Messages sent',
      value: analytics?.totalSent ?? 0,
      icon: Send,
      trend: sentTrend,
      sparkKey: 'sent',
      color: '#25D366',
    },
    {
      label: 'Delivered',
      value: analytics?.totalDelivered ?? 0,
      icon: CheckCheck,
      trend: deliveredTrend,
      sparkKey: 'delivered',
      color: '#10b981',
    },
    {
      label: 'Read',
      value: analytics?.totalRead ?? 0,
      icon: Eye,
      trend: readTrend,
      sparkKey: 'read',
      color: '#0d9488',
    },
    {
      label: 'Failed',
      value: analytics?.totalFailed ?? 0,
      icon: CircleAlert,
      trend: failedTrend ? { ...failedTrend, up: !failedTrend.up } : null,
      sparkKey: 'failed',
      color: '#f43f5e',
    },
    {
      label: 'Incoming',
      value: analytics?.totalIncoming ?? 0,
      icon: ArrowDown,
      trend: incomingTrend,
      sparkKey: 'incoming',
      color: '#0ea5e9',
    },
    {
      label: 'Broadcasts',
      value: displayBroadcastData?.totalBroadcasts ?? 0,
      icon: MessageSquare,
      trend: null,
      sparkKey: 'sent',
      color: '#a16207',
    },
  ];

  const peakHeat = Math.max(1, ...dayOfWeekVolume.map((d) => d.value));

  return (
    <WaPage>
      <PageHeader
        title="Message analytics"
        kicker="Analytics"
        description="Track messaging performance, delivery rates, and broadcast metrics."
        eyebrowIcon={Activity}
        actions={
          <>
            {lastSyncAt && (
              <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Synced {Math.max(0, Math.round((Date.now() - lastSyncAt.getTime()) / 1000))}s ago
              </span>
            )}
            <Tabs
              items={[
                { id: '7d', label: '7 days' },
                { id: '30d', label: '30 days' },
                { id: '90d', label: '90 days' },
              ]}
              active={dateRange}
              onChange={(id) => setDateRange(id as '7d' | '30d' | '90d')}
              layoutId="analytics-range"
            />
            <WaButton
              size="sm"
              variant="outline"
              onClick={fetchAnalytics}
              disabled={isPending}
              leftIcon={RefreshCw}
            >
              Refresh
            </WaButton>
          </>
        }
      />

      {/* Filters */}
      <Section title="Filters" description="Narrow analytics by segment.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Agent
            </label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                <SelectItem value="agent-1" disabled>
                  Agent 1 (no data)
                </SelectItem>
                <SelectItem value="agent-2" disabled>
                  Agent 2 (no data)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Campaign
            </label>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger>
                <SelectValue placeholder="All campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {Array.from(new Set(broadcastData?.broadcasts.map((b) => b.name) || [])).map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Template
            </label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="All templates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {Array.from(new Set(broadcastData?.broadcasts.map((b) => b.templateName) || [])).map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Chart Y-axis limit
            </label>
            <Select value={yAxisLimit} onValueChange={setYAxisLimit}>
              <SelectTrigger>
                <SelectValue placeholder="Auto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="500">500</SelectItem>
                <SelectItem value="1000">1,000</SelectItem>
                <SelectItem value="5000">5,000</SelectItem>
                <SelectItem value="10000">10,000</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* Stats grid — 6 tiles with sparklines */}
      <div className="my-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((s, i) => (
          <div key={s.label} className="relative">
            <MetricTile
              label={s.label}
              value={s.value.toLocaleString()}
              icon={s.icon}
              delta={
                s.trend
                  ? { value: `${Math.abs(s.trend.value)}%`, positive: s.trend.up }
                  : undefined
              }
              delay={reduceMotion ? 0 : 0.02 + i * 0.03}
            />
            {analytics && analytics.dailyBreakdown.length > 1 && (
              <div className="pointer-events-none absolute bottom-3 right-3">
                <Sparkline
                  data={analytics.dailyBreakdown.slice(-7)}
                  dataKey={s.sparkKey}
                  color={s.color}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Headline rates */}
      {analytics && analytics.totalSent > 0 && (
        <div className="mb-4">
          <Section title="Delivery performance" description="Headline rates over the selected window.">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  label: 'Delivery rate',
                  value: ((analytics.totalDelivered / analytics.totalSent) * 100).toFixed(1),
                  positive: true,
                  note: `${analytics.totalDelivered.toLocaleString()} of ${analytics.totalSent.toLocaleString()}`,
                },
                {
                  label: 'Read rate',
                  value: ((analytics.totalRead / analytics.totalSent) * 100).toFixed(1),
                  positive: true,
                  note: `${analytics.totalRead.toLocaleString()} of ${analytics.totalSent.toLocaleString()}`,
                },
                {
                  label: 'Failure rate',
                  value: ((analytics.totalFailed / analytics.totalSent) * 100).toFixed(1),
                  positive: false,
                  note: `${analytics.totalFailed.toLocaleString()} failed`,
                },
                {
                  label: 'Reply ratio',
                  value:
                    analytics.totalSent > 0
                      ? ((analytics.totalIncoming / analytics.totalSent) * 100).toFixed(1)
                      : '0',
                  positive: true,
                  note: `${analytics.totalIncoming.toLocaleString()} inbound`,
                },
              ].map((metric) => (
                <div key={metric.label}>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
                    {metric.label}
                  </p>
                  <p
                    className={`text-[26px] font-semibold tabular-nums leading-none ${
                      metric.positive ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {metric.value}%
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500 tabular-nums">{metric.note}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Daily trend */}
      {analytics && analytics.dailyBreakdown.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Section
            title="Daily trend"
            description="Sent, delivered, read, failed."
            className="lg:col-span-2"
          >
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dailyBreakdown} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} />
                  <YAxis
                    stroke="#71717a"
                    tick={{ fontSize: 10 }}
                    domain={[0, yAxisLimit === 'auto' ? 'auto' : parseInt(yAxisLimit)]}
                    allowDataOverflow
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="sent" stroke="#25D366" strokeWidth={2} dot={false} name="Sent" />
                  <Line
                    type="monotone"
                    dataKey="delivered"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    name="Delivered"
                  />
                  <Line
                    type="monotone"
                    dataKey="read"
                    stroke="#0d9488"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    dot={false}
                    name="Read"
                  />
                  <Line type="monotone" dataKey="failed" stroke="#f43f5e" strokeWidth={2} dot={false} name="Failed" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section
            title="Volume by day of week"
            description={
              peakDay
                ? `Peak: ${peakDay.name}`
                : 'Distribution across the week.'
            }
          >
            {dayOfWeekVolume.every((b) => b.value === 0) ? (
              <EmptyState
                icon={Flame}
                title="No volume"
                description="Send messages to see weekday distribution."
              />
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayOfWeekVolume} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
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
                <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-zinc-500">
                  {dayOfWeekVolume.map((d) => (
                    <span key={d.name}>{d.name}</span>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </div>
      )}

      {/* Top campaigns + top templates rails */}
      {filteredBroadcasts.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Section
            title="Top campaigns by volume"
            description="Largest sends in window"
            padded={false}
          >
            <ul className="divide-y divide-zinc-100">
              {topCampaigns.map((b, i) => {
                const successRate =
                  b.contactCount > 0 ? Math.round((b.successCount / b.contactCount) * 100) : 0;
                const tone: StatusTone =
                  b.status === 'completed'
                    ? 'sent'
                    : b.status === 'failed' || b.status === 'cancelled'
                    ? 'failed'
                    : 'queued';
                return (
                  <m.li
                    key={`${b.name}-${i}`}
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
                      <p className="truncate text-[12.5px] font-medium text-zinc-900">{b.name}</p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {b.templateName} · {b.contactCount.toLocaleString()} recipients
                      </p>
                    </div>
                    <StatusPill tone={tone}>{b.status}</StatusPill>
                    <span className="w-10 text-right text-[12.5px] font-semibold tabular-nums text-emerald-600">
                      {successRate}%
                    </span>
                  </m.li>
                );
              })}
            </ul>
          </Section>

          <Section
            title="Top templates"
            description="Most-used templates in window"
            padded={false}
          >
            <ul className="divide-y divide-zinc-100">
              {topTemplates.map((t, i) => {
                const rate = t.sends > 0 ? Math.round((t.success / t.sends) * 100) : 0;
                return (
                  <m.li
                    key={t.name}
                    initial={{ opacity: 0, x: -4 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.03, ease: EASE_OUT }}
                    className="flex items-center gap-3 px-4 py-2"
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-50 text-emerald-700">
                      <Layers className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-zinc-900">{t.name}</p>
                      <p className="truncate text-[11px] text-zinc-500 tabular-nums">
                        {t.sends.toLocaleString()} sends · {t.success.toLocaleString()} delivered
                      </p>
                    </div>
                    <span className="w-10 text-right text-[12.5px] font-semibold tabular-nums text-emerald-600">
                      {rate}%
                    </span>
                  </m.li>
                );
              })}
            </ul>
          </Section>
        </div>
      )}

      {/* Daily breakdown table */}
      {analytics && analytics.dailyBreakdown.length > 0 && (
        <div className="mb-4">
          <Section title="Daily breakdown" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-right">Sent</th>
                    <th className="px-4 py-2 text-right">Delivered</th>
                    <th className="px-4 py-2 text-right">Read</th>
                    <th className="px-4 py-2 text-right">Failed</th>
                    <th className="px-4 py-2 text-right">Incoming</th>
                    <th className="px-4 py-2 text-right">Delivery %</th>
                    <th className="px-4 py-2 text-right">Read %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {analytics.dailyBreakdown
                    .slice()
                    .reverse()
                    .map((day) => {
                      const deliveryPct =
                        day.sent > 0 ? Math.round((day.delivered / day.sent) * 1000) / 10 : 0;
                      const readPct =
                        day.sent > 0 ? Math.round((day.read / day.sent) * 1000) / 10 : 0;
                      return (
                        <tr key={day.date} className="h-9 hover:bg-zinc-50">
                          <td className="px-4 py-1.5 text-zinc-900">{day.date}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums text-zinc-900">{day.sent}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums text-emerald-700">{day.delivered}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums text-teal-700">{day.read}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums text-rose-700">{day.failed}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums text-amber-700">{day.incoming}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums font-semibold text-zinc-900">
                            {deliveryPct}%
                          </td>
                          <td className="px-4 py-1.5 text-right tabular-nums font-semibold text-zinc-900">
                            {readPct}%
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* Broadcast performance */}
      {displayBroadcastData && displayBroadcastData.totalBroadcasts > 0 && (
        <div className="mb-4">
          <Section title="Broadcast performance" description="Filtered campaigns from the date window.">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  label: 'Total campaigns',
                  value: displayBroadcastData.totalBroadcasts.toLocaleString(),
                  tone: 'zinc',
                  icon: TrendingUp,
                },
                {
                  label: 'Total recipients',
                  value: displayBroadcastData.totalContacts.toLocaleString(),
                  tone: 'zinc',
                  icon: MessageSquare,
                },
                {
                  label: 'Successful',
                  value: displayBroadcastData.totalSuccess.toLocaleString(),
                  tone: 'emerald',
                  icon: CheckCheck,
                },
                {
                  label: 'Failed',
                  value: displayBroadcastData.totalFailed.toLocaleString(),
                  tone: 'rose',
                  icon: TrendingDown,
                },
              ].map((metric) => (
                <div key={metric.label}>
                  <p className="mb-1 inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
                    <metric.icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                    {metric.label}
                  </p>
                  <p
                    className={`text-[22px] font-semibold tabular-nums leading-none ${
                      metric.tone === 'emerald'
                        ? 'text-emerald-600'
                        : metric.tone === 'rose'
                        ? 'text-rose-600'
                        : 'text-zinc-950'
                    }`}
                  >
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {!analytics && !isPending && (
        <EmptyState
          icon={Activity}
          title="No analytics yet"
          description="Select a project or send messages to populate this dashboard."
        />
      )}
    </WaPage>
  );
}
