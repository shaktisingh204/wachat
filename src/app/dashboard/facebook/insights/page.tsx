"use client";

/**
 * /dashboard/facebook/insights — Account insights (ZoruUI rebuild).
 *
 * KPI strip + greyscale time-series chart + segment dropdown
 * (`ZoruDropdownMenuRadioGroup`). Same data + handlers as before:
 *   - getDetailedPageInsights(projectId, { period })
 *   - getPageFanDemographics(projectId)
 *
 * Charts are deliberately greyscale — series differentiate by stroke
 * dasharray rather than hue, per the zoru house rules.
 */

import * as React from "react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  Clock,
  Download,
  Eye,
  Heart,
  MousePointerClick,
  RefreshCw,
} from "lucide-react";

import {
  getDetailedPageInsights,
  getPageFanDemographics,
} from "@/app/actions/facebook.actions";

import {
  ZORU_CHART_PALETTE,
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
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
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  ZoruStatCard,
  useZoruToast,
} from "@/components/zoruui";

/* ── types & constants ────────────────────────────────────────────── */

type Period = "day" | "week" | "days_28";

const PERIOD_LABELS: Record<Period, string> = {
  day: "Daily",
  week: "Weekly",
  days_28: "28-day rolling",
};

type Segment = "engagement" | "reach" | "fans";

const SEGMENT_LABELS: Record<Segment, string> = {
  engagement: "Engagement",
  reach: "Reach & impressions",
  fans: "Fans & followers",
};

const SEGMENT_METRICS: Record<Segment, string[]> = {
  engagement: ["page_engaged_users", "page_post_engagements"],
  reach: ["page_impressions", "page_impressions_unique"],
  fans: ["page_fans", "page_fan_adds"],
};

/* ── helpers ──────────────────────────────────────────────────────── */

function getMetric(insights: any[], metricName: string) {
  return insights.find((m: any) => m?.name === metricName);
}

function getMetricLast(insights: any[], metricName: string): number {
  const m = getMetric(insights, metricName);
  if (!m?.values?.length) return 0;
  const v = m.values[m.values.length - 1]?.value;
  return typeof v === "number" ? v : 0;
}

function buildChartData(
  insights: any[],
  metricNames: string[],
): { date: string; [k: string]: string | number }[] {
  // Build a date index from the first metric that has values.
  const reference = metricNames
    .map((n) => getMetric(insights, n))
    .find((m) => Array.isArray(m?.values));
  if (!reference) return [];

  const points = (reference.values || []) as { end_time?: string }[];
  return points.map((pt: any, idx: number) => {
    const row: { date: string; [k: string]: string | number } = {
      date: pt.end_time
        ? new Date(pt.end_time).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
        : `t${idx}`,
    };
    for (const name of metricNames) {
      const m = getMetric(insights, name);
      const v = m?.values?.[idx]?.value;
      row[name] = typeof v === "number" ? v : 0;
    }
    return row;
  });
}

function compact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toString();
}

/* ── skeleton ─────────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-center justify-between">
        <ZoruSkeleton className="h-9 w-72" />
        <div className="flex gap-2">
          <ZoruSkeleton className="h-9 w-32 rounded-full" />
          <ZoruSkeleton className="h-9 w-32 rounded-full" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-28" />
        ))}
      </div>
      <ZoruSkeleton className="mt-6 h-72 w-full" />
      <ZoruSkeleton className="mt-6 h-64 w-full" />
    </div>
  );
}

/* ── demographics list ────────────────────────────────────────────── */

