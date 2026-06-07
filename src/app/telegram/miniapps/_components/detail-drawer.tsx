'use client';

import { useState, useEffect, useTransition } from 'react';
import { ExternalLink, Link as LinkIcon, Pencil, ShieldCheck, Smartphone, Monitor, Inbox } from 'lucide-react';
import {
  Button,
  Textarea,
  Field,
  Badge,
  useToast,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Skeleton,
  SegmentedControl,
  EmptyState,
  StatCard,
  Card,
  CardBody,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listTelegramMiniAppSessionsAction,
  getTelegramMiniAppAnalyticsAction,
  validateTelegramMiniAppInitDataAction,
} from '@/app/actions/telegram-extra.actions';
import type { MiniAppRow, SessionRow, AnalyticsResp } from '@/lib/rust-client/telegram-mini-apps';
import { ClientDate } from './client-date';

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
  const { toast } = useToast();
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader>
          <DrawerTitle>
            {app.name}
            <span className="ml-2 text-[11px] text-[var(--st-text-secondary)] font-normal">
              @{app.botUsername || 'unset'} / {app.slug}
            </span>
          </DrawerTitle>
          <DrawerDescription>{app.description || ' '}</DrawerDescription>
        </DrawerHeader>

        {/* Segmented section nav */}
        <div className="px-4">
          <SegmentedControl<DetailTab>
            aria-label="Mini app detail sections"
            value={tab}
            onChange={setTab}
            size="sm"
            items={[
              { value: 'overview', label: 'Overview' },
              { value: 'sessions', label: 'Sessions' },
              { value: 'analytics', label: 'Analytics' },
              { value: 'settings', label: 'Settings' },
            ]}
          />
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
                  <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" /> {app.webAppUrl}
                </a>
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[12px] text-[var(--st-text)] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> {link}
                  </a>
                )}
                <div className="ml-auto">
                  <SegmentedControl<'desktop' | 'mobile'>
                    aria-label="Preview device"
                    value={device}
                    onChange={setDevice}
                    size="sm"
                    items={[
                      { value: 'desktop', label: '', icon: Monitor },
                      { value: 'mobile', label: '', icon: Smartphone },
                    ]}
                  />
                </div>
              </div>
              <div className="flex justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                <div
                  className={
                    device === 'desktop'
                      ? 'h-[480px] w-[720px] max-w-full overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-white'
                      : 'h-[640px] w-[360px] max-w-full overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-white'
                  }
                >
                  <iframe
                    title={`Preview of ${app.name}`}
                    src={app.webAppUrl}
                    className="h-full w-full"
                  />
                </div>
              </div>
              <Card>
                <CardBody className="flex flex-col gap-2">
                  <div className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)]">
                    Test init-data
                  </div>
                  <Field>
                    <Textarea
                      value={initData}
                      onChange={(e) => setInitData(e.target.value)}
                      rows={4}
                      placeholder="Paste a Telegram WebApp initData string here."
                    />
                  </Field>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      iconLeft={ShieldCheck}
                      loading={validating}
                      onClick={onValidate}
                      disabled={!initData || validating}
                    >
                      Validate
                    </Button>
                    {initDataResult && (
                      <Badge
                        dot
                        tone={initDataResult.ok ? 'success' : 'danger'}
                      >
                        {initDataResult.ok ? 'Signature OK' : 'Signature failed'}
                      </Badge>
                    )}
                  </div>
                  {initDataResult && (
                    <pre className="max-h-40 overflow-auto rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-2 text-[11px] text-[var(--st-text)]">
                      {initDataResult.body}
                    </pre>
                  )}
                </CardBody>
              </Card>
            </div>
          )}

          {tab === 'sessions' && (
            <SessionsTable sessions={sessions} loading={loadingSessions} />
          )}

          {tab === 'analytics' && (
            <AnalyticsView analytics={analytics} loading={loadingAnalytics} />
          )}

          {tab === 'settings' && (
            <div className="flex flex-col gap-3">
              <Button variant="outline" iconLeft={Pencil} onClick={onEdit}>
                Edit mini app
              </Button>
              <Card>
                <CardBody className="text-[12px]">
                  <div className="text-[var(--st-text-secondary)]">App id</div>
                  <div className="font-mono text-[var(--st-text)]">{app._id}</div>
                  <div className="mt-2 text-[var(--st-text-secondary)]">Bot id</div>
                  <div className="font-mono text-[var(--st-text)]">{app.botId}</div>
                  <div className="mt-2 text-[var(--st-text-secondary)]">Created</div>
                  <div className="text-[var(--st-text)]"><ClientDate date={app.createdAt} /></div>
                  <div className="mt-2 text-[var(--st-text-secondary)]">Updated</div>
                  <div className="text-[var(--st-text)]"><ClientDate date={app.updatedAt} /></div>
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
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
      <EmptyState
        icon={Inbox}
        title="No validated sessions yet"
        description="Sessions appear here once a user opens the mini app and its initData is validated."
      />
    );
  return (
    <Table density="compact">
      <THead>
        <Tr>
          <Th>User</Th>
          <Th>User id</Th>
          <Th>Validated</Th>
          <Th>Device</Th>
        </Tr>
      </THead>
      <TBody>
        {sessions.map((s) => (
          <Tr key={s._id}>
            <Td>{s.username ? `@${s.username}` : s.firstName ?? 'Unknown'}</Td>
            <Td className="font-mono text-[11px]">{s.userId ?? 'n/a'}</Td>
            <Td>
              <ClientDate date={s.validatedAt} />
            </Td>
            <Td>{s.device ?? 'n/a'}</Td>
          </Tr>
        ))}
      </TBody>
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
    return (
      <EmptyState
        icon={Inbox}
        title="No analytics yet"
        description="Opens and unique-user metrics will show up here once the mini app sees traffic."
      />
    );
  const max = analytics.byDay.reduce((m, d) => Math.max(m, d.opens), 0) || 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Opens" value={analytics.opens} />
        <StatCard label="Unique users" value={analytics.uniqueUsers} />
        <StatCard
          label="Conversion"
          value={`${(analytics.conversion * 100).toFixed(1)}%`}
        />
      </div>
      <Card>
        <CardBody>
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
        </CardBody>
      </Card>
    </div>
  );
}
