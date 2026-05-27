'use client';

/**
 * UsageClient — workspace-wide flow execution stats.
 *
 * Renders:
 *   - Four KPI cards (total / success rate / errors / p95 duration)
 *   - Daily run sparkline (CSS bars, no charting lib)
 *   - Top-10 flows by run count
 *   - Top-5 failing flows
 *
 * Window selector: 7 / 30 / 90 days.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LuActivity,
  LuAward,
  LuChartLine,
  LuChartNoAxesColumn,
  LuLoader,
  LuRefreshCw,
  LuTimer,
  LuTriangleAlert,
  LuBell,
  LuSave,
  LuCheck,
  LuListTree,
  LuGlobe,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
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
  const { t, locale } = useT();
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--gray-4)] px-4 sm:px-6 py-3 sm:py-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/40 dark:text-zoru-ink-muted shrink-0">
          <LuChartLine className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <h1 className="text-sm sm:text-[15px] font-semibold text-[var(--gray-12)]">
            {t('sabflow.usage.title')}
          </h1>
          <p className="text-[11px] sm:text-[11.5px] text-[var(--gray-9)] truncate">
            {t('sabflow.usage.pastDays', { days })}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <div className="flex items-center gap-0.5 rounded-lg bg-[var(--gray-3)] p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                type="button"
                onClick={() => setDays(w.days)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors',
                  days === w.days
                    ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                    : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
                )}
              >
                {t(w.labelKey)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-50"
          >
            <LuRefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            <span className="hidden sm:inline">{t('action.refresh')}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {loading && !data ? (
          <div className="flex h-40 items-center justify-center gap-2 text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
            <span className="text-[12px]">{t('sabflow.usage.loading')}</span>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2 text-[12px] text-zoru-ink">
            <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
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

/* ── KPI cards ───────────────────────────────────────────────────────────── */

