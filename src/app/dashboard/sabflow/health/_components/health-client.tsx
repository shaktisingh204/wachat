'use client';

/**
 * HealthClient
 *
 * Polls GET /api/sabflow/health every 30s and renders a coloured overall
 * pill (green/yellow/red) plus one card per check (Mongo, Redis, SMTP,
 * Engine) with status, latency, and any error message.
 *
 * Keyboard `R` triggers a manual refresh, mirroring the on-screen button.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuActivity,
  LuCircleAlert,
  LuCircleCheck,
  LuCircleX,
  LuDatabase,
  LuLoader,
  LuMail,
  LuRefreshCw,
  LuServer,
  LuTriangleAlert,
  LuZap,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { getActiveLocale, t } from '@/lib/sabflow/i18n';

const LOCALE = getActiveLocale();
const REFRESH_INTERVAL_MS = 30_000;

type ProbeResult = {
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

type SmtpResult = {
  ok: 'configured' | 'missing';
  error?: string;
};

type EngineResult = {
  ok: true;
};

type HealthOverall = 'green' | 'yellow' | 'red';

type HealthResponse = {
  overall: HealthOverall;
  checks: {
    mongo: ProbeResult;
    redis: ProbeResult;
    smtp: SmtpResult;
    engine: EngineResult;
  };
  generatedAt: string;
};

type CardStatus = 'ok' | 'degraded' | 'down';

const OVERALL_PILL: Record<HealthOverall, { label: string; cls: string; dot: string }> = {
  green:  {
    label: 'All systems operational',
    cls:   'bg-zoru-surface-2 text-zoru-ink border-zoru-line dark:bg-zoru-ink/40 dark:text-zoru-ink-muted dark:border-zoru-line',
    dot:   'bg-zoru-ink',
  },
  yellow: {
    label: 'Degraded — optional services unavailable',
    cls:   'bg-zoru-surface-2 text-zoru-ink border-zoru-line dark:bg-zoru-ink/40 dark:text-zoru-ink-muted dark:border-zoru-line',
    dot:   'bg-zoru-ink',
  },
  red: {
    label: 'Outage — critical dependency unreachable',
    cls:   'bg-zoru-surface-2 text-zoru-ink border-zoru-line dark:bg-zoru-ink/40 dark:text-zoru-ink-muted dark:border-zoru-line',
    dot:   'bg-zoru-ink',
  },
};

const STATUS_STYLES: Record<CardStatus, string> = {
  ok:       'bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/50 dark:text-zoru-ink-muted',
  degraded: 'bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/50 dark:text-zoru-ink-muted',
  down:     'bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/50 dark:text-zoru-ink-muted',
};

const STATUS_ICON: Record<CardStatus, typeof LuCircleCheck> = {
  ok:       LuCircleCheck,
  degraded: LuCircleAlert,
  down:     LuCircleX,
};

export function HealthClient() {
  const [data, setData]       = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sabflow/health', {
        cache: 'no-store',
        signal: ac.signal,
      });
      if (!res.ok) {
        throw new Error(`Failed to load health (${res.status})`);
      }
      const json = (await res.json()) as HealthResponse;
      setData(json);
      setLastFetched(Date.now());
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + 30s polling.
  useEffect(() => {
    void load();
    const id = setInterval(() => {
      void load();
    }, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [load]);

  // Keyboard `R` — ignore while typing in an input/textarea so we don't
  // hijack typing in any future filter controls.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'r' && e.key !== 'R') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      e.preventDefault();
      void load();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [load]);

  const cards = useMemo(() => {
    if (!data) return [];
    const mongoStatus: CardStatus = data.checks.mongo.ok ? 'ok' : 'down';
    const redisStatus: CardStatus = data.checks.redis.ok ? 'ok' : 'degraded';
    const smtpStatus: CardStatus =
      data.checks.smtp.ok === 'configured' ? 'ok' : 'degraded';
    const engineStatus: CardStatus = data.checks.engine.ok ? 'ok' : 'down';
    return [
      {
        key:     'mongo',
        title:   'MongoDB',
        sub:     'Primary datastore — critical',
        icon:    LuDatabase,
        status:  mongoStatus,
        latency: data.checks.mongo.latencyMs,
        error:   data.checks.mongo.error,
      },
      {
        key:     'redis',
        title:   'Redis',
        sub:     'Queue + cache — optional',
        icon:    LuZap,
        status:  redisStatus,
        latency: data.checks.redis.latencyMs,
        error:   data.checks.redis.error,
      },
      {
        key:     'smtp',
        title:   'SMTP',
        sub:     'Outbound email — env check only',
        icon:    LuMail,
        status:  smtpStatus,
        latency: undefined,
        error:   data.checks.smtp.error,
      },
      {
        key:     'engine',
        title:   'Engine routes',
        sub:     'Co-located in this app',
        icon:    LuServer,
        status:  engineStatus,
        latency: undefined,
        error:   undefined,
      },
    ];
  }, [data]);

  const overall = data?.overall;
  const overallStyle = overall ? OVERALL_PILL[overall] : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--gray-4)] px-4 sm:px-6 py-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/40 dark:text-zoru-ink-muted">
          <LuActivity className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <h1 className="text-[15px] font-semibold text-[var(--gray-12)]">
            {t('health.title', LOCALE)}
          </h1>
          <p className="text-[11.5px] text-[var(--gray-9)]">
            SabFlow dependency status — refreshes every 30s
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {lastFetched && (
            <span className="text-[11px] text-[var(--gray-9)] tabular-nums">
              Updated {formatRelative(lastFetched)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            title="Refresh (R)"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-50"
          >
            <LuRefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {t('health.refresh', LOCALE)}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && !data ? (
          <div className="flex h-64 items-center justify-center gap-2 text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
            <span className="text-[12px]">Running health checks…</span>
          </div>
        ) : error && !data ? (
          <div className="m-6 flex items-start gap-2 rounded-lg border border-zoru-line bg-zoru-surface-2 px-4 py-3 text-[12px] text-zoru-ink">
            <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : data && overallStyle ? (
          <div className="flex flex-col gap-5 p-4 sm:p-6">
            {/* Overall pill */}
            <div
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3',
                overallStyle.cls,
              )}
            >
              <span
                className={cn(
                  'inline-flex h-3 w-3 rounded-full ring-4 ring-current/10',
                  overallStyle.dot,
                )}
                aria-hidden
              />
              <div className="flex flex-col leading-tight">
                <span className="text-[14px] font-semibold uppercase tracking-wide">
                  {overall}
                </span>
                <span className="text-[12px] opacity-80">{overallStyle.label}</span>
              </div>
              <span className="ml-auto text-[11px] tabular-nums opacity-70">
                Generated {new Date(data.generatedAt).toLocaleTimeString()}
              </span>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((c) => {
                const Icon = c.icon;
                const StatusIcon = STATUS_ICON[c.status];
                return (
                  <div
                    key={c.key}
                    className="flex flex-col gap-3 rounded-xl border border-[var(--gray-4)] bg-[var(--gray-1)] p-4"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gray-3)] text-[var(--gray-11)]">
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="text-[13px] font-semibold text-[var(--gray-12)]">
                          {c.title}
                        </span>
                        <span className="text-[11px] text-[var(--gray-9)]">
                          {c.sub}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide',
                          STATUS_STYLES[c.status],
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {c.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11.5px] text-[var(--gray-10)] tabular-nums">
                      <span>
                        Latency:{' '}
                        <span className="text-[var(--gray-12)]">
                          {typeof c.latency === 'number' ? `${c.latency}ms` : '—'}
                        </span>
                      </span>
                    </div>

                    {c.error && (
                      <p
                        className="rounded-md bg-zoru-surface-2 px-2 py-1.5 text-[11px] text-zoru-ink break-words dark:bg-zoru-ink/40 dark:text-zoru-ink-muted"
                        title={c.error}
                      >
                        {c.error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Non-blocking re-fetch error */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2 text-[11.5px] text-zoru-ink dark:border-zoru-line dark:bg-zoru-ink/40 dark:text-zoru-ink-muted">
                <LuTriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Last refresh failed: {error}</span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatRelative(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return new Date(ts).toLocaleTimeString();
}
