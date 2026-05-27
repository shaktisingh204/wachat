'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Clock,
  Download,
  Inbox,
  Loader2,
  MessageSquare,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getMessageAnalytics, getMessageStatistics } from '@/app/actions/wachat-features.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
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

export default function MessageStatisticsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [period, setPeriod] = useState<Period>('weekly');
  const [stats, setStats] = useState({ total: 0, incoming: 0, outgoing: 0, media: 0 });
  const [deltas, setDeltas] = useState({ total: 0, incoming: 0, outgoing: 0 });
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [avgMs, setAvgMs] = useState(0);
  const [isLoading, startTransition] = useTransition();
  const [exportOpen, setExportOpen] = useState(false);

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

  return (
    <WaPage>
      <PageHeader
        title="Message statistics"
        kicker="Dashboard"
        description="Monitor message volume and track trends over time."
        eyebrowIcon={BarChart3}
        actions={
          <>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <MetricTile
              label="Total messages"
              value={stats.total.toLocaleString()}
              delta={fmtDelta(deltas.total)}
              icon={MessageSquare}
              delay={0.02}
            />
            <MetricTile
              label="Incoming"
              value={stats.incoming.toLocaleString()}
              delta={fmtDelta(deltas.incoming)}
              icon={ArrowDownLeft}
              delay={0.06}
            />
            <MetricTile
              label="Outgoing"
              value={stats.outgoing.toLocaleString()}
              delta={fmtDelta(deltas.outgoing)}
              icon={ArrowUpRight}
              delay={0.1}
            />
            <MetricTile label="Avg response" value={fmtTime(avgMs)} icon={Clock} delay={0.14} />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Section title="Volume breakdown" description="Incoming, outgoing, and media split.">
              {isEmpty ? (
                <EmptyState
                  icon={Inbox}
                  title="No messages"
                  description="No data available for this period."
                />
              ) : (
                <ZoruChartContainer height={240}>
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
                    <ZoruChart.Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
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
                <ZoruChartContainer height={240}>
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
                      <th className="px-5 py-2.5 text-left">Date</th>
                      <th className="px-5 py-2.5 text-right">Outgoing</th>
                      <th className="px-5 py-2.5 text-right">Incoming</th>
                      <th className="px-5 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {dailyRows.map((r) => {
                      const total = r.outgoing + r.incoming;
                      return (
                        <tr key={r.date} className="hover:bg-zinc-50">
                          <td className="px-5 py-2 font-medium text-zinc-900">{r.date}</td>
                          <td className="px-5 py-2 text-right tabular-nums text-zinc-900">
                            {r.outgoing.toLocaleString()}
                          </td>
                          <td className="px-5 py-2 text-right tabular-nums text-zinc-900">
                            {r.incoming.toLocaleString()}
                          </td>
                          <td className="px-5 py-2 text-right font-semibold tabular-nums text-zinc-950">
                            {total.toLocaleString()}
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
