'use client';

import {
  Badge,
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
  DatePicker,
  EmptyState,
  cn,
} from '@/components/zoruui';
import {
  format,
  subDays } from 'date-fns';
import { Activity,
  BarChart3,
  Loader2,
  RefreshCw,
  Smartphone } from 'lucide-react';

import {
  getAnalytics,
  type SabwaAnalyticsPayload,
  type SabwaAnalyticsRange,
  } from '@/app/actions/sabwa.actions';
import { useSabwaSession } from '@/lib/sabwa/session-context';

/**
 * /sabwa/analytics — KPI cards + Recharts dashboards for the active session.
 *
 * Wires up to `getAnalytics({ sessionId, range })`. While the Phase-1 stub
 * returns an empty payload, every chart renders an <EmptyState> instead of
 * a "Phase 1" error, so the page is usable end-to-end today.
 *
 * Visual layer migrated to ZoruUI. The range picker is rendered as a
 * segmented Button group (no tab UI per ZoruUI design rules).
 */

import * as React from 'react';
import Link from 'next/link';

import { ChartAiUsage } from './_components/chart-ai-usage';
import { ChartGroupHeatmap } from './_components/chart-group-heatmap';
import { ChartHourlySendPattern } from './_components/chart-hourly-send-pattern';
import { ChartMessagesByDay } from './_components/chart-messages-by-day';
import { ChartResponseHistogram } from './_components/chart-response-histogram';
import { ChartTopContacts } from './_components/chart-top-contacts';

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

type Tone = 'success' | 'warning' | 'danger';

function banRiskTone(score: number): Tone {
  if (score < 30) return 'success';
  if (score < 70) return 'warning';
  return 'danger';
}

export default function AnalyticsPage() {
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';

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
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getAnalytics({
        sessionId,
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
  }, [sessionId, range, customFrom, customTo]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const kpis = analytics?.kpis;

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <EmptyState
          icon={<Smartphone />}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button size="md">Open accounts</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Analytics</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[24px] leading-[1.2] tracking-[-0.015em] text-zoru-ink">
              Analytics
            </h1>
            <p className="mt-1 text-[13px] text-zoru-ink-muted">
              Throughput, responsiveness, and anti-ban posture across this
              SabWa session.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented range picker — replaces the previous Select */}
          <div
            role="group"
            aria-label="Date range"
            className="inline-flex rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-1"
          >
            {RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={range === opt.value ? 'default' : 'ghost'}
                onClick={() => setRange(opt.value)}
                className="rounded-[calc(var(--zoru-radius)-2px)]"
              >
                {opt.label}
              </Button>
            ))}
          </div>
          {range === 'custom' ? (
            <>
              <DatePicker
                value={customFrom}
                onChange={setCustomFrom}
                placeholder="From"
                className="w-[160px]"
              />
              <DatePicker
                value={customTo}
                onChange={setCustomTo}
                placeholder="To"
                className="w-[160px]"
              />
            </>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="gap-1.5"
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
        <Card className="border-zoru-danger/40 bg-zoru-danger/5">
          <ZoruCardHeader className="pb-2">
            <ZoruCardTitle className="text-base text-zoru-danger-ink">
              Couldn&apos;t load analytics
            </ZoruCardTitle>
            <ZoruCardDescription>{error}</ZoruCardDescription>
          </ZoruCardHeader>
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
              className="h-3.5 w-3.5 text-zoru-ink-muted"
              aria-hidden
            />
          }
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-base">
              Messages in/out by day
            </ZoruCardTitle>
            <ZoruCardDescription>
              Inbound vs outbound volume per day.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ChartMessagesByDay data={analytics?.messagesByDay ?? []} />
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-base">
              Response time histogram
            </ZoruCardTitle>
            <ZoruCardDescription>
              Distribution of reply latency buckets.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ChartResponseHistogram
              data={analytics?.responseHistogram ?? []}
            />
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-base">
              Top 10 contacts by volume
            </ZoruCardTitle>
            <ZoruCardDescription>
              Highest-traffic contacts in the selected range.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ChartTopContacts data={analytics?.topContacts ?? []} />
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-base">
              Group activity heatmap
            </ZoruCardTitle>
            <ZoruCardDescription>
              Hour × day grid coloured by group message intensity.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ChartGroupHeatmap data={analytics?.groupHeatmap ?? []} />
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-base">
              Hourly send pattern
            </ZoruCardTitle>
            <ZoruCardDescription>
              Outbound throughput per hour with safe / elevated bands.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ChartHourlySendPattern
              data={analytics?.hourlySendPattern ?? []}
            />
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-base">AI usage by day</ZoruCardTitle>
            <ZoruCardDescription>
              Stacked breakdown of suggest, summarise, and translate calls.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ChartAiUsage data={analytics?.aiUsageByDay ?? []} />
          </ZoruCardContent>
        </Card>
      </div>

      <p className="text-[11px] text-zoru-ink-muted">
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
  tone?: Tone;
  hint?: React.ReactNode;
}

function KpiCard({ label, value, loading, tone, hint }: KpiCardProps) {
  return (
    <Card>
      <ZoruCardHeader className="pb-1">
        <ZoruCardDescription className="flex items-center justify-between text-[11px] uppercase tracking-wide">
          <span>{label}</span>
          {hint}
        </ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent className="pt-0">
        <div className="flex items-baseline justify-between gap-2">
          <div
            className={cn(
              'text-2xl font-semibold tabular-nums text-zoru-ink',
            )}
          >
            {loading ? (
              <span className="text-zoru-ink-muted">…</span>
            ) : (
              value
            )}
          </div>
          {tone ? (
            <Badge
              variant={tone}
              className="px-1.5 py-0 text-[10px]"
            >
              {tone === 'success'
                ? 'Healthy'
                : tone === 'warning'
                  ? 'Watch'
                  : 'High'}
            </Badge>
          ) : null}
        </div>
      </ZoruCardContent>
    </Card>
  );
}
