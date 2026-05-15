'use client';

/**
 * /sabwa/analytics — KPI cards + Recharts dashboards for the active session.
 *
 * Wires up to `getAnalytics({ sessionId, range })`. While the Phase-1 stub
 * returns an empty payload, every chart renders an <EmptyState> instead of
 * a "Phase 1" error, so the page is usable end-to-end today.
 */

import * as React from 'react';
import { format, subDays } from 'date-fns';
import { Activity, BarChart3, Loader2, RefreshCw } from 'lucide-react';

import {
  getAnalytics,
  type SabwaAnalyticsPayload,
  type SabwaAnalyticsRange,
} from '@/app/actions/sabwa.actions';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { ChartAiUsage } from './_components/chart-ai-usage';
import { ChartGroupHeatmap } from './_components/chart-group-heatmap';
import { ChartHourlySendPattern } from './_components/chart-hourly-send-pattern';
import { ChartMessagesByDay } from './_components/chart-messages-by-day';
import { ChartResponseHistogram } from './_components/chart-response-histogram';
import { ChartTopContacts } from './_components/chart-top-contacts';

// Phase 1: client doesn't yet have a real session picker — use a stub id
// so server actions can be invoked. Replace once `SessionSwitcher` exposes
// the active session id.
const STUB_SESSION_ID = 'stub-primary';

const RANGE_OPTIONS: { value: SabwaAnalyticsRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
];

function formatMs(ms: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  return `${(secs / 60).toFixed(1)}m`;
}

function formatPct(ratio: number): string {
  if (!ratio || ratio < 0) return '0%';
  return `${Math.round(ratio * 100)}%`;
}

function banRiskTone(score: number): 'success' | 'warning' | 'destructive' {
  if (score < 30) return 'success';
  if (score < 70) return 'warning';
  return 'destructive';
}

export default function AnalyticsPage() {
  const [range, setRange] = React.useState<SabwaAnalyticsRange>('7d');
  const [customFrom, setCustomFrom] = React.useState<Date | undefined>(
    subDays(new Date(), 14),
  );
  const [customTo, setCustomTo] = React.useState<Date | undefined>(new Date());
  const [analytics, setAnalytics] =
    React.useState<SabwaAnalyticsPayload | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAnalytics({
        sessionId: STUB_SESSION_ID,
        range,
        from: range === 'custom' ? customFrom : undefined,
        to: range === 'custom' ? customTo : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        setAnalytics(null);
        return;
      }
      setAnalytics(res.analytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [range, customFrom, customTo]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const kpis = analytics?.kpis;

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-secondary p-3">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Throughput, responsiveness, and anti-ban posture across this
              SabWa session.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={range}
            onValueChange={(v) => setRange(v as SabwaAnalyticsRange)}
          >
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {range === 'custom' ? (
            <>
              <DatePicker
                date={customFrom}
                setDate={setCustomFrom}
                placeholder="From"
                className="h-9 w-[150px]"
              />
              <DatePicker
                date={customTo}
                setDate={setCustomTo}
                placeholder="To"
                className="h-9 w-[150px]"
              />
            </>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="h-9 gap-1.5"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">
              Couldn&apos;t load analytics
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* KPI grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Today in"
          value={kpis?.todayIn ?? 0}
          loading={loading}
        />
        <KpiCard
          label="Today out"
          value={kpis?.todayOut ?? 0}
          loading={loading}
        />
        <KpiCard
          label="Median response"
          value={formatMs(kpis?.medianResponseMs ?? 0)}
          loading={loading}
        />
        <KpiCard
          label="Scheduled hit rate"
          value={formatPct(kpis?.scheduledHitRate ?? 0)}
          loading={loading}
        />
        <KpiCard
          label="AI calls"
          value={kpis?.aiCalls ?? 0}
          loading={loading}
        />
        <KpiCard
          label="Ban-risk score"
          value={kpis ? `${kpis.banRiskScore}/100` : '—'}
          loading={loading}
          tone={kpis ? banRiskTone(kpis.banRiskScore) : undefined}
          hint={
            <Activity
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden
            />
          }
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Messages in/out by day</CardTitle>
            <CardDescription>
              Inbound vs outbound volume per day.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartMessagesByDay data={analytics?.messagesByDay ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Response time histogram</CardTitle>
            <CardDescription>
              Distribution of reply latency buckets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartResponseHistogram
              data={analytics?.responseHistogram ?? []}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Top 10 contacts by volume
            </CardTitle>
            <CardDescription>
              Highest-traffic contacts in the selected range.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartTopContacts data={analytics?.topContacts ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Group activity heatmap</CardTitle>
            <CardDescription>
              Hour × day grid coloured by group message intensity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartGroupHeatmap data={analytics?.groupHeatmap ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hourly send pattern</CardTitle>
            <CardDescription>
              Outbound throughput per hour with safe / elevated bands.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartHourlySendPattern
              data={analytics?.hourlySendPattern ?? []}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI usage by day</CardTitle>
            <CardDescription>
              Stacked breakdown of suggest, summarise, and translate calls.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartAiUsage data={analytics?.aiUsageByDay ?? []} />
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Range:{' '}
        {range === 'custom' && customFrom && customTo
          ? `${format(customFrom, 'PP')} – ${format(customTo, 'PP')}`
          : (RANGE_OPTIONS.find((o) => o.value === range)?.label ?? range)}
        .
      </p>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  loading?: boolean;
  tone?: 'success' | 'warning' | 'destructive';
  hint?: React.ReactNode;
}

function KpiCard({ label, value, loading, tone, hint }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardDescription className="flex items-center justify-between text-[11px] uppercase tracking-wide">
          <span>{label}</span>
          {hint}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-2xl font-semibold tabular-nums">
            {loading ? <span className="text-muted-foreground">…</span> : value}
          </div>
          {tone ? (
            <Badge variant={tone} className="px-1.5 py-0 text-[10px]">
              {tone === 'success'
                ? 'Healthy'
                : tone === 'warning'
                  ? 'Watch'
                  : 'High'}
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
