'use client';

/**
 * UsageClient - workspace-wide flow execution stats.
 *
 * Renders:
 *   - Six KPI StatCards (total / success rate / errors / p95 duration / steps / api)
 *   - Daily run sparkline (CSS bars, no charting lib)
 *   - Top-10 flows by run count
 *   - Top-5 failing flows
 *   - Limit-alert configuration
 *
 * Window selector: 7 / 30 / 90 days. Pure 20ui design system.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Award,
  ChartLine,
  ChartColumn,
  RefreshCw,
  Timer,
  TriangleAlert,
  Bell,
  Save,
  Check,
  ListTree,
  Globe,
} from 'lucide-react';
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  StatCard,
  Field,
  Input,
  Checkbox,
  SegmentedControl,
  Alert,
  EmptyState,
  Spinner,
  Badge,
  useToast,
} from '@/components/sabcrm/20ui';
import { useT } from '@/lib/i18n/client';

type UsageResponse = {
  windowDays: number;
  since: string;
  summary: {
    total: number;
    success: number;
    errored: number;
    running: number;
    cancelled: number;
    successRate: number;
    avgDurationMs: number;
    p95DurationMs: number;
    steps: number;
    apiUsage: number;
    trends?: {
      total: number;
      successRate: number;
      errored: number;
      p95DurationMs: number;
      steps: number;
      apiUsage: number;
    };
  };
  daily: { date: string; count: number; errors: number; steps: number }[];
  topFlows: { flowId: string; name: string; runs: number }[];
  topFailing: { flowId: string; name: string; errors: number }[];
};

const WINDOWS: Array<{ days: number; labelKey: string }> = [
  { days: 7, labelKey: 'sabflow.usage.window.7days' },
  { days: 30, labelKey: 'sabflow.usage.window.30days' },
  { days: 90, labelKey: 'sabflow.usage.window.90days' },
];

export function UsageClient() {
  const { t } = useT();
  const [data, setData] = useState<UsageResponse | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sabflow/usage?days=${days}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(t('sabflow.usage.error.loadFailedStatus', { status: res.status }));
      const json = (await res.json()) as UsageResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('sabflow.usage.error.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [days, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const windowItems = WINDOWS.map((w) => ({
    value: String(w.days),
    label: t(w.labelKey),
  }));

  return (
    <div className="flex flex-col h-full">
      <PageHeader className="shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)] shrink-0"
            aria-hidden="true"
          >
            <ChartLine className="h-4 w-4" strokeWidth={2} />
          </span>
          <PageHeaderHeading>
            <PageTitle>{t('sabflow.usage.title')}</PageTitle>
            <PageDescription>{t('sabflow.usage.pastDays', { days })}</PageDescription>
          </PageHeaderHeading>
        </div>
        <PageActions className="flex-wrap">
          <SegmentedControl
            size="sm"
            aria-label={t('sabflow.usage.title')}
            items={windowItems}
            value={String(days)}
            onChange={(v) => setDays(Number(v))}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            iconLeft={RefreshCw}
            className={loading ? '[&_svg]:animate-spin' : undefined}
          >
            <span className="hidden sm:inline">{t('action.refresh')}</span>
          </Button>
        </PageActions>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {loading && !data ? (
          <div className="flex h-40 items-center justify-center gap-2 text-[var(--st-text-secondary)]">
            <Spinner size="sm" label={t('sabflow.usage.loading')} />
            <span className="text-[12px]">{t('sabflow.usage.loading')}</span>
          </div>
        ) : error ? (
          <Alert tone="danger" icon={TriangleAlert} title={t('sabflow.usage.error.loadFailed')}>
            {error}
          </Alert>
        ) : data ? (
          <>
            <KpiCards data={data} />
            <DailyChart data={data} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <TopFlowsCard data={data} />
              <TopFailingCard data={data} />
            </div>
            <LimitAlertsCard />
          </>
        ) : null}
      </div>
    </div>
  );
}

/* KPI cards */

function deltaFor(trend: number | undefined, goodDirection: 'up' | 'down') {
  if (trend === undefined) return undefined;
  const isGood = goodDirection === 'up' ? trend > 0 : trend < 0;
  const tone: 'up' | 'down' | 'neutral' = trend === 0 ? 'neutral' : isGood ? 'up' : 'down';
  return { value: `${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`, tone };
}

