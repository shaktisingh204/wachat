'use client';

import {
  useToast,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
  Modal,
  SegmentedControl,
  EmptyState,
  Skeleton,
  Spinner,
  StatCard,
  Table,
  THead,
  TBody,
  Th,
  Tr,
  Td,
} from '@/components/sabcrm/20ui';
import WachatPage from '@/app/wachat/_components/wachat-page';
import {
  useEffect,
  useState,
  useTransition,
  useCallback
} from 'react';
import * as Recharts from 'recharts';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Clock,
  Download,
  Inbox,
  MessageSquare,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getMessageAnalytics, getMessageStatistics } from '@/app/actions/wachat-features.actions';

import * as React from 'react';

type Period = 'daily' | 'weekly' | 'monthly';

const PERIOD_ITEMS: Array<{ value: Period; label: string }> = [
  { value: 'daily', label: 'Last 24 Hours' },
  { value: 'weekly', label: 'Last 7 Days' },
  { value: 'monthly', label: 'Last 30 Days' },
];

const VOLUME_CONFIG: ChartConfig = {
  value: { label: 'Messages', color: 'var(--st-accent)' },
};

const TREND_CONFIG: ChartConfig = {
  outgoing: { label: 'Outgoing', color: 'var(--st-accent)' },
  incoming: { label: 'Incoming', color: 'var(--st-status-ok)' },
};

type DailyRow = { date: string; outgoing: number; incoming: number };

/** Render a delta percentage into the StatCard delta shape (signed string + tone). */
function deltaProps(value: number): { value: string; tone: 'up' | 'down' | 'neutral' } {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return {
    value: `${sign}${rounded}%`,
    tone: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'neutral',
  };
}

