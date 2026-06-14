'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatCard,
} from '@/components/sabcrm/20ui';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Download,
  Eye,
  Heart,
  RefreshCw,
  Users,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { m } from 'motion/react';

import { useProject } from '@/context/project-context';
import { getDetailedPageInsights, getPageInsights } from '@/app/actions/facebook.actions';
import { PAGE_METRICS } from '@/lib/meta/insights-metrics';
import { CountUp } from '@/components/wachat/motion';

/**
 * /dashboard/facebook/insights — v25 Analytics Suite.
 *
 * Built on the v25 metric vocabulary (`@/lib/meta/insights-metrics`): Meta
 * removed the reach/impressions family, so we report **Views** (`page_media_view`)
 * and **Viewers** (`page_total_media_view_unique`) plus engagement & followers.
 * Animated KPI tiles, a Views area chart, an engagement bar chart, an optional
 * previous-period comparison, and CSV export.
 */

import * as React from 'react';

type Preset = '7d' | '30d' | '90d';

interface PageInsightsSummary {
  pageReach: number;
  postEngagement: number;
}

interface MetricSeries {
  name: string;
  period?: string;
  title?: string;
  values?: { value: unknown; end_time?: string }[];
}

const SAFE_METRICS = [PAGE_METRICS.views, PAGE_METRICS.engagement, PAGE_METRICS.follows].join(',');

function presetSince(preset: Preset): { since: string; until: string; days: number } {
  const until = new Date();
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const since = subDays(until, days);
  return { since: format(since, 'yyyy-MM-dd'), until: format(until, 'yyyy-MM-dd'), days };
}

function prevWindow(preset: Preset): { since: string; until: string } {
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const until = subDays(new Date(), days);
  const since = subDays(until, days);
  return { since: format(since, 'yyyy-MM-dd'), until: format(until, 'yyyy-MM-dd') };
}

