'use client';

import {
  useZoruToast,
  ZORU_CHART_PALETTE,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Skeleton,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback
} from 'react';
import { formatUTC } from '@/lib/utils';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Clock,
  Download,
  Inbox,
  Loader2,
  MessageSquare,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getMessageAnalytics, getMessageStatistics } from '@/app/actions/wachat-features.actions';

import * as React from 'react';

type Period = 'daily' | 'weekly' | 'monthly';

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'Last 24 Hours',
  weekly: 'Last 7 Days',
  monthly: 'Last 30 Days',
};

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
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Dashboard</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Dashboard
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Monitor your message volume and track trends over time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {PERIOD_LABELS[period]}
                <ChevronDown className="opacity-60" />
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuLabel>Time range</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuRadioGroup
                value={period}
                onValueChange={(v) => setPeriod(v as Period)}
              >
                <ZoruDropdownMenuRadioItem value="daily">Last 24 Hours</ZoruDropdownMenuRadioItem>
                <ZoruDropdownMenuRadioItem value="weekly">Last 7 Days</ZoruDropdownMenuRadioItem>
                <ZoruDropdownMenuRadioItem value="monthly">Last 30 Days</ZoruDropdownMenuRadioItem>
              </ZoruDropdownMenuRadioGroup>
            </ZoruDropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(true)}
            disabled={dailyRows.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {isLoading && stats.total === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Messages"
              value={stats.total.toLocaleString()}
              delta={deltas.total}
              period="vs previous period"
              icon={<MessageSquare />}
            />
            <StatCard
              label="Incoming"
              value={stats.incoming.toLocaleString()}
              delta={deltas.incoming}
              period="vs previous period"
              icon={<ArrowDownLeft />}
            />
            <StatCard
              label="Outgoing"
              value={stats.outgoing.toLocaleString()}
              delta={deltas.outgoing}
              period="vs previous period"
              icon={<ArrowUpRight />}
            />
            <StatCard
              label="Avg Response Time"
              value={fmtTime(avgMs)}
              period="Lower is better"
              icon={<Clock />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Volume Breakdown */}
            <Card className="lg:col-span-1 flex flex-col">
              <ZoruCardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-zoru-ink-muted" />
                  <ZoruCardTitle>Volume Breakdown</ZoruCardTitle>
                </div>
                <ZoruCardDescription>
                  Distribution across incoming, outgoing, and media.
                </ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="flex-1">
                {isEmpty ? (
                  <EmptyState
                    icon={<Inbox />}
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
                        stroke="hsl(var(--zoru-line))"
                        vertical={false}
                      />
                      <ZoruChart.XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'hsl(var(--zoru-ink-muted))' }}
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--zoru-line))' }}
                      />
                      <ZoruChart.YAxis
                        tick={{ fontSize: 11, fill: 'hsl(var(--zoru-ink-muted))' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                      <ZoruChart.Bar
                        dataKey="value"
                        fill={ZORU_CHART_PALETTE[1]}
                        radius={[4, 4, 0, 0]}
                      />
                    </ZoruChart.BarChart>
                  </ZoruChartContainer>
                )}
              </ZoruCardContent>
            </Card>

            {/* Daily Volume Trend */}
            <Card className="lg:col-span-2 flex flex-col">
              <ZoruCardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <ZoruCardTitle>Daily Trend</ZoruCardTitle>
                    <ZoruCardDescription>
                      Outgoing vs incoming volume per day.
                    </ZoruCardDescription>
                  </div>
                  {isLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-zoru-ink-muted" />
                  )}
                </div>
              </ZoruCardHeader>
              <ZoruCardContent className="flex-1">
                {dailyRows.length === 0 ? (
                  <EmptyState
                    icon={<Inbox />}
                    title="No data"
                    description="No daily volume available for this period."
                  />
                ) : (
                  <ZoruChartContainer height={240}>
                    <ZoruChart.LineChart
                      data={dailyRows}
                      margin={{ top: 5, right: 12, left: 0, bottom: 0 }}
                    >
                      <ZoruChart.CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--zoru-line))"
                      />
                      <ZoruChart.XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: 'hsl(var(--zoru-ink-muted))' }}
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--zoru-line))' }}
                      />
                      <ZoruChart.YAxis
                        tick={{ fontSize: 11, fill: 'hsl(var(--zoru-ink-muted))' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                      <ZoruChart.Legend wrapperStyle={{ fontSize: 11 }} />
                      <ZoruChart.Line
                        type="monotone"
                        dataKey="outgoing"
                        name="Outgoing"
                        stroke={ZORU_CHART_PALETTE[0]}
                        strokeWidth={2}
                        dot={false}
                      />
                      <ZoruChart.Line
                        type="monotone"
                        dataKey="incoming"
                        name="Incoming"
                        stroke={ZORU_CHART_PALETTE[2]}
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </ZoruChart.LineChart>
                  </ZoruChartContainer>
                )}
              </ZoruCardContent>
            </Card>
          </div>
          
          <Card>
             <ZoruCardHeader>
               <ZoruCardTitle>Daily Breakdown</ZoruCardTitle>
               <ZoruCardDescription>
                 Detailed outgoing vs incoming message counts.
               </ZoruCardDescription>
             </ZoruCardHeader>
             <ZoruCardContent>
              {dailyRows.length === 0 ? (
                <EmptyState
                  icon={<Inbox />}
                  title="No tabular data"
                  description="Detailed numbers will appear here once messages are sent."
                />
              ) : (
                <Table>
                  <ZoruTableHeader>
                    <ZoruTableRow className="hover:bg-transparent">
                      <ZoruTableHead>Date</ZoruTableHead>
                      <ZoruTableHead className="text-right">Outgoing</ZoruTableHead>
                      <ZoruTableHead className="text-right">Incoming</ZoruTableHead>
                      <ZoruTableHead className="text-right">Total</ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {dailyRows.map((r) => {
                      const total = r.outgoing + r.incoming;
                      return (
                        <ZoruTableRow key={r.date}>
                          <ZoruTableCell className="font-medium">{r.date}</ZoruTableCell>
                          <ZoruTableCell className="text-right tabular-nums">
                            {r.outgoing.toLocaleString()}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right tabular-nums">
                            {r.incoming.toLocaleString()}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right font-semibold tabular-nums">
                            {total.toLocaleString()}
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })}
                  </ZoruTableBody>
                </Table>
              )}
             </ZoruCardContent>
          </Card>
        </>
      )}

      {/* Export CSV dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Export analytics</ZoruDialogTitle>
            <ZoruDialogDescription>
              Download the daily breakdown as a CSV file ({dailyRows.length} rows).
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Download CSV
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <div className="h-6" />
    </div>
  );
}