function KpiCards({ data }: { data: UsageResponse }) {
  const { t, locale } = useT();
  const { summary } = data;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
      <StatCard
        icon={Activity}
        label={t('sabflow.usage.kpi.totalRuns')}
        value={summary.total.toLocaleString(locale)}
        delta={deltaFor(summary.trends?.total, 'up')}
      />
      <StatCard
        icon={Award}
        label={t('sabflow.usage.kpi.successRate')}
        value={`${(summary.successRate * 100).toFixed(1)}%`}
        delta={deltaFor(summary.trends?.successRate, 'up')}
      />
      <StatCard
        icon={TriangleAlert}
        label={t('sabflow.usage.kpi.errors')}
        value={summary.errored.toLocaleString(locale)}
        delta={deltaFor(summary.trends?.errored, 'down')}
      />
      <StatCard
        icon={Timer}
        label={t('sabflow.usage.kpi.p95Duration')}
        value={formatDuration(summary.p95DurationMs)}
        delta={deltaFor(summary.trends?.p95DurationMs, 'down')}
      />
      <StatCard
        icon={ListTree}
        label={t('sabflow.usage.kpi.steps', { defaultValue: 'Workspace Steps' })}
        value={(summary.steps ?? 0).toLocaleString(locale)}
        delta={deltaFor(summary.trends?.steps, 'up')}
      />
      <StatCard
        icon={Globe}
        label={t('sabflow.usage.kpi.apiUsage', { defaultValue: 'Global API Calls' })}
        value={(summary.apiUsage ?? 0).toLocaleString(locale)}
        delta={deltaFor(summary.trends?.apiUsage, 'up')}
      />
    </div>
  );
}

/* Daily sparkline */

