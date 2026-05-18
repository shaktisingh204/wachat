'use client';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZoruEmptyState,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruStatCard,
} from '@/components/zoruui';
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
          metrics:
            'page_impressions,page_post_engagements,page_views_total,page_fan_adds_unique',
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

  const impressions = useMemo(
    () => pickMetric(series, ['page_impressions', 'page_impressions_unique']),
    [series],
  );
  const engagementSeries = useMemo(
    () => pickMetric(series, ['page_post_engagements']),
    [series],
  );
  const pageViews = useMemo(
    () => pickMetric(series, ['page_views_total']),
    [series],
  );
  const newFans = useMemo(
    () => pickMetric(series, ['page_fan_adds_unique']),
    [series],
  );

  const chartData = useMemo(() => {
    const primary = impressions ?? engagementSeries ?? pageViews;
    if (!primary?.values?.length) return [];
    return primary.values.map((v) => ({
      date: v.end_time ? format(new Date(v.end_time), 'MMM d') : '',
      value: typeof v.value === 'number' ? v.value : Number(v.value) || 0,
    }));
  }, [impressions, engagementSeries, pageViews]);

  const primaryLabel = impressions
    ? 'Impressions'
    : engagementSeries
    ? 'Engagement'
    : 'Page views';

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<BarChart3 />}
          title="No project selected"
          description="Pick a Facebook page / project to see insights."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">Meta Suite</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Insights</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-zoru-ink">Insights</h1>
          <p className="mt-1 text-sm text-zoru-ink-muted">
            Reach, engagement, and audience growth from the Facebook Graph
            Insights API.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ZoruSelect value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <ZoruSelectTrigger className="w-[160px]">
              <ZoruSelectValue placeholder="Range" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="7d">Last 7 days</ZoruSelectItem>
              <ZoruSelectItem value="30d">Last 30 days</ZoruSelectItem>
              <ZoruSelectItem value="90d">Last 90 days</ZoruSelectItem>
            </ZoruSelectContent>
          </ZoruSelect>
          <ZoruButton variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh
          </ZoruButton>
        </div>
      </header>

      {error && (
        <ZoruAlert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load insights</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading && series.length === 0 && !summary ? (
          <>
            <ZoruSkeleton className="h-28 w-full" />
            <ZoruSkeleton className="h-28 w-full" />
            <ZoruSkeleton className="h-28 w-full" />
            <ZoruSkeleton className="h-28 w-full" />
          </>
        ) : (
          <>
            <ZoruStatCard
              icon={<Eye />}
              label="Impressions"
              value={(metricTotal(impressions) || 0).toLocaleString()}
              period={`last ${presetSince(preset).days} days`}
            />
            <ZoruStatCard
              icon={<Users />}
              label="Reach"
              value={(summary?.pageReach ?? 0).toLocaleString()}
              period="lifetime page reach"
            />
            <ZoruStatCard
              icon={<Heart />}
              label="Engagement"
              value={(
                metricTotal(engagementSeries) || summary?.postEngagement || 0
              ).toLocaleString()}
              period={`last ${presetSince(preset).days} days`}
            />
            <ZoruStatCard
              icon={<Activity />}
              label="Page views"
              value={(metricTotal(pageViews) || 0).toLocaleString()}
              period={`last ${presetSince(preset).days} days`}
            />
          </>
        )}
      </section>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>{primaryLabel} over time</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {loading && chartData.length === 0 ? (
            <ZoruSkeleton className="h-[280px] w-full" />
          ) : chartData.length === 0 ? (
            <ZoruEmptyState
              icon={<BarChart3 />}
              title="No time-series data"
              description="The Graph Insights API returned no daily values for this range."
            />
          ) : (
            <ZoruChartContainer height={280}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
                >
                  <defs>
                    <linearGradient id="fbInsightsArea" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--zoru-ink))"
                        stopOpacity={0.32}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--zoru-ink))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--zoru-line))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'hsl(var(--zoru-ink-muted))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--zoru-ink-muted))' }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip content={<ZoruChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name={primaryLabel}
                    stroke="hsl(var(--zoru-ink))"
                    fill="url(#fbInsightsArea)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ZoruChartContainer>
          )}
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Other metrics</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {series.length === 0 ? (
            <p className="text-xs text-zoru-ink-muted">No additional metrics.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {series.map((m) => (
                <li
                  key={m.name}
                  className="flex items-center justify-between rounded-md border border-zoru-line px-3 py-2 text-sm"
                >
                  <span className="text-zoru-ink">{m.title ?? m.name}</span>
                  <div className="flex items-center gap-2">
                    {m.period ? (
                      <ZoruBadge variant="outline">{m.period}</ZoruBadge>
                    ) : null}
                    <span className="font-medium text-zoru-ink">
                      {metricTotal(m).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
              {newFans ? (
                <li className="flex items-center justify-between rounded-md border border-zoru-line px-3 py-2 text-sm">
                  <span className="text-zoru-ink">New fans</span>
                  <span className="font-medium text-zoru-ink">
                    {metricTotal(newFans).toLocaleString()}
                  </span>
                </li>
              ) : null}
            </ul>
          )}
        </ZoruCardContent>
      </ZoruCard>
    </div>
  );
}
