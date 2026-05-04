'use client';

/**
 * Wachat Message Analytics — ZoruUI rebuild.
 *
 * KPI strip + line chart + breakdown table. Greyscale-only chart palette
 * via ZORU_CHART_PALETTE; series differentiated by stroke-dasharray.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Clock,
  Download,
  Inbox,
  Loader2,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useZoruToast } from '@/components/zoruui';
import { getMessageAnalytics } from '@/app/actions/wachat-features.actions';

import {
  ZORU_CHART_PALETTE,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruSkeleton,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';

type DailyRow = { date: string; outgoing: number; incoming: number };
type Period = 7 | 30 | 90;

const PERIOD_LABELS: Record<Period, string> = {
  7: 'Last 7 days',
  30: 'Last 30 days',
  90: 'Last 90 days',
};

export default function MessageAnalyticsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [period, setPeriod] = useState<Period>(7);
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [totals, setTotals] = useState({ out: 0, inc: 0, avgMs: 0 });
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getMessageAnalytics(String(activeProject._id), period);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      const map = new Map<string, { out: number; inc: number }>();
      (res.dailyData ?? []).forEach((d: any) => {
        const key = d._id.date;
        const cur = map.get(key) || { out: 0, inc: 0 };
        if (d._id.direction === 'out') cur.out += d.count;
        else cur.inc += d.count;
        map.set(key, cur);
      });
      const built: DailyRow[] = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, outgoing: v.out, incoming: v.inc }));
      const totalOut = built.reduce((s, r) => s + r.outgoing, 0);
      const totalInc = built.reduce((s, r) => s + r.incoming, 0);
      const avgMs = res.responseMetrics?.avgResponseMs ?? 0;
      setRows(built);
      setTotals({ out: totalOut, inc: totalInc, avgMs });
    });
  }, [activeProject?._id, period, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const fmtTime = (ms: number) => {
    if (!ms) return '--';
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const handleExport = useCallback(() => {
    const header = ['date', 'outgoing', 'incoming', 'total'].join(',');
    const body = rows
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
  }, [rows]);

  return (
    <div className="flex min-h-full flex-col gap-6">
      <ZoruBreadcrumb>
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
            <ZoruBreadcrumbPage>Message Analytics</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Message Analytics
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Track outgoing and incoming message volume over time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ZoruDropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <ZoruButton variant="outline" size="sm">
                {PERIOD_LABELS[period]}
                <ChevronDown className="opacity-60" />
              </ZoruButton>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuLabel>Time range</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuRadioGroup
                value={String(period)}
                onValueChange={(v) => setPeriod(Number(v) as Period)}
              >
                <ZoruDropdownMenuRadioItem value="7">Last 7 days</ZoruDropdownMenuRadioItem>
                <ZoruDropdownMenuRadioItem value="30">Last 30 days</ZoruDropdownMenuRadioItem>
                <ZoruDropdownMenuRadioItem value="90">Last 90 days</ZoruDropdownMenuRadioItem>
              </ZoruDropdownMenuRadioGroup>
            </ZoruDropdownMenuContent>
          </ZoruDropdownMenu>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(true)}
            disabled={rows.length === 0}
          >
            <Download /> Export
          </ZoruButton>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ZoruStatCard
          label="Total Outgoing"
          value={totals.out.toLocaleString()}
          icon={<ArrowUpRight />}
          period={PERIOD_LABELS[period]}
        />
        <ZoruStatCard
          label="Total Incoming"
          value={totals.inc.toLocaleString()}
          icon={<ArrowDownLeft />}
          period={PERIOD_LABELS[period]}
        />
        <ZoruStatCard
          label="Avg Response Time"
          value={fmtTime(totals.avgMs)}
          icon={<Clock />}
          period="Lower is better"
        />
      </div>

      {/* Daily breakdown */}
      <ZoruCard>
        <ZoruCardHeader>
          <div className="flex items-center justify-between">
            <div>
              <ZoruCardTitle>Daily Breakdown</ZoruCardTitle>
              <ZoruCardDescription>
                Outgoing vs incoming volume per day.
              </ZoruCardDescription>
            </div>
            {isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-zoru-ink-muted" />
            )}
          </div>
        </ZoruCardHeader>
        <ZoruCardContent>
          {isPending && rows.length === 0 ? (
            <div className="space-y-3">
              <ZoruSkeleton className="h-[240px] w-full" />
              <ZoruSkeleton className="h-8 w-full" />
              <ZoruSkeleton className="h-8 w-full" />
              <ZoruSkeleton className="h-8 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <ZoruEmptyState
              icon={<Inbox />}
              title="No data for this period"
              description="Once messages are exchanged, daily volume will appear here."
            />
          ) : (
            <>
              <ZoruChartContainer height={240}>
                <ZoruChart.LineChart
                  data={rows}
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

              <div className="mt-5">
                <ZoruTable>
                  <ZoruTableHeader>
                    <ZoruTableRow className="hover:bg-transparent">
                      <ZoruTableHead>Date</ZoruTableHead>
                      <ZoruTableHead className="text-right">Outgoing</ZoruTableHead>
                      <ZoruTableHead className="text-right">Incoming</ZoruTableHead>
                      <ZoruTableHead className="text-right">Total</ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {rows.map((r) => {
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
                </ZoruTable>
              </div>
            </>
          )}
        </ZoruCardContent>
      </ZoruCard>

      {/* Export CSV dialog */}
      <ZoruDialog open={exportOpen} onOpenChange={setExportOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Export analytics</ZoruDialogTitle>
            <ZoruDialogDescription>
              Download the daily breakdown as a CSV file ({rows.length} rows).
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setExportOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={handleExport}>
              <Download /> Download CSV
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      <div className="h-6" />
    </div>
  );
}