function KpiCards({ data }: { data: UsageResponse }) {
  const { t, locale } = useT();
  const { summary } = data;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
      <Kpi
        icon={<LuActivity className="h-3.5 w-3.5" />}
        label={t('sabflow.usage.kpi.totalRuns')}
        value={summary.total.toLocaleString(locale)}
        accent="text-zoru-ink dark:text-zoru-ink-muted"
        trend={summary.trends?.total}
        goodDirection="up"
      />
      <Kpi
        icon={<LuAward className="h-3.5 w-3.5" />}
        label={t('sabflow.usage.kpi.successRate')}
        value={`${(summary.successRate * 100).toFixed(1)}%`}
        accent="text-zoru-ink dark:text-zoru-ink-muted"
        trend={summary.trends?.successRate}
        goodDirection="up"
      />
      <Kpi
        icon={<LuTriangleAlert className="h-3.5 w-3.5" />}
        label={t('sabflow.usage.kpi.errors')}
        value={summary.errored.toLocaleString(locale)}
        accent="text-zoru-ink dark:text-zoru-ink-muted"
        trend={summary.trends?.errored}
        goodDirection="down"
      />
      <Kpi
        icon={<LuTimer className="h-3.5 w-3.5" />}
        label={t('sabflow.usage.kpi.p95Duration')}
        value={formatDuration(summary.p95DurationMs)}
        accent="text-zoru-ink dark:text-zoru-ink-muted"
        trend={summary.trends?.p95DurationMs}
        goodDirection="down"
      />
      <Kpi
        icon={<LuListTree className="h-3.5 w-3.5" />}
        label={t('sabflow.usage.kpi.steps', { defaultValue: 'Workspace Steps' })}
        value={(summary.steps ?? 0).toLocaleString(locale)}
        accent="text-zoru-ink dark:text-zoru-ink-muted"
        trend={summary.trends?.steps}
        goodDirection="up"
      />
      <Kpi
        icon={<LuGlobe className="h-3.5 w-3.5" />}
        label={t('sabflow.usage.kpi.apiUsage', { defaultValue: 'Global API Calls' })}
        value={(summary.apiUsage ?? 0).toLocaleString(locale)}
        accent="text-zoru-ink dark:text-zoru-ink-muted"
        trend={summary.trends?.apiUsage}
        goodDirection="up"
      />
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  accent,
  trend,
  goodDirection = 'up',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  trend?: number;
  goodDirection?: 'up' | 'down';
}) {
  const isGood = goodDirection === 'up' ? (trend ?? 0) > 0 : (trend ?? 0) < 0;
  const trendColor = trend === 0 || trend === undefined
    ? 'text-[var(--gray-9)]' 
    : isGood 
      ? 'text-zoru-ink dark:text-zoru-ink-muted' 
      : 'text-zoru-ink dark:text-zoru-ink-muted';

  return (
    <div className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 sm:px-4 py-2.5 sm:py-3">
      <div className={cn('flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-medium', accent)}>
        {icon}
        <span className="uppercase tracking-wide truncate">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[17px] sm:text-[20px] font-semibold tabular-nums text-[var(--gray-12)]">
          {value}
        </span>
        {trend !== undefined && (
          <span className={cn('text-[10px] sm:text-[11px] font-medium tabular-nums', trendColor)}>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Daily sparkline ─────────────────────────────────────────────────────── */

function DailyChart({ data }: { data: UsageResponse }) {
  const { t } = useT();
  const [mode, setMode] = useState<'runs' | 'steps'>('runs');

  if (data.daily.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-[var(--gray-5)] text-[12px] text-[var(--gray-9)]">
        {t('sabflow.usage.dailyChart.empty')}
      </div>
    );
  }
  
  const max = Math.max(...data.daily.map((d) => mode === 'runs' ? d.count : (d.steps || 0)));
  
  return (
    <div className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
          <LuChartNoAxesColumn className="h-3 w-3" />
          {mode === 'runs' 
            ? t('sabflow.usage.dailyChart.title', { defaultValue: 'Daily Runs' })
            : t('sabflow.usage.dailyChart.stepsTitle', { defaultValue: 'Daily Steps' })}
        </div>
        <div className="flex items-center gap-1 bg-[var(--gray-3)] rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setMode('runs')}
            className={cn(
              'rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors',
              mode === 'runs' ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm' : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]'
            )}
          >
            {t('sabflow.usage.dailyChart.modeRuns', { defaultValue: 'Runs' })}
          </button>
          <button
            type="button"
            onClick={() => setMode('steps')}
            className={cn(
              'rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors',
              mode === 'steps' ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm' : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]'
            )}
          >
            {t('sabflow.usage.dailyChart.modeSteps', { defaultValue: 'Steps' })}
          </button>
        </div>
      </div>
      <div className="flex items-end gap-0.5 sm:gap-1 h-24 sm:h-32">
        {data.daily.map((d) => {
          const val = mode === 'runs' ? d.count : (d.steps || 0);
          const heightPct = max > 0 ? Math.max(2, (val / max) * 100) : 2;
          const errHeightPct = mode === 'runs' && max > 0 ? Math.max(0, (d.errors / max) * 100) : 0;
          return (
            <div
              key={d.date}
              className="flex flex-1 flex-col items-center gap-1 group"
              title={mode === 'runs' 
                ? t('sabflow.usage.dailyChart.tooltip', { date: d.date, count: d.count, errors: d.errors })
                : t('sabflow.usage.dailyChart.tooltipSteps', { date: d.date, steps: d.steps || 0 })}
            >
              <div className="relative w-full flex-1 flex items-end">
                <div
                  className={cn(
                    "w-full rounded-t transition-colors",
                    mode === 'runs' 
                      ? "bg-zoru-ink/30 group-hover:bg-zoru-ink/60" 
                      : "bg-zoru-ink/30 group-hover:bg-zoru-ink/60"
                  )}
                  style={{ height: `${heightPct}%` }}
                />
                {mode === 'runs' && errHeightPct > 0 && (
                  <div
                    className="absolute bottom-0 w-full rounded-t bg-zoru-ink/60"
                    style={{ height: `${errHeightPct}%` }}
                  />
                )}
              </div>
              <span className="hidden sm:inline text-[9px] text-[var(--gray-8)] tabular-nums">
                {d.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Top flows ───────────────────────────────────────────────────────────── */

function TopFlowsCard({ data }: { data: UsageResponse }) {
  const { t, locale } = useT();
  return (
    <div className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide mb-3">
        {t('sabflow.usage.topFlows.title')}
      </div>
      {data.topFlows.length === 0 ? (
        <p className="text-[12px] text-[var(--gray-9)]">{t('sabflow.usage.topFlows.empty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {data.topFlows.map((f, idx) => (
            <li key={f.flowId} className="flex items-center gap-2">
              <span className="w-5 text-[10.5px] tabular-nums text-[var(--gray-9)]">
                #{idx + 1}
              </span>
              <Link
                href={`/dashboard/sabflow/flow-builder/${f.flowId}`}
                className="flex-1 truncate text-[12px] font-medium text-[var(--gray-12)] hover:text-zoru-ink"
              >
                {f.name}
              </Link>
              <span className="tabular-nums text-[11.5px] text-[var(--gray-10)]">
                {f.runs.toLocaleString(locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TopFailingCard({ data }: { data: UsageResponse }) {
  const { t } = useT();
  return (
    <div className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-zoru-ink dark:text-zoru-ink-muted uppercase tracking-wide mb-3">
        {t('sabflow.usage.topFailing.title')}
      </div>
      {data.topFailing.length === 0 ? (
        <p className="text-[12px] text-[var(--gray-9)]">{t('sabflow.usage.topFailing.empty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {data.topFailing.map((f, idx) => (
            <li key={f.flowId} className="flex items-center gap-2">
              <span className="w-5 text-[10.5px] tabular-nums text-[var(--gray-9)]">
                #{idx + 1}
              </span>
              <Link
                href={`/dashboard/sabflow/flow-builder/${f.flowId}`}
                className="flex-1 truncate text-[12px] font-medium text-[var(--gray-12)] hover:text-zoru-ink"
              >
                {f.name}
              </Link>
              <Link
                href={`/dashboard/sabflow/executions?status=error`}
                className="rounded-md bg-zoru-ink/10 px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-zoru-ink dark:text-zoru-ink-muted hover:bg-zoru-ink/20"
              >
                {f.errors}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

/* ── Limit Alerts ───────────────────────────────────────────────────────── */

function LimitAlertsCard() {
  const { t } = useT();
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
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] p-4 sm:p-5 mt-4 sm:mt-6">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--gray-12)] mb-4">
        <LuBell className="h-4 w-4 text-[var(--gray-11)]" />
        {t('sabflow.usage.alerts.title', { defaultValue: 'Limit Alerts' })}
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="flex-1 space-y-4 max-w-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-[var(--gray-5)] text-zoru-ink focus:ring-zoru-line"
            />
            <span className="text-[13px] text-[var(--gray-12)]">
              {t('sabflow.usage.alerts.enable', { defaultValue: 'Enable usage alerts' })}
            </span>
          </label>

          <div className="space-y-3 pl-6">
            <div>
              <label className="block text-[11px] font-medium text-[var(--gray-11)] mb-1">
                {t('sabflow.usage.alerts.runsThreshold', { defaultValue: 'Monthly Runs Threshold' })}
              </label>
              <input
                type="number"
                disabled={!enabled}
                value={runsThreshold}
                onChange={(e) => setRunsThreshold(Number(e.target.value))}
                className="w-full rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)] px-2 py-1.5 text-[12px] text-[var(--gray-12)] disabled:opacity-50 outline-none focus:border-zoru-line focus:ring-1 focus:ring-zoru-line"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--gray-11)] mb-1">
                {t('sabflow.usage.alerts.errorsThreshold', { defaultValue: 'Monthly Errors Threshold' })}
              </label>
              <input
                type="number"
                disabled={!enabled}
                value={errorsThreshold}
                onChange={(e) => setErrorsThreshold(Number(e.target.value))}
                className="w-full rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)] px-2 py-1.5 text-[12px] text-[var(--gray-12)] disabled:opacity-50 outline-none focus:border-zoru-line focus:ring-1 focus:ring-zoru-line"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--gray-11)] mb-1">
                {t('sabflow.usage.alerts.emails', { defaultValue: 'Alert Emails (comma separated)' })}
              </label>
              <input
                type="text"
                disabled={!enabled}
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="admin@example.com"
                className="w-full rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)] px-2 py-1.5 text-[12px] text-[var(--gray-12)] disabled:opacity-50 outline-none focus:border-zoru-line focus:ring-1 focus:ring-zoru-line"
              />
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zoru-ink px-3 py-1.5 text-[12px] font-medium text-white hover:bg-zoru-ink disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <LuLoader className="h-3.5 w-3.5 animate-spin" />
              ) : saveSuccess ? (
                <LuCheck className="h-3.5 w-3.5" />
              ) : (
                <LuSave className="h-3.5 w-3.5" />
              )}
              {saveSuccess
                ? t('action.saved', { defaultValue: 'Saved!' })
                : t('action.save', { defaultValue: 'Save Config' })}
            </button>
          </div>
        </div>

        <div className="flex-1 bg-[var(--gray-3)] rounded-lg p-4 text-[12px] text-[var(--gray-11)] leading-relaxed">
          <p className="mb-2 font-medium text-[var(--gray-12)]">
            {t('sabflow.usage.alerts.infoTitle', { defaultValue: 'How Alerts Work' })}
          </p>
          <p className="mb-2">
            {t('sabflow.usage.alerts.info1', { defaultValue: 'When enabled, we will send an email to the provided addresses if your workspace usage exceeds the configured thresholds within a 30-day rolling window.' })}
          </p>
          <p>
            {t('sabflow.usage.alerts.info2', { defaultValue: 'Alerts are evaluated daily and will only be sent once per threshold breach.' })}
          </p>
        </div>
      </div>
    </div>
  );
}
