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
  Activity,
  CircleAlert,
  CircleCheck,
  CircleX,
  Database,
  Mail,
  RefreshCw,
  Server,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Dot,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Spinner,
  cn,
} from '@/components/sabcrm/20ui';
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

type StatusTone = 'success' | 'warning' | 'danger';
type OverallTone = 'success' | 'warning' | 'danger';

const OVERALL_PILL: Record<HealthOverall, { label: string; tone: OverallTone }> = {
  green: {
    label: 'All systems operational',
    tone: 'success',
  },
  yellow: {
    label: 'Degraded, optional services unavailable',
    tone: 'warning',
  },
  red: {
    label: 'Outage, critical dependency unreachable',
    tone: 'danger',
  },
};

const STATUS_TONE: Record<CardStatus, StatusTone> = {
  ok: 'success',
  degraded: 'warning',
  down: 'danger',
};

const STATUS_ICON: Record<CardStatus, LucideIcon> = {
  ok: CircleCheck,
  degraded: CircleAlert,
  down: CircleX,
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

  // Keyboard `R` ignores while typing in an input/textarea so we don't
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
        sub:     'Primary datastore, critical',
        icon:    Database,
        status:  mongoStatus,
        latency: data.checks.mongo.latencyMs,
        error:   data.checks.mongo.error,
      },
      {
        key:     'redis',
        title:   'Redis',
        sub:     'Queue + cache, optional',
        icon:    Zap,
        status:  redisStatus,
        latency: data.checks.redis.latencyMs,
        error:   data.checks.redis.error,
      },
      {
        key:     'smtp',
        title:   'SMTP',
        sub:     'Outbound email, env check only',
        icon:    Mail,
        status:  smtpStatus,
        latency: undefined,
        error:   data.checks.smtp.error,
      },
      {
        key:     'engine',
        title:   'Engine routes',
        sub:     'Co-located in this app',
        icon:    Server,
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
      <PageHeader className="shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
            aria-hidden="true"
          >
            <Activity className="h-4 w-4" strokeWidth={2} />
          </span>
          <PageHeaderHeading className="min-w-0">
            <PageTitle>{t('health.title', LOCALE)}</PageTitle>
            <PageDescription>
              SabFlow dependency status, refreshes every 30s
            </PageDescription>
          </PageHeaderHeading>
        </div>
        <PageActions>
          {lastFetched && (
            <span className="text-[11px] text-[var(--st-text-secondary)] tabular-nums">
              Updated {formatRelative(lastFetched)}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            title="Refresh (R)"
            iconLeft={RefreshCw}
            className={cn(loading && '[&_svg]:animate-spin')}
          >
            {t('health.refresh', LOCALE)}
          </Button>
        </PageActions>
      </PageHeader>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && !data ? (
          <div className="flex h-64 items-center justify-center gap-2 text-[var(--st-text-secondary)]">
            <Spinner size="sm" label="Running health checks" />
            <span className="text-[12px]">Running health checks...</span>
          </div>
        ) : error && !data ? (
          <div className="m-6">
            <Alert tone="danger" icon={TriangleAlert} title="Failed to load health">
              {error}
            </Alert>
          </div>
        ) : data && overallStyle ? (
          <div className="flex flex-col gap-5 p-4 sm:p-6">
            {/* Overall pill */}
            <Card
              variant="outlined"
              padding="md"
              className="flex items-center gap-3"
            >
              <Dot
                tone={overallStyle.tone}
                pulse
                aria-hidden="true"
              />
              <div className="flex flex-col leading-tight">
                <span className="text-[14px] font-semibold uppercase tracking-wide text-[var(--st-text)]">
                  {overall}
                </span>
                <span className="text-[12px] text-[var(--st-text-secondary)]">
                  {overallStyle.label}
                </span>
              </div>
              <span className="ml-auto text-[11px] tabular-nums text-[var(--st-text-tertiary)]">
                Generated {new Date(data.generatedAt).toLocaleTimeString()}
              </span>
            </Card>

            {/* Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((c) => {
                const Icon = c.icon;
                const StatusIcon = STATUS_ICON[c.status];
                return (
                  <Card
                    key={c.key}
                    variant="outlined"
                    padding="md"
                    className="flex flex-col gap-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <div className="flex flex-col leading-tight min-w-0">
                        <span className="text-[13px] font-semibold text-[var(--st-text)]">
                          {c.title}
                        </span>
                        <span className="text-[11px] text-[var(--st-text-secondary)]">
                          {c.sub}
                        </span>
                      </div>
                      <Badge
                        tone={STATUS_TONE[c.status]}
                        className="ml-auto uppercase tracking-wide"
                      >
                        <StatusIcon className="h-3 w-3" aria-hidden="true" />
                        {c.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-[11.5px] text-[var(--st-text-secondary)] tabular-nums">
                      <span>
                        Latency:{' '}
                        <span className="text-[var(--st-text)]">
                          {typeof c.latency === 'number' ? `${c.latency}ms` : '-'}
                        </span>
                      </span>
                    </div>

                    {c.error && (
                      <p
                        className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-2 py-1.5 text-[11px] text-[var(--st-text)] break-words"
                        title={c.error}
                      >
                        {c.error}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Non-blocking re-fetch error */}
            {error && (
              <Alert tone="warning" icon={TriangleAlert}>
                Last refresh failed: {error}
              </Alert>
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
