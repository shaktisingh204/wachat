'use client';

import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Clock,
  Download,
  Image as ImageIcon,
  Inbox,
  Loader2,
  MessageSquare,
  Percent,
  Flame,
  TrendingUp,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import { getMessageAnalytics, getMessageStatistics } from '@/app/actions/wachat-features.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  StatusPill,
  Tabs,
} from '@/components/wachat-ui';
import {
  useZoruToast,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from '@/components/zoruui';

/**
 * Wachat Message Statistics - outgoing vs incoming volume dashboard,
 * rebuilt on wachat-ui chrome.
 */

type Period = 'daily' | 'weekly' | 'monthly';

const PERIOD_TABS = [
  { id: 'daily', label: '24 hours' },
  { id: 'weekly', label: '7 days' },
  { id: 'monthly', label: '30 days' },
];

type DailyRow = { date: string; outgoing: number; incoming: number };

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

export default function MessageStatisticsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const reduceMotion = useReducedMotion();

  const [period, setPeriod] = useState<Period>('weekly');
  const [stats, setStats] = useState({ total: 0, incoming: 0, outgoing: 0, media: 0 });
  const [deltas, setDeltas] = useState({ total: 0, incoming: 0, outgoing: 0 });
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [avgMs, setAvgMs] = useState(0);
  const [isLoading, startTransition] = useTransition();
  const [exportOpen, setExportOpen] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  useEffect(() => {
    document.title = 'Message statistics · Wachat';
  }, []);

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;

      const [statsRes, currentRes, prevRes] = await Promise.all([
        getMessageStatistics(projectId, period),
        getMessageAnalytics(projectId, days),
        getMessageAnalytics(projectId, days * 2),
      ]);

      if (statsRes.error || currentRes.error || prevRes.error) {
        toast({ title: 'Error', description: 'Failed to load analytics data.', variant: 'destructive' });
        return;
      }

      const currentStats = statsRes.stats || { total: 0, incoming: 0, outgoing: 0, media: 0 };
      setStats(currentStats);

      const map = new Map<string, { out: number; inc: number }>();
      (currentRes.dailyData ?? []).forEach((d: any) => {
        const key = d._id.date;
        const cur = map.get(key) || { out: 0, inc: 0 };
        if (d._id.direction === 'out') cur.out += d.count;
        else cur.inc += d.count;
        map.set(key, cur);
      });
      const builtRows = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, outgoing: v.out, incoming: v.inc }));
      setDailyRows(builtRows);

      setAvgMs(currentRes.responseMetrics?.avgResponseMs ?? 0);

      let total2xOut = 0;
      let total2xInc = 0;
      (prevRes.dailyData ?? []).forEach((d: any) => {
        if (d._id.direction === 'out') total2xOut += d.count;
        else total2xInc += d.count;
      });

      const prevOut = Math.max(0, total2xOut - currentStats.outgoing);
      const prevInc = Math.max(0, total2xInc - currentStats.incoming);
      const prevTotal = prevOut + prevInc;

      const calcDelta = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return ((curr - prev) / prev) * 100;
      };

      setDeltas({
        total: calcDelta(currentStats.total, prevTotal),
        incoming: calcDelta(currentStats.incoming, prevInc),
        outgoing: calcDelta(currentStats.outgoing, prevOut),
      });

      setLastSyncAt(new Date());
    });
  }, [projectId, period, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const histogramData = [
    { name: 'Incoming', value: stats.incoming },
    { name: 'Outgoing', value: stats.outgoing },
    { name: 'Media', value: stats.media },
  ];

  const isEmpty = !isLoading && stats.total === 0;

  // Day-of-week distribution of total volume
  const dayOfWeekVolume = useMemo(() => {
    const buckets = Array.from({ length: 7 }).map(() => 0);
    dailyRows.forEach((r) => {
      const dt = new Date(r.date);
      if (Number.isNaN(dt.getTime())) return;
      buckets[dt.getDay()] += r.outgoing + r.incoming;
    });
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return buckets.map((v, i) => ({ name: names[i], value: v }));
  }, [dailyRows]);

  const peakDay = useMemo(() => {
    if (!dayOfWeekVolume.length) return null;
    const top = [...dayOfWeekVolume].sort((a, b) => b.value - a.value)[0];
    return top.value > 0 ? top : null;
  }, [dayOfWeekVolume]);

  const peakHeat = Math.max(1, ...dayOfWeekVolume.map((d) => d.value));

  const totalsRow = useMemo(() => {
    return dailyRows.reduce(
      (acc, r) => ({
        out: acc.out + r.outgoing,
        inc: acc.inc + r.incoming,
      }),
      { out: 0, inc: 0 },
    );
  }, [dailyRows]);

  const ratio = useMemo(() => {
    const total = totalsRow.out + totalsRow.inc;
    if (!total) return { out: 0, inc: 0 };
    return {
      out: Math.round((totalsRow.out / total) * 1000) / 10,
      inc: Math.round((totalsRow.inc / total) * 1000) / 10,
    };
  }, [totalsRow]);

  const mediaRate = stats.total > 0 ? Math.round((stats.media / stats.total) * 1000) / 10 : 0;

  const fmtTime = (ms: number) => {
    if (!ms) return '--';
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const handleExport = useCallback(() => {
    const header = ['date', 'outgoing', 'incoming', 'total'].join(',');
    const body = dailyRows
      .map((r) => [r.date, r.outgoing, r.incoming, r.outgoing + r.incoming].join(','))
      .join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `message-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }, [dailyRows]);

  const fmtDelta = (v: number) =>
    v === 0 ? undefined : { value: `${Math.abs(v).toFixed(1)}%`, positive: v >= 0 };

  // Busiest day in the actual range
  const busiestDay = useMemo(() => {
    if (!dailyRows.length) return null;
    return [...dailyRows].sort(
      (a, b) => b.outgoing + b.incoming - (a.outgoing + a.incoming),
    )[0];
  }, [dailyRows]);

  return (
    <WaPage>
      <PageHeader
        title="Message statistics"
        kicker="Dashboard"
        description="Monitor message volume and track trends over time."
        eyebrowIcon={BarChart3}
        actions={
          <>
            {lastSyncAt && (
              <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Synced {Math.max(0, Math.round((Date.now() - lastSyncAt.getTime()) / 1000))}s ago
              </span>
            )}
            <Tabs
              items={PERIOD_TABS}
              active={period}
              onChange={(id) => setPeriod(id as Period)}
              layoutId="msgstats-period"
            />
            <WaButton
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
              disabled={dailyRows.length === 0}
              leftIcon={Download}
            >
              Export
            </WaButton>
          </>
        }
      />

      {isLoading && stats.total === 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : (
        <>
          {/* 6-tile KPI strip */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div className="relative">
              <MetricTile
                label="Total messages"
                value={stats.total.toLocaleString()}
                delta={fmtDelta(deltas.total)}
                icon={MessageSquare}
                delay={reduceMotion ? 0 : 0.02}
              />
              <div className="pointer-events-none absolute bottom-3 right-3">
                <Sparkline
                  data={dailyRows.slice(-7).map((r) => ({ ...r, total: r.outgoing + r.incoming }))}
                  dataKey="total"
                  color="#25D366"
                />
              </div>
            </div>
            <div className="relative">
              <MetricTile
                label="Incoming"
                value={stats.incoming.toLocaleString()}
                delta={fmtDelta(deltas.incoming)}
                icon={ArrowDownLeft}
                delay={reduceMotion ? 0 : 0.04}
              />
              <div className="pointer-events-none absolute bottom-3 right-3">
                <Sparkline data={dailyRows.slice(-7)} dataKey="incoming" color="#0ea5e9" />
              </div>
            </div>
            <div className="relative">
              <MetricTile
                label="Outgoing"
                value={stats.outgoing.toLocaleString()}
                delta={fmtDelta(deltas.outgoing)}
                icon={ArrowUpRight}
                delay={reduceMotion ? 0 : 0.06}
              />
              <div className="pointer-events-none absolute bottom-3 right-3">
                <Sparkline data={dailyRows.slice(-7)} dataKey="outgoing" color="#10b981" />
              </div>
            </div>
            <MetricTile
              label="Avg response"
              value={fmtTime(avgMs)}
              icon={Clock}
              delay={reduceMotion ? 0 : 0.08}
            />
            <MetricTile
              label="Media share"
              value={`${mediaRate}%`}
              delta={
                stats.media > 0
                  ? { value: stats.media.toLocaleString(), positive: true }
                  : undefined
              }
              icon={ImageIcon}
              delay={reduceMotion ? 0 : 0.1}
            />
            <MetricTile
              label="Out vs in"
              value={`${ratio.out}%`}
              delta={
                ratio.inc > 0
                  ? { value: `${ratio.inc}% in`, positive: true }
                  : undefined
              }
              icon={Percent}
              delay={reduceMotion ? 0 : 0.12}
            />
          </div>

          {/* Insight strip */}
          {(peakDay || busiestDay) && stats.total > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {peakDay && (
                <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
                  <Flame className="h-4 w-4 text-amber-500" strokeWidth={2.25} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Peak weekday
                    </p>
                    <p className="text-[13px] font-semibold text-zinc-900">
                      {peakDay.name} · {peakDay.value.toLocaleString()} msgs
                    </p>
                  </div>
                </div>
              )}
              {busiestDay && (
                <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
                  <TrendingUp className="h-4 w-4 text-emerald-500" strokeWidth={2.25} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Busiest day
                    </p>
                    <p className="text-[13px] font-semibold text-zinc-900">
                      {busiestDay.date} ·{' '}
                      {(busiestDay.outgoing + busiestDay.incoming).toLocaleString()} msgs
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
                <Clock className="h-4 w-4 text-sky-500" strokeWidth={2.25} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Avg reply latency
                  </p>
                  <p className="text-[13px] font-semibold text-zinc-900">
                    {fmtTime(avgMs)}{' '}
                    <StatusPill tone={avgMs < 60000 ? 'sent' : avgMs < 300000 ? 'queued' : 'failed'}>
                      {avgMs < 60000 ? 'Fast' : avgMs < 300000 ? 'Average' : 'Slow'}
                    </StatusPill>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Section title="Volume breakdown" description="Incoming, outgoing, media split.">
              {isEmpty ? (
                <EmptyState
                  icon={Inbox}
                  title="No messages"
                  description="No data available for this period."
                />
              ) : (
                <ZoruChartContainer height={220}>
                  <ZoruChart.BarChart
                    data={histogramData}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <ZoruChart.CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e4e4e7"
                      vertical={false}
                    />
                    <ZoruChart.XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e4e4e7' }}
                    />
                    <ZoruChart.YAxis
                      tick={{ fontSize: 11, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                    <ZoruChart.Bar dataKey="value" fill="#25D366" radius={[6, 6, 0, 0]} />
                  </ZoruChart.BarChart>
                </ZoruChartContainer>
              )}
            </Section>

            <Section
              title="Daily trend"
              description="Outgoing vs incoming per day."
              className="lg:col-span-2"
              action={
                isLoading ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> : null
              }
            >
              {dailyRows.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No data"
                  description="No daily volume available for this period."
                />
              ) : (
                <ZoruChartContainer height={220}>
                  <ZoruChart.LineChart
                    data={dailyRows}
                    margin={{ top: 5, right: 12, left: 0, bottom: 0 }}
                  >
                    <ZoruChart.CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <ZoruChart.XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e4e4e7' }}
                    />
                    <ZoruChart.YAxis
                      tick={{ fontSize: 11, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                    <ZoruChart.Legend wrapperStyle={{ fontSize: 11 }} />
                    <ZoruChart.Line
                      type="monotone"
                      dataKey="outgoing"
                      name="Outgoing"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                    <ZoruChart.Line
                      type="monotone"
                      dataKey="incoming"
                      name="Incoming"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </ZoruChart.LineChart>
                </ZoruChartContainer>
              )}
            </Section>
          </div>

          {/* Day of week heatmap bar chart */}
          {dailyRows.length > 0 && (
            <div className="mb-4">
              <Section
                title="Volume heatmap by day of week"
                description={peakDay ? `Peak: ${peakDay.name}` : 'Color-graded by send volume.'}
              >
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayOfWeekVolume} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {dayOfWeekVolume.map((entry, i) => {
                          const ratioVal = entry.value / peakHeat;
                          const fill =
                            ratioVal > 0.75
                              ? '#059669'
                              : ratioVal > 0.5
                              ? '#10b981'
                              : ratioVal > 0.25
                              ? '#34d399'
                              : ratioVal > 0
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
              </Section>
            </div>
          )}

          <Section title="Daily breakdown" description="Detailed outgoing vs incoming counts." padded={false}>
            {dailyRows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Inbox}
                  title="No tabular data"
                  description="Detailed numbers will appear once messages are sent."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-zinc-100 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-right">Outgoing</th>
                      <th className="px-4 py-2 text-right">Incoming</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-right">Out %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {dailyRows.map((r) => {
                      const total = r.outgoing + r.incoming;
                      const outPct = total > 0 ? Math.round((r.outgoing / total) * 100) : 0;
                      return (
                        <tr key={r.date} className="h-9 hover:bg-zinc-50">
                          <td className="px-4 py-1.5 font-medium text-zinc-900">{r.date}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums text-zinc-900">
                            {r.outgoing.toLocaleString()}
                          </td>
                          <td className="px-4 py-1.5 text-right tabular-nums text-zinc-900">
                            {r.incoming.toLocaleString()}
                          </td>
                          <td className="px-4 py-1.5 text-right font-semibold tabular-nums text-zinc-950">
                            {total.toLocaleString()}
                          </td>
                          <td className="px-4 py-1.5 text-right tabular-nums text-zinc-600">
                            {outPct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      {/* Export CSV dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Export analytics</ZoruDialogTitle>
            <ZoruDialogDescription>
              Download the daily breakdown as a CSV ({dailyRows.length} rows).
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <WaButton variant="ghost" onClick={() => setExportOpen(false)}>
              Cancel
            </WaButton>
            <WaButton onClick={handleExport} leftIcon={Download}>
              Download CSV
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}
