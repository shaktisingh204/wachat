'use client';

import * as React from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  LoaderCircle,
  Play,
  PlugZap,
  Unplug,
  type LucideIcon,
} from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruScrollArea,
  ZoruSeparator,
  ZoruStatCard,
  useZoruToast,
} from '@/components/zoruui';

import type {
  IntegrationEvent,
  IntegrationProvider,
  IntegrationStats,
} from '@/app/actions/worksuite/integrations.actions';

/* ─── Helpers ─────────────────────────────────────────────────────── */

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return 'Unknown';
  }
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'Unknown';
  const diff = Date.now() - t;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/* ─── KPI ─────────────────────────────────────────────────────────── */

export interface IntegrationKpi {
  label: string;
  value: React.ReactNode;
  period?: React.ReactNode;
  icon?: React.ReactNode;
  /** Treat positive deltas as bad (e.g. error rate). */
  invertDelta?: boolean;
  delta?: number;
}

/* ─── Connection header ───────────────────────────────────────────── */

export type ConnectionState = 'connected' | 'disconnected' | 'error';

export interface ConnectionHeaderProps {
  name: string;
  description?: string;
  icon?: LucideIcon;
  state: ConnectionState;
  /** Account or principal connected to the integration. */
  connectedAs?: string | null;
  connectedAt?: string | null;
  scopes?: string[];
  onTest?: () => void | Promise<void>;
  isTesting?: boolean;
  onDisconnect?: () => void | Promise<void>;
  isDisconnecting?: boolean;
  /** Replace the "Connect" button rendered in the disconnected state. */
  connectAction?: React.ReactNode;
}

function stateBadge(state: ConnectionState) {
  if (state === 'connected') {
    return (
      <ZoruBadge variant="success" className="gap-1.5">
        <CheckCircle2 className="h-3 w-3" />
        Connected
      </ZoruBadge>
    );
  }
  if (state === 'error') {
    return (
      <ZoruBadge variant="destructive" className="gap-1.5">
        <AlertCircle className="h-3 w-3" />
        Error
      </ZoruBadge>
    );
  }
  return (
    <ZoruBadge variant="ghost" className="gap-1.5">
      <Clock className="h-3 w-3" />
      Disconnected
    </ZoruBadge>
  );
}

