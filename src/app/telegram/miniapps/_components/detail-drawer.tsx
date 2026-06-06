'use client';

import { useState, useEffect, useTransition } from 'react';
import { ExternalLink, Link as LinkIcon, Loader2, Monitor, Pencil, ShieldCheck, Smartphone } from 'lucide-react';
import {
  Button,
  Textarea,
  cn,
  useZoruToast,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Card,
} from '@/components/sabcrm/20ui/compat';
import { useProject } from '@/context/project-context';
import {
  listTelegramMiniAppSessionsAction,
  getTelegramMiniAppAnalyticsAction,
  validateTelegramMiniAppInitDataAction,
} from '@/app/actions/telegram-extra.actions';
import type { MiniAppRow, SessionRow, AnalyticsResp } from '@/lib/rust-client/telegram-mini-apps';
import { ClientDate } from './client-date';
import { KpiCard } from './kpi-card';

const ACCENT = '#229ED9';

function directLink(botUsername: string | undefined, slug: string): string {
  if (!botUsername || !slug) return '';
  return `https://t.me/${botUsername}/${slug}`;
}

type DetailTab = 'overview' | 'sessions' | 'analytics' | 'settings';

export function DetailDrawer({
  app,
  open,
  onOpenChange,
  onEdit,
}: {
  app: MiniAppRow | null;
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onEdit: () => void;
}) {
  const { toast } = useZoruToast();
  const { activeProjectId } = useProject();
  const [tab, setTab] = useState<DetailTab>('overview');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loadingSessions, startLoadingSessions] = useTransition();
  const [analytics, setAnalytics] = useState<AnalyticsResp | null>(null);
  const [loadingAnalytics, startLoadingAnalytics] = useTransition();
  const [initData, setInitData] = useState('');
  const [initDataResult, setInitDataResult] = useState<{
    ok: boolean;
    body: string;
  } | null>(null);
  const [validating, startValidating] = useTransition();

  useEffect(() => {
    if (!open) return;
    setTab('overview');
    setSessions([]);
    setAnalytics(null);
    setInitData('');
    setInitDataResult(null);
  }, [app?._id, open]);

  useEffect(() => {
    if (!app || !activeProjectId) return;
    if (tab === 'sessions' && sessions.length === 0) {
      startLoadingSessions(async () => {
        try {
          const res = await listTelegramMiniAppSessionsAction(
            app._id,
            activeProjectId,
            { limit: 100 },
          );
          if (res.error) {
            toast({
              title: 'Sessions failed',
              description: res.error,
              variant: 'destructive',
            });
          }
          setSessions(res.sessions ?? []);
        } catch (e) {
          toast({
            title: 'Sessions failed',
            description: String(e),
            variant: 'destructive',
          });
        }
      });
    }
    if (tab === 'analytics' && !analytics) {
      const to = new Date().toISOString();
      const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      startLoadingAnalytics(async () => {
        try {
          const res = await getTelegramMiniAppAnalyticsAction(app._id, {
            projectId: activeProjectId,
            from,
            to,
          });
          if (res.error) {
            toast({
              title: 'Analytics failed',
              description: res.error,
              variant: 'destructive',
            });
          }
          setAnalytics(res);
        } catch (e) {
          toast({
            title: 'Analytics failed',
            description: String(e),
            variant: 'destructive',
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, app?._id, activeProjectId]);

  if (!app) return null;

  const link = directLink(app.botUsername, app.slug);

  const onValidate = () => {
    if (!activeProjectId) return;
    startValidating(async () => {
      try {
        const res = await validateTelegramMiniAppInitDataAction({
          projectId: activeProjectId,
          appId: app._id,
          initData,
        });
        setInitDataResult({
          ok: res.success,
          body: JSON.stringify(
            res.success
              ? { user: res.user, authDate: res.authDate, queryId: res.queryId }
              : { error: res.error },
            null,
            2,
          ),
        });
      } catch (e) {
        setInitDataResult({
          ok: false,
          body: JSON.stringify({ error: String(e) }, null, 2),
        });
      }
    });
  };

  return (
    <ZoruDrawer open={open} onOpenChange={onOpenChange}>
      <ZoruDrawerContent className="max-h-[92vh]">
        <ZoruDrawerHeader>
          <ZoruDrawerTitle>
            {app.name}
            <span className="ml-2 text-[11px] text-[var(--st-text-secondary)] font-normal">
              @{app.botUsername || '—'} / {app.slug}
            </span>
          </ZoruDrawerTitle>
          <ZoruDrawerDescription>{app.description || ' '}</ZoruDrawerDescription>
        </ZoruDrawerHeader>

        {/* Segmented section nav */}
        <div className="flex gap-1 px-4">
          {(
            [
              ['overview', 'Overview'],
              ['sessions', 'Sessions'],
              ['analytics', 'Analytics'],
              ['settings', 'Settings'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px]',
                tab === k
                  ? 'bg-zoru-bg-[var(--st-bg-muted)] text-[var(--st-text)]'
                  : 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-4 py-3">
          {tab === 'overview' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={app.webAppUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-[12px] text-[var(--st-text)] hover:underline"
                >
                  <LinkIcon className="h-3.5 w-3.5" /> {app.webAppUrl}
                </a>
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[12px] text-[var(--st-text)] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {link}
                  </a>
                )}
                <div className="ml-auto inline-flex overflow-hidden rounded-md border border-[var(--st-border)]">
                  <button
                    type="button"
                    onClick={() => setDevice('desktop')}
                    className={cn(
                      'px-2 py-1 text-[11px]',
                      device === 'desktop' && 'bg-zoru-bg-[var(--st-bg-muted)]',
                    )}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDevice('mobile')}
                    className={cn(
                      'px-2 py-1 text-[11px]',
                      device === 'mobile' && 'bg-zoru-bg-[var(--st-bg-muted)]',
                    )}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex justify-center rounded-md border border-[var(--st-border)] bg-zoru-bg-[var(--st-bg-muted)] p-3">
                <div
                  className="overflow-hidden rounded-md border border-[var(--st-border)] bg-white"
                  style={{
                    width: device === 'desktop' ? 720 : 360,
                    height: device === 'desktop' ? 480 : 640,
                    maxWidth: '100%',
                  }}
                >
                  <iframe
                    title={`Preview of ${app.name}`}
                    src={app.webAppUrl}
                    className="h-full w-full"
                  />
                </div>
              </div>
              <div className="rounded-md border border-[var(--st-border)] p-3">
                <div className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)]">
                  Test init-data
                </div>
                <Textarea
                  value={initData}
                  onChange={(e) => setInitData(e.target.value)}
                  rows={4}
                  placeholder="Paste a Telegram WebApp initData string here…"
                />
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={onValidate}
                    disabled={!initData || validating}
                  >
                    {validating ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Validate
                  </Button>
                  {initDataResult && (
                    <span
                      className={cn(
                        'text-[11px]',
                        initDataResult.ok
                          ? 'text-[var(--st-text)]'
                          : 'text-[var(--st-text)]',
                      )}
                    >
                      {initDataResult.ok ? 'Signature OK' : 'Signature failed'}
                    </span>
                  )}
                </div>
                {initDataResult && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-zoru-bg-[var(--st-bg-muted)] p-2 text-[11px]">
                    {initDataResult.body}
                  </pre>
                )}
              </div>
            </div>
          )}

          {tab === 'sessions' && (
            <SessionsTable
              sessions={sessions}
              loading={loadingSessions}
            />
          )}

          {tab === 'analytics' && (
            <AnalyticsView analytics={analytics} loading={loadingAnalytics} />
          )}

          {tab === 'settings' && (
            <div className="flex flex-col gap-3">
              <Button variant="outline" onClick={onEdit}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit mini app
              </Button>
              <div className="rounded-md border border-[var(--st-border)] p-3 text-[12px]">
                <div className="text-[var(--st-text-secondary)]">App id</div>
                <div className="font-mono text-[var(--st-text)]">{app._id}</div>
                <div className="mt-2 text-[var(--st-text-secondary)]">Bot id</div>
                <div className="font-mono text-[var(--st-text)]">{app.botId}</div>
                <div className="mt-2 text-[var(--st-text-secondary)]">Created</div>
                <div><ClientDate date={app.createdAt} /></div>
                <div className="mt-2 text-[var(--st-text-secondary)]">Updated</div>
                <div><ClientDate date={app.updatedAt} /></div>
              </div>
            </div>
          )}
        </div>
      </ZoruDrawerContent>
    </ZoruDrawer>
  );
}

function SessionsTable({
  sessions,
  loading,
}: {
  sessions: SessionRow[];
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-40 w-full" />;
  if (sessions.length === 0)
    return (
      <div className="rounded-md border border-[var(--st-border)] p-6 text-center text-[12px] text-[var(--st-text-secondary)]">
        No validated sessions yet.
      </div>
    );
  return (
    <Table>
      <ZoruTableHeader>
        <ZoruTableRow>
          <ZoruTableHead>User</ZoruTableHead>
          <ZoruTableHead>User id</ZoruTableHead>
          <ZoruTableHead>Validated</ZoruTableHead>
          <ZoruTableHead>Device</ZoruTableHead>
        </ZoruTableRow>
      </ZoruTableHeader>
      <ZoruTableBody>
        {sessions.map((s) => (
          <ZoruTableRow key={s._id}>
            <ZoruTableCell>
              {s.username ? `@${s.username}` : s.firstName ?? '—'}
            </ZoruTableCell>
            <ZoruTableCell className="font-mono text-[11px]">
              {s.userId ?? '—'}
            </ZoruTableCell>
            <ZoruTableCell>
              <ClientDate date={s.validatedAt} />
            </ZoruTableCell>
            <ZoruTableCell>{s.device ?? '—'}</ZoruTableCell>
          </ZoruTableRow>
        ))}
      </ZoruTableBody>
    </Table>
  );
}

function AnalyticsView({
  analytics,
  loading,
}: {
  analytics: AnalyticsResp | null;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-40 w-full" />;
  if (!analytics)
    return <div className="text-[12px] text-[var(--st-text-secondary)]">No data.</div>;
  const max = analytics.byDay.reduce((m, d) => Math.max(m, d.opens), 0) || 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Opens" value={analytics.opens} />
        <KpiCard label="Unique users" value={analytics.uniqueUsers} />
        <KpiCard
          label="Conversion"
          value={`${(analytics.conversion * 100).toFixed(1)}%`}
          hint="unique / opens"
        />
      </div>
      <div className="rounded-md border border-[var(--st-border)] p-3">
        <div className="mb-2 text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)]">
          Opens by day
        </div>
        <div className="flex h-32 items-end gap-1">
          {analytics.byDay.length === 0 ? (
            <span className="text-[11px] text-[var(--st-text-secondary)]">No data.</span>
          ) : (
            analytics.byDay.map((d) => (
              <div
                key={d.date}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${d.date}: ${d.opens}`}
              >
                <div
                  className="w-full rounded-t"
                  style={{
                    backgroundColor: ACCENT,
                    height: `${(d.opens / max) * 100}%`,
                    minHeight: 2,
                  }}
                />
                <span className="text-[9px] text-[var(--st-text-secondary)]">
                  {d.date.slice(5)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