function DemographicList({
  data,
  label,
}: {
  data: Record<string, number> | undefined;
  label: string;
}) {
  if (!data || Object.keys(data).length === 0) return null;
  const sorted = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const max = sorted[0]?.[1] || 1;

  return (
    <ZoruCard className="p-0">
      <ZoruCardHeader>
        <ZoruCardTitle className="text-sm">{label}</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-2.5">
        {sorted.map(([key, value]) => (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-[11.5px]">
              <span className="truncate text-zoru-ink-muted">{key}</span>
              <span className="font-medium text-zoru-ink">
                {value.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zoru-surface-2">
              <div
                className="h-full rounded-full bg-zoru-ink"
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </ZoruCardContent>
    </ZoruCard>
  );
}

/* ── page ─────────────────────────────────────────────────────────── */

export default function FacebookInsightsPage() {
  const { toast } = useZoruToast();
  const [insights, setInsights] = useState<any[]>([]);
  const [demographics, setDemographics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("days_28");
  const [segment, setSegment] = useState<Segment>("engagement");
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    setProjectId(localStorage.getItem("activeProjectId"));
  }, []);

  const fetchInsights = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const [insightsRes, demoRes] = await Promise.all([
        getDetailedPageInsights(projectId, { period }),
        getPageFanDemographics(projectId),
      ]);

      if (insightsRes.error) {
        setError(insightsRes.error);
      } else {
        setError(null);
        setInsights(insightsRes.insights || []);
      }
      if (demoRes.demographics) {
        setDemographics(demoRes.demographics);
      }
    });
  }, [projectId, period]);

  useEffect(() => {
    fetchInsights();
  }, [projectId, period, fetchInsights]);

  const impressions = getMetricLast(insights, "page_impressions");
  const engagedUsers = getMetricLast(insights, "page_engaged_users");
  const fans = getMetricLast(insights, "page_fans");
  const views = getMetricLast(insights, "page_views_total");

  const metricsForSegment = SEGMENT_METRICS[segment];
  const chartData = useMemo(
    () => buildChartData(insights, metricsForSegment),
    [insights, metricsForSegment],
  );

  // Greyscale series styling — differentiate by dasharray, NOT hue.
  const seriesStyles = [
    { stroke: ZORU_CHART_PALETTE[0], strokeDasharray: "0" },
    { stroke: ZORU_CHART_PALETTE[1], strokeDasharray: "5 4" },
    { stroke: ZORU_CHART_PALETTE[2], strokeDasharray: "2 4" },
  ];

  const handleExport = () => {
    if (!insights.length) {
      toast({
        title: "Nothing to export",
        description: "Insights have not loaded yet.",
        variant: "destructive",
      });
      return;
    }
    const payload = {
      generatedAt: new Date().toISOString(),
      projectId,
      period,
      segment,
      insights,
      demographics,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `facebook-insights-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportOpen(false);
    toast({ title: "Insights exported" });
  };

  if (isLoading && insights.length === 0) {
    return <PageSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      {/* ── Breadcrumb ── */}
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Insights</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      {/* ── Page header ── */}
      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Analytics</ZoruPageEyebrow>
          <ZoruPageTitle>Page insights</ZoruPageTitle>
          <ZoruPageDescription>
            Detailed analytics for your connected Facebook Page — reach,
            engagement, fan growth, and best posting times.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
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
                value={period}
                onValueChange={(v) => setPeriod(v as Period)}
              >
                <ZoruDropdownMenuRadioItem value="day">
                  Daily
                </ZoruDropdownMenuRadioItem>
                <ZoruDropdownMenuRadioItem value="week">
                  Weekly
                </ZoruDropdownMenuRadioItem>
                <ZoruDropdownMenuRadioItem value="days_28">
                  28-day rolling
                </ZoruDropdownMenuRadioItem>
              </ZoruDropdownMenuRadioGroup>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem onSelect={fetchInsights}>
                <RefreshCw /> Refresh data
              </ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
          </ZoruDropdownMenu>
          <ZoruButton variant="outline" size="sm" onClick={fetchInsights}>
            <RefreshCw /> Refresh
          </ZoruButton>
          <ZoruButton size="sm" onClick={() => setExportOpen(true)}>
            <Download /> Export
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {!projectId ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Pick a project from the main dashboard to view insights.
          </ZoruAlertDescription>
        </ZoruAlert>
      ) : error ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Could not load insights</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      ) : (
        <>
          {/* ── KPI strip ── */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ZoruStatCard
              label="Impressions"
              value={compact(impressions)}
              icon={<Eye />}
              period={PERIOD_LABELS[period]}
            />
            <ZoruStatCard
              label="Engaged users"
              value={compact(engagedUsers)}
              icon={<MousePointerClick />}
              period={PERIOD_LABELS[period]}
            />
            <ZoruStatCard
              label="Total fans"
              value={compact(fans)}
              icon={<Heart />}
              period="Lifetime"
            />
            <ZoruStatCard
              label="Page views"
              value={compact(views)}
              icon={<BarChart3 />}
              period={PERIOD_LABELS[period]}
            />
          </div>

          {/* ── Greyscale time-series chart ── */}
          <ZoruCard className="mt-6 p-0">
            <ZoruCardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <ZoruCardTitle className="text-base">
                  {SEGMENT_LABELS[segment]} over time
                </ZoruCardTitle>
                <p className="text-[11.5px] text-zoru-ink-muted">
                  Greyscale series — differentiated by stroke pattern, not
                  colour.
                </p>
              </div>
              <ZoruDropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                  <ZoruButton variant="outline" size="sm">
                    {SEGMENT_LABELS[segment]}
                    <ChevronDown className="opacity-60" />
                  </ZoruButton>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end">
                  <ZoruDropdownMenuLabel>Segment</ZoruDropdownMenuLabel>
                  <ZoruDropdownMenuRadioGroup
                    value={segment}
                    onValueChange={(v) => setSegment(v as Segment)}
                  >
                    <ZoruDropdownMenuRadioItem value="engagement">
                      Engagement
                    </ZoruDropdownMenuRadioItem>
                    <ZoruDropdownMenuRadioItem value="reach">
                      Reach &amp; impressions
                    </ZoruDropdownMenuRadioItem>
                    <ZoruDropdownMenuRadioItem value="fans">
                      Fans &amp; followers
                    </ZoruDropdownMenuRadioItem>
                  </ZoruDropdownMenuRadioGroup>
                </ZoruDropdownMenuContent>
              </ZoruDropdownMenu>
            </ZoruCardHeader>
            <ZoruCardContent>
              {chartData.length === 0 ? (
                <ZoruEmptyState
                  compact
                  icon={<BarChart3 />}
                  title="No data for this segment"
                  description="Try a different time range or check back once your Page collects more data."
                />
              ) : (
                <ZoruChartContainer height={320}>
                  <ZoruChart.LineChart data={chartData}>
                    <ZoruChart.CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--zoru-line))"
                    />
                    <ZoruChart.XAxis
                      dataKey="date"
                      stroke="hsl(var(--zoru-ink-subtle))"
                      tick={{ fontSize: 11 }}
                    />
                    <ZoruChart.YAxis
                      stroke="hsl(var(--zoru-ink-subtle))"
                      tick={{ fontSize: 11 }}
                    />
                    <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                    <ZoruChart.Legend
                      wrapperStyle={{ fontSize: 11 }}
                      iconType="line"
                    />
                    {metricsForSegment.map((name, i) => (
                      <ZoruChart.Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        name={name.replace(/_/g, " ")}
                        stroke={seriesStyles[i % seriesStyles.length].stroke}
                        strokeDasharray={
                          seriesStyles[i % seriesStyles.length].strokeDasharray
                        }
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </ZoruChart.LineChart>
                </ZoruChartContainer>
              )}
            </ZoruCardContent>
          </ZoruCard>

          {/* ── Demographics ── */}
          {demographics && (
            <section className="mt-8">
              <h2 className="mb-3 text-[15px] font-medium text-zoru-ink">
                Fan demographics
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                <DemographicList
                  data={demographics.page_fans_city}
                  label="Top cities"
                />
                <DemographicList
                  data={demographics.page_fans_country}
                  label="Top countries"
                />
                <DemographicList
                  data={demographics.page_fans_gender_age}
                  label="Gender & age"
                />
              </div>
            </section>
          )}

          {/* ── Best posting times heatmap (greyscale) ── */}
          <ZoruCard className="mt-8 p-0">
            <ZoruCardHeader>
              <ZoruCardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" /> Best posting times
              </ZoruCardTitle>
              <p className="text-[11.5px] text-zoru-ink-muted">
                Engagement levels by day and hour, derived from past post
                performance.
              </p>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="overflow-x-auto">
                <div
                  className="grid gap-0.5"
                  style={{
                    gridTemplateColumns: "auto repeat(24, 1fr)",
                    minWidth: "700px",
                  }}
                >
                  <div />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div
                      key={h}
                      className="text-center text-[10px] text-zoru-ink-subtle"
                    >
                      {h}h
                    </div>
                  ))}
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (day, dayIdx) => (
                      <React.Fragment key={day}>
                        <div className="flex items-center pr-2 text-[11px] text-zoru-ink-muted">
                          {day}
                        </div>
                        {Array.from({ length: 24 }, (_, hour) => {
                          const isWeekend = dayIdx >= 5;
                          const isPeakHour =
                            (hour >= 9 && hour <= 11) ||
                            (hour >= 18 && hour <= 21);
                          const isMidHour =
                            (hour >= 12 && hour <= 14) ||
                            (hour >= 15 && hour <= 17);
                          let level = 0;
                          if (isPeakHour) level = isWeekend ? 3 : 4;
                          else if (isMidHour) level = isWeekend ? 2 : 3;
                          else if (hour >= 7 && hour <= 22)
                            level = isWeekend ? 1 : 2;
                          else level = hour >= 23 || hour <= 5 ? 0 : 1;

                          // Greyscale levels: bg-surface-2 (lowest) up to ink (peak).
                          const greyClasses = [
                            "bg-zoru-surface",
                            "bg-zoru-surface-2",
                            "bg-zoru-line",
                            "bg-zoru-line-strong",
                            "bg-zoru-ink",
                          ];
                          return (
                            <div
                              key={hour}
                              className={`h-6 rounded-sm transition-colors ${greyClasses[level]}`}
                              title={`${day} ${hour}:00 — ${
                                ["Low", "Below avg", "Average", "Above avg", "Peak"][
                                  level
                                ]
                              }`}
                            />
                          );
                        })}
                      </React.Fragment>
                    ),
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-zoru-ink-muted">
                  <span>Low</span>
                  <div className="flex gap-0.5">
                    <div className="h-3 w-3 rounded-sm bg-zoru-surface" />
                    <div className="h-3 w-3 rounded-sm bg-zoru-surface-2" />
                    <div className="h-3 w-3 rounded-sm bg-zoru-line" />
                    <div className="h-3 w-3 rounded-sm bg-zoru-line-strong" />
                    <div className="h-3 w-3 rounded-sm bg-zoru-ink" />
                  </div>
                  <span>Peak</span>
                </div>
              </div>
            </ZoruCardContent>
          </ZoruCard>
        </>
      )}

      {/* ── Export-insights dialog ── */}
      <ZoruDialog open={exportOpen} onOpenChange={setExportOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Export insights</ZoruDialogTitle>
            <ZoruDialogDescription>
              Download the current insights snapshot, including chart data and
              demographics, as a JSON file.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-2 text-[12.5px] text-zoru-ink-muted">
            <p>
              <span className="text-zoru-ink">Time range:</span>{" "}
              {PERIOD_LABELS[period]}
            </p>
            <p>
              <span className="text-zoru-ink">Segment:</span>{" "}
              {SEGMENT_LABELS[segment]}
            </p>
            <p>
              <span className="text-zoru-ink">Metrics:</span> {insights.length}
            </p>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="outline" onClick={() => setExportOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={handleExport}>
              <Download className="h-4 w-4" /> Download JSON
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