export function ConnectionHeader(props: ConnectionHeaderProps): React.ReactElement {
  const {
    name,
    description,
    icon: Icon,
    state,
    connectedAs,
    connectedAt,
    scopes,
    onTest,
    isTesting,
    onDisconnect,
    isDisconnecting,
    connectAction,
  } = props;

  return (
    <ZoruCard>
      <ZoruCardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {Icon ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
                <Icon className="h-5 w-5" />
              </span>
            ) : null}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-zoru-ink">{name}</h2>
                {stateBadge(state)}
              </div>
              {description ? (
                <p className="text-[13px] text-zoru-ink-muted">{description}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {onTest ? (
              <ZoruButton
                type="button"
                variant="outline"
                onClick={onTest}
                disabled={isTesting}
              >
                {isTesting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Test connection
              </ZoruButton>
            ) : null}
            {state === 'connected' && onDisconnect ? (
              <ZoruButton
                type="button"
                variant="outline"
                onClick={onDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="h-4 w-4" />
                )}
                Disconnect
              </ZoruButton>
            ) : null}
            {state !== 'connected' && connectAction ? connectAction : null}
            {state !== 'connected' && !connectAction ? (
              <ZoruButton type="button" variant="outline" disabled>
                <PlugZap className="h-4 w-4" />
                Not connected
              </ZoruButton>
            ) : null}
          </div>
        </div>

        {connectedAs || connectedAt || (scopes && scopes.length) ? (
          <>
            <ZoruSeparator className="my-4" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-zoru-ink-subtle">
                  Connected as
                </p>
                <p className="mt-1 font-medium text-zoru-ink">
                  {connectedAs || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zoru-ink-subtle">
                  Connected at
                </p>
                <p className="mt-1 font-medium text-zoru-ink">
                  {formatDateTime(connectedAt)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zoru-ink-subtle">
                  Scopes granted
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {scopes && scopes.length ? (
                    scopes.map((s) => (
                      <ZoruBadge key={s} variant="secondary" className="font-normal">
                        {s}
                      </ZoruBadge>
                    ))
                  ) : (
                    <span className="text-zoru-ink-muted">—</span>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </ZoruCardContent>
    </ZoruCard>
  );
}

/* ─── KPI grid ────────────────────────────────────────────────────── */

export function IntegrationKpiGrid({
  kpis,
}: {
  kpis: IntegrationKpi[];
}): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((k) => (
        <ZoruStatCard
          key={String(k.label)}
          label={k.label}
          value={k.value}
          period={k.period}
          icon={k.icon}
          invertDelta={k.invertDelta}
          delta={k.delta}
        />
      ))}
    </div>
  );
}

/* ─── Activity / sync history feed ────────────────────────────────── */

function statusDot(status: IntegrationEvent['status']) {
  if (status === 'success') {
    return <span className="h-2 w-2 rounded-full bg-zoru-success" />;
  }
  if (status === 'failure') {
    return <span className="h-2 w-2 rounded-full bg-zoru-danger" />;
  }
  return <span className="h-2 w-2 rounded-full bg-zoru-warning" />;
}

export interface IntegrationActivityFeedProps {
  title?: string;
  description?: string;
  events: IntegrationEvent[];
  /** Render when the feed is empty. */
  emptyMessage?: string;
}

export function IntegrationActivityFeed({
  title = 'Activity log',
  description = 'Events emitted by this integration.',
  events,
  emptyMessage = 'No activity yet.',
}: IntegrationActivityFeedProps): React.ReactElement {
  return (
    <ZoruCard>
      <ZoruCardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-zoru-ink-muted" />
          <div>
            <h3 className="text-sm font-semibold text-zoru-ink">{title}</h3>
            <p className="text-xs text-zoru-ink-muted">{description}</p>
          </div>
        </div>
        {events.length === 0 ? (
          <div className="rounded-[var(--zoru-radius-sm)] border border-dashed border-zoru-line bg-zoru-bg p-6 text-center text-sm text-zoru-ink-muted">
            {emptyMessage}
          </div>
        ) : (
          <ZoruScrollArea className="max-h-[320px] pr-3">
            <ul className="space-y-2">
              {events.map((e) => (
                <li
                  key={e._id}
                  className="flex items-start gap-3 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface px-3 py-2"
                >
                  <div className="mt-2">{statusDot(e.status)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium text-zoru-ink capitalize">
                        {e.kind}
                      </span>
                      <ZoruBadge
                        variant={
                          e.status === 'success'
                            ? 'success'
                            : e.status === 'failure'
                            ? 'destructive'
                            : 'warning'
                        }
                        className="font-normal"
                      >
                        {e.status}
                      </ZoruBadge>
                      {typeof e.count === 'number' ? (
                        <ZoruBadge variant="secondary" className="font-normal">
                          {e.count} item{e.count === 1 ? '' : 's'}
                        </ZoruBadge>
                      ) : null}
                    </div>
                    {e.message ? (
                      <p className="mt-0.5 break-words text-[12.5px] text-zoru-ink-muted">
                        {e.message}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className="shrink-0 text-[11.5px] text-zoru-ink-subtle"
                    title={formatDateTime(e.createdAt)}
                  >
                    {formatRelative(e.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </ZoruScrollArea>
        )}
      </ZoruCardContent>
    </ZoruCard>
  );
}

/* ─── Sync history (specialised view of the events feed) ──────────── */

export function IntegrationSyncHistory({
  events,
}: {
  events: IntegrationEvent[];
}): React.ReactElement {
  const syncs = events.filter(
    (e) => e.kind === 'sync' || e.kind === 'delivery',
  );
  return (
    <IntegrationActivityFeed
      title="Sync history"
      description="Last 10 sync / delivery events."
      events={syncs}
      emptyMessage="No syncs yet. Use the buttons above to trigger one."
    />
  );
}

/* ─── Toast-bound action helpers ──────────────────────────────────── */

export function useIntegrationToast() {
  const { toast } = useZoruToast();
  const reportResult = React.useCallback(
    (provider: IntegrationProvider, res: { message?: string; error?: string }) => {
      const title =
        provider === 'google-calendar'
          ? 'Google Calendar'
          : provider.charAt(0).toUpperCase() + provider.slice(1);
      if (res.error) {
        toast({ title, description: res.error, variant: 'destructive' });
      } else if (res.message) {
        toast({ title, description: res.message });
      }
    },
    [toast],
  );
  return { toast, reportResult };
}

/* ─── Section wrapper ─────────────────────────────────────────────── */

export interface IntegrationSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Optional right-side actions (e.g. a Save button). */
  actions?: React.ReactNode;
}

export function IntegrationSection({
  title,
  description,
  children,
  actions,
}: IntegrationSectionProps): React.ReactElement {
  return (
    <ZoruCard>
      <ZoruCardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-zoru-ink">{title}</h3>
            {description ? (
              <p className="mt-0.5 text-xs text-zoru-ink-muted">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
        {children}
      </ZoruCardContent>
    </ZoruCard>
  );
}