function DailyChart({ data }: { data: UsageResponse }) {
  const { t } = useT();
  const [mode, setMode] = useState<'runs' | 'steps'>('runs');

  if (data.daily.length === 0) {
    return (
      <Card padding="none">
        <EmptyState
          icon={ChartColumn}
          title={t('sabflow.usage.dailyChart.empty')}
          size="sm"
        />
      </Card>
    );
  }

  const max = Math.max(...data.daily.map((d) => (mode === 'runs' ? d.count : d.steps || 0)));

  return (
    <Card padding="md">
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
          <ChartColumn className="h-3 w-3" aria-hidden="true" />
          {mode === 'runs'
            ? t('sabflow.usage.dailyChart.title', { defaultValue: 'Daily Runs' })
            : t('sabflow.usage.dailyChart.stepsTitle', { defaultValue: 'Daily Steps' })}
        </CardTitle>
        <SegmentedControl
          size="sm"
          aria-label={t('sabflow.usage.dailyChart.title', { defaultValue: 'Daily Runs' })}
          items={[
            { value: 'runs', label: t('sabflow.usage.dailyChart.modeRuns', { defaultValue: 'Runs' }) },
            { value: 'steps', label: t('sabflow.usage.dailyChart.modeSteps', { defaultValue: 'Steps' }) },
          ]}
          value={mode}
          onChange={(v) => setMode(v as 'runs' | 'steps')}
        />
      </CardHeader>
      <CardBody>
        <div className="flex items-end gap-0.5 sm:gap-1 h-24 sm:h-32">
          {data.daily.map((d) => {
            const val = mode === 'runs' ? d.count : d.steps || 0;
            const heightPct = max > 0 ? Math.max(2, (val / max) * 100) : 2;
            const errHeightPct = mode === 'runs' && max > 0 ? Math.max(0, (d.errors / max) * 100) : 0;
            return (
              <div
                key={d.date}
                className="flex flex-1 flex-col items-center gap-1 group"
                title={
                  mode === 'runs'
                    ? t('sabflow.usage.dailyChart.tooltip', { date: d.date, count: d.count, errors: d.errors })
                    : t('sabflow.usage.dailyChart.tooltipSteps', { date: d.date, steps: d.steps || 0 })
                }
              >
                <div className="relative w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t bg-[var(--st-accent)]/30 transition-colors group-hover:bg-[var(--st-accent)]/60"
                    style={{ height: `${heightPct}%` }}
                  />
                  {mode === 'runs' && errHeightPct > 0 && (
                    <div
                      className="absolute bottom-0 w-full rounded-t bg-[var(--st-danger)]/60"
                      style={{ height: `${errHeightPct}%` }}
                    />
                  )}
                </div>
                <span className="hidden sm:inline text-[9px] text-[var(--st-text-tertiary)] tabular-nums">
                  {d.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

/* Top flows */

function TopFlowsCard({ data }: { data: UsageResponse }) {
  const { t, locale } = useT();
  return (
    <Card padding="md">
      <CardHeader>
        <CardTitle className="text-[11px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
          {t('sabflow.usage.topFlows.title')}
        </CardTitle>
      </CardHeader>
      <CardBody>
        {data.topFlows.length === 0 ? (
          <p className="text-[12px] text-[var(--st-text-secondary)]">{t('sabflow.usage.topFlows.empty')}</p>
        ) : (
          <ul className="space-y-1.5">
            {data.topFlows.map((f, idx) => (
              <li key={f.flowId} className="flex items-center gap-2">
                <span className="w-5 text-[10.5px] tabular-nums text-[var(--st-text-secondary)]">
                  #{idx + 1}
                </span>
                <Link
                  href={`/dashboard/sabflow/flow-builder/${f.flowId}`}
                  className="flex-1 truncate text-[12px] font-medium text-[var(--st-text)] hover:text-[var(--st-accent)]"
                >
                  {f.name}
                </Link>
                <span className="tabular-nums text-[11.5px] text-[var(--st-text-secondary)]">
                  {f.runs.toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function TopFailingCard({ data }: { data: UsageResponse }) {
  const { t } = useT();
  return (
    <Card padding="md">
      <CardHeader>
        <CardTitle className="text-[11px] font-medium text-[var(--st-danger)] uppercase tracking-wide">
          {t('sabflow.usage.topFailing.title')}
        </CardTitle>
      </CardHeader>
      <CardBody>
        {data.topFailing.length === 0 ? (
          <p className="text-[12px] text-[var(--st-text-secondary)]">{t('sabflow.usage.topFailing.empty')}</p>
        ) : (
          <ul className="space-y-1.5">
            {data.topFailing.map((f, idx) => (
              <li key={f.flowId} className="flex items-center gap-2">
                <span className="w-5 text-[10.5px] tabular-nums text-[var(--st-text-secondary)]">
                  #{idx + 1}
                </span>
                <Link
                  href={`/dashboard/sabflow/flow-builder/${f.flowId}`}
                  className="flex-1 truncate text-[12px] font-medium text-[var(--st-text)] hover:text-[var(--st-accent)]"
                >
                  {f.name}
                </Link>
                <Link href="/dashboard/sabflow/executions?status=error" aria-label={`${f.errors} errors`}>
                  <Badge tone="danger" kind="soft" className="tabular-nums">
                    {f.errors}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

/* Limit Alerts */

function LimitAlertsCard() {
  const { t } = useT();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [runsThreshold, setRunsThreshold] = useState(1000);
  const [errorsThreshold, setErrorsThreshold] = useState(100);
  const [emails, setEmails] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/sabflow/usage/alerts')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setEnabled(data.enabled ?? false);
          setRunsThreshold(data.thresholds?.runs ?? 1000);
          setErrorsThreshold(data.thresholds?.errors ?? 100);
          setEmails((data.emails ?? []).join(', '));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const emailArray = emails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      await fetch('/api/sabflow/usage/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          thresholds: { runs: runsThreshold, errors: errorsThreshold },
          emails: emailArray,
        }),
      });
      setSaveSuccess(true);
      toast.success(t('action.saved', { defaultValue: 'Saved!' }));
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error(t('sabflow.usage.error.loadFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card padding="lg" className="mt-4 sm:mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-[var(--st-text)]">
          <Bell className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
          {t('sabflow.usage.alerts.title', { defaultValue: 'Limit Alerts' })}
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex-1 space-y-4 max-w-sm">
            <Checkbox
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              label={t('sabflow.usage.alerts.enable', { defaultValue: 'Enable usage alerts' })}
            />

            <div className="space-y-3 pl-6">
              <Field label={t('sabflow.usage.alerts.runsThreshold', { defaultValue: 'Monthly Runs Threshold' })}>
                <Input
                  type="number"
                  inputSize="sm"
                  disabled={!enabled}
                  value={runsThreshold}
                  onChange={(e) => setRunsThreshold(Number(e.target.value))}
                />
              </Field>

              <Field label={t('sabflow.usage.alerts.errorsThreshold', { defaultValue: 'Monthly Errors Threshold' })}>
                <Input
                  type="number"
                  inputSize="sm"
                  disabled={!enabled}
                  value={errorsThreshold}
                  onChange={(e) => setErrorsThreshold(Number(e.target.value))}
                />
              </Field>

              <Field label={t('sabflow.usage.alerts.emails', { defaultValue: 'Alert Emails (comma separated)' })}>
                <Input
                  type="text"
                  inputSize="sm"
                  disabled={!enabled}
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="admin@example.com"
                />
              </Field>

              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                loading={saving}
                iconLeft={saveSuccess ? Check : Save}
              >
                {saveSuccess
                  ? t('action.saved', { defaultValue: 'Saved!' })
                  : t('action.save', { defaultValue: 'Save Config' })}
              </Button>
            </div>
          </div>

          <div className="flex-1 rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-4 text-[12px] text-[var(--st-text-secondary)] leading-relaxed">
            <p className="mb-2 font-medium text-[var(--st-text)]">
              {t('sabflow.usage.alerts.infoTitle', { defaultValue: 'How Alerts Work' })}
            </p>
            <p className="mb-2">
              {t('sabflow.usage.alerts.info1', {
                defaultValue:
                  'When enabled, we will send an email to the provided addresses if your workspace usage exceeds the configured thresholds within a 30-day rolling window.',
              })}
            </p>
            <p>
              {t('sabflow.usage.alerts.info2', {
                defaultValue: 'Alerts are evaluated daily and will only be sent once per threshold breach.',
              })}
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