export default function MessageStatisticsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [period, setPeriod] = useState<Period>('weekly');
  const [stats, setStats] = useState({ total: 0, incoming: 0, outgoing: 0, media: 0 });
  const [deltas, setDeltas] = useState({ total: 0, incoming: 0, outgoing: 0 });
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [avgMs, setAvgMs] = useState(0);
  const [isLoading, startTransition] = useTransition();
  const [exportOpen, setExportOpen] = useState(false);

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
        toast({ title: 'Error', description: 'Failed to load analytics data.', tone: 'danger' });
        return;
      }

      // 1. Current Stats (from statistics)
      const currentStats = statsRes.stats || { total: 0, incoming: 0, outgoing: 0, media: 0 };
      setStats(currentStats);

      // 2. Daily Line Chart Data (from currentRes)
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

      // 3. Avg Response Time (from currentRes)
      setAvgMs(currentRes.responseMetrics?.avgResponseMs ?? 0);

      // 4. Calculate Deltas using prevRes (which includes current + previous)
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

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Dashboard' },
      ]}
      title="Dashboard"
      description="Monitor your message volume and track trends over time."
      width="wide"
      actions={
        <div className="flex items-center gap-2">
          <SegmentedControl
            items={PERIOD_ITEMS}
            value={period}
            onChange={(v) => setPeriod(v)}
            size="sm"
            aria-label="Time range"
          />
          <Button
            variant="outline"
            size="sm"
            iconLeft={Download}
            onClick={() => setExportOpen(true)}
            disabled={dailyRows.length === 0}
          >
            Export
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {isLoading && stats.total === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={120} radius="var(--st-radius-lg)" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total Messages"
                value={stats.total.toLocaleString()}
                delta={deltaProps(deltas.total)}
                icon={MessageSquare}
              />
              <StatCard
                label="Incoming"
                value={stats.incoming.toLocaleString()}
                delta={deltaProps(deltas.incoming)}
                icon={ArrowDownLeft}
              />
              <StatCard
                label="Outgoing"
                value={stats.outgoing.toLocaleString()}
                delta={deltaProps(deltas.outgoing)}
                icon={ArrowUpRight}
              />
              <StatCard
                label="Avg Response Time"
                value={fmtTime(avgMs)}
                icon={Clock}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* Volume Breakdown */}
              <Card padding="none" className="lg:col-span-1 flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChart3
                      className="h-4 w-4"
                      style={{ color: 'var(--st-text-tertiary)' }}
                      aria-hidden="true"
                    />
                    <CardTitle>Volume Breakdown</CardTitle>
                  </div>
                  <CardDescription>
                    Distribution across incoming, outgoing, and media.
                  </CardDescription>
                </CardHeader>
                <CardBody className="flex-1">
                  {isEmpty ? (
                    <EmptyState
                      icon={Inbox}
                      title="No messages"
                      description="No data available for this period."
                    />
                  ) : (
                    <ChartContainer config={VOLUME_CONFIG} style={{ height: 240 }}>
                      <Recharts.BarChart
                        data={histogramData}
                        margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                      >
                        <Recharts.CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--st-border)"
                          vertical={false}
                        />
                        <Recharts.XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: 'var(--st-text-tertiary)' }}
                          tickLine={false}
                          axisLine={{ stroke: 'var(--st-border)' }}
                        />
                        <Recharts.YAxis
                          tick={{ fontSize: 11, fill: 'var(--st-text-tertiary)' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Recharts.Bar
                          dataKey="value"
                          fill="var(--color-value)"
                          radius={[4, 4, 0, 0]}
                        />
                      </Recharts.BarChart>
                    </ChartContainer>
                  )}
                </CardBody>
              </Card>

              {/* Daily Volume Trend */}
              <Card padding="none" className="lg:col-span-2 flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Daily Trend</CardTitle>
                      <CardDescription>
                        Outgoing vs incoming volume per day.
                      </CardDescription>
                    </div>
                    {isLoading && <Spinner size="sm" label="Refreshing" />}
                  </div>
                </CardHeader>
                <CardBody className="flex-1">
                  {dailyRows.length === 0 ? (
                    <EmptyState
                      icon={Inbox}
                      title="No data"
                      description="No daily volume available for this period."
                    />
                  ) : (
                    <ChartContainer config={TREND_CONFIG} style={{ height: 240 }}>
                      <Recharts.LineChart
                        data={dailyRows}
                        margin={{ top: 5, right: 12, left: 0, bottom: 0 }}
                      >
                        <Recharts.CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--st-border)"
                        />
                        <Recharts.XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: 'var(--st-text-tertiary)' }}
                          tickLine={false}
                          axisLine={{ stroke: 'var(--st-border)' }}
                        />
                        <Recharts.YAxis
                          tick={{ fontSize: 11, fill: 'var(--st-text-tertiary)' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Recharts.Line
                          type="monotone"
                          dataKey="outgoing"
                          name="Outgoing"
                          stroke="var(--color-outgoing)"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Recharts.Line
                          type="monotone"
                          dataKey="incoming"
                          name="Incoming"
                          stroke="var(--color-incoming)"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      </Recharts.LineChart>
                    </ChartContainer>
                  )}
                </CardBody>
              </Card>
            </div>

            <Card padding="none">
              <CardHeader>
                <CardTitle>Daily Breakdown</CardTitle>
                <CardDescription>
                  Detailed outgoing vs incoming message counts.
                </CardDescription>
              </CardHeader>
              <CardBody>
                {dailyRows.length === 0 ? (
                  <EmptyState
                    icon={Inbox}
                    title="No tabular data"
                    description="Detailed numbers will appear here once messages are sent."
                  />
                ) : (
                  <Table>
                    <THead>
                      <Tr>
                        <Th>Date</Th>
                        <Th align="right">Outgoing</Th>
                        <Th align="right">Incoming</Th>
                        <Th align="right">Total</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {dailyRows.map((r) => {
                        const total = r.outgoing + r.incoming;
                        return (
                          <Tr key={r.date}>
                            <Td className="font-medium">{r.date}</Td>
                            <Td align="right" className="tabular-nums">
                              {r.outgoing.toLocaleString()}
                            </Td>
                            <Td align="right" className="tabular-nums">
                              {r.incoming.toLocaleString()}
                            </Td>
                            <Td align="right" className="font-semibold tabular-nums">
                              {total.toLocaleString()}
                            </Td>
                          </Tr>
                        );
                      })}
                    </TBody>
                  </Table>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>

      {/* Export CSV dialog */}
      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export analytics"
        description={`Download the daily breakdown as a CSV file (${dailyRows.length} rows).`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" iconLeft={Download} onClick={handleExport}>
              Download CSV
            </Button>
          </>
        }
      />
    </WachatPage>
  );
}