function pickMetric(series: MetricSeries[], names: string[]): MetricSeries | undefined {
  for (const n of names) {
    const m2 = series.find((s) => s.name === n);
    if (m2) return m2;
  }
  return undefined;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function metricTotal(s?: MetricSeries): number {
  if (!s?.values) return 0;
  return s.values.reduce((acc, v) => acc + num(v.value), 0);
}

/** Last daily value — for running-total metrics like page_follows. */
function metricLatest(s?: MetricSeries): number {
  return num(s?.values?.[s.values.length - 1]?.value);
}

function deltaPct(current: number, previous: number): { value: string; tone: 'up' | 'down' | 'neutral' } | undefined {
  if (!previous) return undefined;
  const pct = Math.round(((current - previous) / previous) * 100);
  return { value: `${pct >= 0 ? '+' : ''}${pct}%`, tone: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral' };
}

const chartConfig = {
  views: { label: 'Views', color: 'var(--st-accent)' },
  actions: { label: 'Engagement', color: 'var(--st-text)' },
};

export default function FacebookInsightsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [summary, setSummary] = useState<PageInsightsSummary | null>(null);
  const [series, setSeries] = useState<MetricSeries[]>([]);
  const [prevSeries, setPrevSeries] = useState<MetricSeries[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [preset, setPreset] = useState<Preset>('30d');
  const [compare, setCompare] = useState(false);

  const refresh = useCallback(() => {
    if (!projectId) return;
    const { since, until } = presetSince(preset);
    startLoading(async () => {
      // Core call uses the proven-valid v25 trio; viewers (unique) is requested
      // separately so an unsupported metric never fails the whole dashboard.
      const [sumRes, detailRes, viewersRes, prevRes] = await Promise.all([
        getPageInsights(projectId),
        getDetailedPageInsights(projectId, { metrics: SAFE_METRICS, period: 'day', since, until }),
        getDetailedPageInsights(projectId, { metrics: PAGE_METRICS.viewers, period: 'day', since, until }),
        compare
          ? getDetailedPageInsights(projectId, {
              metrics: SAFE_METRICS,
              period: 'day',
              ...prevWindow(preset),
            })
          : Promise.resolve({ insights: [] as MetricSeries[] }),
      ]);

      if (sumRes.error && detailRes.error) {
        setError(detailRes.error || sumRes.error || 'Could not load insights.');
      } else {
        setError(null);
      }
      setSummary((sumRes.insights as PageInsightsSummary | undefined) ?? null);
      const merged = [
        ...((detailRes.insights as MetricSeries[]) ?? []),
        ...(!viewersRes.error ? ((viewersRes.insights as MetricSeries[]) ?? []) : []),
      ];
      setSeries(merged);
      setPrevSeries((prevRes.insights as MetricSeries[]) ?? []);
    });
  }, [projectId, preset, compare]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const views = useMemo(() => pickMetric(series, [PAGE_METRICS.views]), [series]);
  const viewers = useMemo(() => pickMetric(series, [PAGE_METRICS.viewers]), [series]);
  const engagementSeries = useMemo(() => pickMetric(series, [PAGE_METRICS.engagement]), [series]);
  const followers = useMemo(() => pickMetric(series, [PAGE_METRICS.follows]), [series]);

  const prevViews = useMemo(() => pickMetric(prevSeries, [PAGE_METRICS.views]), [prevSeries]);
  const prevEngagement = useMemo(() => pickMetric(prevSeries, [PAGE_METRICS.engagement]), [prevSeries]);

  const totals = useMemo(
    () => ({
      views: metricTotal(views),
      viewers: metricTotal(viewers),
      actions: metricTotal(engagementSeries),
      followers: metricLatest(followers),
    }),
    [views, viewers, engagementSeries, followers],
  );

  const chartData = useMemo(() => {
    const byDate = new Map<string, { date: string; views: number; actions: number }>();
    const add = (s: MetricSeries | undefined, key: 'views' | 'actions') => {
      for (const v of s?.values ?? []) {
        const date = v.end_time ? format(new Date(v.end_time), 'MMM d') : '';
        const row = byDate.get(date) ?? { date, views: 0, actions: 0 };
        row[key] = num(v.value);
        byDate.set(date, row);
      }
    };
    add(views, 'views');
    add(engagementSeries, 'actions');
    return Array.from(byDate.values());
  }, [views, engagementSeries]);

  const exportCsv = useCallback(() => {
    if (chartData.length === 0) return;
    const header = 'date,views,engagement\n';
    const rows = chartData.map((r) => `${r.date},${r.views},${r.actions}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facebook-insights-${preset}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chartData, preset]);

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={BarChart3}
          title="No project selected"
          description="Pick a Facebook page / project to see insights."
        />
      </div>
    );
  }

  const days = presetSince(preset).days;

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">Meta Suite</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Insights</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Insights</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            v25 Views &amp; Viewers, engagement and audience growth from the Graph
            Insights API.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={compare ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setCompare((v) => !v)}
          >
            Compare period
          </Button>
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={chartData.length === 0} iconLeft={Download}>
            CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load insights</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <m.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {loading && series.length === 0 && !summary ? (
          <>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </>
        ) : (
          <>
            <StatCard
              icon={Eye}
              label={`Views · last ${days}d`}
              value={<CountUp value={totals.views} />}
              accent="var(--st-accent)"
              delta={compare ? deltaPct(totals.views, metricTotal(prevViews)) : undefined}
            />
            <StatCard
              icon={Users}
              label={`Viewers · last ${days}d`}
              value={<CountUp value={totals.viewers || summary?.pageReach || 0} />}
            />
            <StatCard
              icon={Heart}
              label={`Engagement · last ${days}d`}
              value={<CountUp value={totals.actions || summary?.postEngagement || 0} />}
              delta={compare ? deltaPct(totals.actions, metricTotal(prevEngagement)) : undefined}
            />
            <StatCard icon={Activity} label="Followers" value={<CountUp value={totals.followers} />} />
          </>
        )}
      </m.section>

      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Views over time</CardTitle>
          </CardHeader>
          <CardBody>
            {loading && chartData.length === 0 ? (
              <Skeleton className="h-[280px] w-full" />
            ) : chartData.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No time-series data"
                description="The Graph Insights API returned no daily values for this range."
              />
            ) : (
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="fbViewsArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-views)" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="var(--color-views)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--st-text-secondary)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--st-text-secondary)' }} tickLine={false} axisLine={false} width={48} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="views" name="views" stroke="var(--color-views)" fill="url(#fbViewsArea)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            )}
          </CardBody>
        </Card>
      </m.div>

      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Engagement over time</CardTitle>
          </CardHeader>
          <CardBody>
            {chartData.length === 0 ? (
              <p className="text-xs text-[var(--st-text-secondary)]">No engagement data for this range.</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-[220px] w-full">
                <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--st-text-secondary)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--st-text-secondary)' }} tickLine={false} axisLine={false} width={48} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="actions" name="actions" fill="var(--color-actions)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardBody>
        </Card>
      </m.div>

      <Card>
        <CardHeader>
          <CardTitle>All metrics</CardTitle>
        </CardHeader>
        <CardBody>
          {series.length === 0 ? (
            <p className="text-xs text-[var(--st-text-secondary)]">No additional metrics.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {series.map((mItem) => (
                <li
                  key={mItem.name}
                  className="flex items-center justify-between rounded-md border border-[var(--st-border)] px-3 py-2 text-sm"
                >
                  <span className="text-[var(--st-text)]">{mItem.title ?? mItem.name}</span>
                  <div className="flex items-center gap-2">
                    {mItem.period ? <Badge variant="outline">{mItem.period}</Badge> : null}
                    <span className="font-medium text-[var(--st-text)]">
                      {(mItem.name === PAGE_METRICS.follows
                        ? metricLatest(mItem)
                        : metricTotal(mItem)
                      ).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
