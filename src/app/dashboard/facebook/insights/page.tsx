'use client';

import { Alert, AlertDescription, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, CardHeader, CardTitle, ChartContainer, ChartTooltip, EmptyState, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, StatCard } from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Eye,
  Heart,
  RefreshCw,
  Users,
  } from 'lucide-react';
import { format,
  subDays } from 'date-fns';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  } from 'recharts';

import { useProject } from '@/context/project-context';
import {
  getDetailedPageInsights,
  getPageInsights,
  } from '@/app/actions/facebook.actions';

/**
 * /dashboard/facebook/insights — Page-level performance metrics.
 *
 * KPI strip (reach, engagement, impressions, page views) sits above a
 * detailed time-series chart driven by `getDetailedPageInsights`. A
 * date-preset selector switches the `since` window (7/30/90 days).
 *
 * Data shape: Graph Insights returns `[{ name, period, values:
 * [{value, end_time}] }]`. We pivot the first time-series metric into a
 * recharts dataset.
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
  values?: { value: any; end_time?: string }[];
}

function presetSince(preset: Preset): { since: string; until: string; days: number } {
  const until = new Date();
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const since = subDays(until, days);
  return {
    since: format(since, 'yyyy-MM-dd'),
    until: format(until, 'yyyy-MM-dd'),
    days,
  };
}

function pickMetric(series: MetricSeries[], names: string[]): MetricSeries | undefined {
  for (const n of names) {
    const m = series.find((s) => s.name === n);
    if (m) return m;
  }
  return undefined;
}

function metricTotal(s?: MetricSeries): number {
  if (!s?.values) return 0;
  let total = 0;
  for (const v of s.values) {
    const n = typeof v.value === 'number' ? v.value : Number(v.value);
    if (!Number.isNaN(n)) total += n;
  }
  return total;
}

/** Last daily value — for running-total metrics like page_follows where summing days is wrong. */
function metricLatest(s?: MetricSeries): number {
  const last = s?.values?.[s.values.length - 1]?.value;
  const n = typeof last === 'number' ? last : Number(last);
  return Number.isNaN(n) ? 0 : n;
}

export default function FacebookInsightsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [summary, setSummary] = useState<PageInsightsSummary | null>(null);
  const [series, setSeries] = useState<MetricSeries[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [preset, setPreset] = useState<Preset>('30d');

  const refresh = useCallback(() => {
    if (!projectId) return;
    const { since, until } = presetSince(preset);
    startLoading(async () => {
      const [sumRes, detailRes] = await Promise.all([
        getPageInsights(projectId),
        getDetailedPageInsights(projectId, {
          // Meta removed page_impressions / page_fans / page_posts_impressions
          // for ALL API versions on 2025-11-15. One removed metric fails the
          // whole call with "(#100) ... valid insights metric".
          // page_media_view — replacement for the impressions family
          // page_total_actions — replacement for deprecated page_post_engagements
          // page_follows — follower count (page_fans has no direct successor)
          metrics: 'page_media_view,page_total_actions,page_follows',
          period: 'day',
          since,
          until,
        }),
      ]);
      if (sumRes.error && detailRes.error) {
        setError(sumRes.error);
      } else {
        setError(null);
      }
      setSummary((sumRes.insights as PageInsightsSummary | undefined) ?? null);
      setSeries((detailRes.insights as MetricSeries[]) ?? []);
    });
  }, [projectId, preset]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const views = useMemo(
    // page_media_view replaces the removed page_impressions family
    () => pickMetric(series, ['page_media_view']),
    [series],
  );
  const engagementSeries = useMemo(
    // page_total_actions replaces deprecated page_post_engagements
    () => pickMetric(series, ['page_total_actions']),
    [series],
  );
  const followers = useMemo(
    // page_fans was removed 2025-11-15; page_follows is the follower count
    () => pickMetric(series, ['page_follows']),
    [series],
  );

  const chartData = useMemo(() => {
    const primary = views ?? engagementSeries;
    if (!primary?.values?.length) return [];
    return primary.values.map((v) => ({
      date: v.end_time ? format(new Date(v.end_time), 'MMM d') : '',
      value: typeof v.value === 'number' ? v.value : Number(v.value) || 0,
    }));
  }, [views, engagementSeries]);

  const primaryLabel = views ? 'Views' : 'Total actions';

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<BarChart3 />}
          title="No project selected"
          description="Pick a Facebook page / project to see insights."
        />
      </div>
    );
  }

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
            Reach, engagement, and audience growth from the Facebook Graph
            Insights API.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="ghost" onClick={refresh} disabled={loading}>
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

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              icon={<Eye />}
              label="Views"
              value={(metricTotal(views) || 0).toLocaleString()}
              period={`last ${presetSince(preset).days} days`}
            />
            <StatCard
              icon={<Users />}
              label="Views (28d)"
              value={(summary?.pageReach ?? 0).toLocaleString()}
              period="Graph 28-day window"
            />
            <StatCard
              icon={<Heart />}
              label="Total actions"
              value={(
                metricTotal(engagementSeries) || summary?.postEngagement || 0
              ).toLocaleString()}
              period={`last ${presetSince(preset).days} days`}
            />
            <StatCard
              icon={<Activity />}
              label="Followers"
              value={(metricLatest(followers) || 0).toLocaleString()}
              period="current total"
            />
          </>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{primaryLabel} over time</CardTitle>
        </CardHeader>
        <CardBody>
          {loading && chartData.length === 0 ? (
            <Skeleton className="h-[280px] w-full" />
          ) : chartData.length === 0 ? (
            <EmptyState
              icon={<BarChart3 />}
              title="No time-series data"
              description="The Graph Insights API returned no daily values for this range."
            />
          ) : (
            <ChartContainer height={280}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
                >
                  <defs>
                    <linearGradient id="fbInsightsArea" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--st-text)"
                        stopOpacity={0.32}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--st-text)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--st-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'var(--st-text-secondary)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--st-text-secondary)' }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name={primaryLabel}
                    stroke="var(--st-text)"
                    fill="url(#fbInsightsArea)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Other metrics</CardTitle>
        </CardHeader>
        <CardBody>
          {series.length === 0 ? (
            <p className="text-xs text-[var(--st-text-secondary)]">No additional metrics.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {series.map((m) => (
                <li
                  key={m.name}
                  className="flex items-center justify-between rounded-md border border-[var(--st-border)] px-3 py-2 text-sm"
                >
                  <span className="text-[var(--st-text)]">{m.title ?? m.name}</span>
                  <div className="flex items-center gap-2">
                    {m.period ? (
                      <Badge variant="outline">{m.period}</Badge>
                    ) : null}
                    <span className="font-medium text-[var(--st-text)]">
                      {metricTotal(m).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
              {followers ? (
                <li className="flex items-center justify-between rounded-md border border-[var(--st-border)] px-3 py-2 text-sm">
                  <span className="text-[var(--st-text)]">Followers</span>
                  <span className="font-medium text-[var(--st-text)]">
                    {metricLatest(followers).toLocaleString()}
                  </span>
                </li>
              ) : null}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
