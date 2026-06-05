'use client';

import {
  Badge,
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  EmptyState,
  Skeleton,
  Progress,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowUpRight,
  BookCopy,
  CheckCheck,
  Check,
  CircleX,
  ChevronDown,
  Download,
  Eye,
  Inbox,
  MessagesSquare,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Send,
  TrendingDown,
  TrendingUp,
  Users,
  LayoutTemplate,
} from 'lucide-react';
import dynamic from 'next/dynamic';

import { useProject } from '@/context/project-context';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

const OverviewChart = dynamic(() => import('./overview-chart'), {
  ssr: false,
  loading: () => <Skeleton className="h-[300px] w-full" />,
});

/**
 * Wachat Overview -- project-scoped dashboard.
 */

type Stats = {
  totalMessages: number;
  totalSent: number;
  totalFailed: number;
  totalDelivered: number;
  totalRead: number;
  totalCampaigns: number;
};

type ChartPoint = {
  date: string;
  sent: number;
  delivered: number;
  read: number;
};

type RecentBroadcast = {
  _id: any;
  fileName?: string;
  templateName?: string;
  contactCount?: number;
  successCount?: number;
  deliveredCount?: number;
  readCount?: number;
  errorCount?: number;
  status?: string;
  createdAt?: string | Date;
};

type WidgetKey = 'kpi' | 'funnel' | 'actions' | 'chart' | 'campaigns';

const DEFAULT_LAYOUT: Record<WidgetKey, boolean> = {
  kpi: true,
  funnel: true,
  actions: true,
  chart: true,
  campaigns: true,
};

const WIDGET_OPTIONS: Array<{ key: WidgetKey; label: string }> = [
  { key: 'kpi', label: 'KPI Grid' },
  { key: 'funnel', label: 'Delivery Funnel' },
  { key: 'actions', label: 'Quick Actions' },
  { key: 'chart', label: 'Activity Chart' },
  { key: 'campaigns', label: 'Recent Campaigns' },
];

const BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Overview' },
];

function compact(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

function trend7d(points: ChartPoint[]): { delta: number; up: boolean } {
  if (points.length < 14) return { delta: 0, up: true };
  const last7 = points.slice(-7).reduce((s, p) => s + (p.sent || 0), 0);
  const prev7 = points.slice(-14, -7).reduce((s, p) => s + (p.sent || 0), 0);
  if (!prev7) return { delta: last7 > 0 ? 100 : 0, up: true };
  const d = ((last7 - prev7) / prev7) * 100;
  return { delta: Math.round(d * 10) / 10, up: d >= 0 };
}

export default function OverviewPage() {
  const router = useRouter();
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString();

  const [stats, setStats] = useState<Stats | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [broadcasts, setBroadcasts] = useState<RecentBroadcast[]>([]);
  const [loading, startTransition] = useTransition();

  const [layout, setLayout] = useState<Record<WidgetKey, boolean>>(DEFAULT_LAYOUT);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('wachat-overview-layout');
      if (stored) {
        setLayout({ ...DEFAULT_LAYOUT, ...JSON.parse(stored) });
      }
    } catch (err) {
      // ignore
    }
  }, []);

  const toggleWidget = (key: WidgetKey) => {
    setLayout((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('wachat-overview-layout', JSON.stringify(next));
      return next;
    });
  };

  const reload = useCallback(() => {
    if (!projectId) return;
    startTransition(() => {
      fetch(`/api/wachat/dashboard?projectId=${projectId}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) {
            setStats(data.stats as Stats);
            setChart((data.chart as ChartPoint[]) || []);
            setBroadcasts(data.broadcasts || []);
          }
        })
        .catch((err) => {
          console.error('Failed to load overview data:', err);
        });
    });
  }, [projectId]);

  const handleRefresh = useCallback(() => {
    router.refresh();
    reload();
  }, [router, reload]);

  useEffect(() => {
    reload();
  }, [reload]);

  const derived = useMemo(() => {
    if (!stats) return null;
    return {
      deliveryRate: pct(stats.totalDelivered, stats.totalSent),
      readRate: pct(stats.totalRead, stats.totalDelivered),
      failRate: pct(stats.totalFailed, stats.totalMessages),
      trend: trend7d(chart),
    };
  }, [stats, chart]);

  const handleExport = () => {
    if (!stats) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      project: activeProject?.name,
      projectId,
      stats,
      chart,
      recentBroadcasts: broadcasts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wachat-overview-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!projectId) {
    return (
      <WachatPage breadcrumb={BREADCRUMB} width="wide">
        <EmptyState
          icon={Inbox}
          title="Select a project to continue"
          description="Overview stats are scoped to a single WhatsApp Business project. Pick one from the home screen."
          action={
            <Button variant="primary" onClick={() => router.push('/dashboard')}>
              Go to projects
            </Button>
          }
        />
      </WachatPage>
    );
  }

  if (loading && !stats) {
    return (
      <WachatPage breadcrumb={BREADCRUMB} width="wide">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-9 w-64" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[118px] w-full" />
            ))}
          </div>
          <Skeleton className="h-[260px] w-full" />
        </div>
      </WachatPage>
    );
  }

  const description = activeProject?.name
    ? `${activeProject.name} · Last 30 days of messaging activity`
    : 'Last 30 days of messaging activity';

  const actions = (
    <div className="flex items-center gap-2">
      <Menu
        align="end"
        label="Customize widgets"
        trigger={
          <Button variant="outline" size="sm" iconLeft={LayoutTemplate} iconRight={ChevronDown}>
            Customize
          </Button>
        }
      >
        <MenuLabel>Widgets</MenuLabel>
        <MenuSeparator />
        {WIDGET_OPTIONS.map((opt) => (
          <MenuItem
            key={opt.key}
            icon={layout[opt.key] ? Check : undefined}
            onSelect={() => toggleWidget(opt.key)}
            aria-checked={layout[opt.key]}
            role="menuitemcheckbox"
          >
            {opt.label}
          </MenuItem>
        ))}
      </Menu>

      <Button variant="outline" size="sm" onClick={handleRefresh}>
        <RefreshCw
          className={cx('h-3.5 w-3.5', loading && 'animate-spin')}
          aria-hidden="true"
        />
        Refresh
      </Button>
      <Button variant="outline" size="sm" iconLeft={Download} onClick={handleExport}>
        Export
      </Button>
      <Button variant="primary" iconLeft={Plus} onClick={() => router.push('/wachat/broadcasts')}>
        New campaign
      </Button>
    </div>
  );

  return (
    <WachatPage
      breadcrumb={BREADCRUMB}
      title="Project overview"
      description={description}
      actions={actions}
      width="wide"
    >
      <div className="flex flex-col gap-6">
        {/* KPI grid */}
        {layout.kpi && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Kpi
              icon={<Send className="h-4 w-4" aria-hidden="true" />}
              label="Messages sent"
              value={compact(stats?.totalSent)}
              hint={`${compact(stats?.totalMessages)} total`}
              delta={derived?.trend.delta}
              up={derived?.trend.up}
            />
            <Kpi
              icon={<CheckCheck className="h-4 w-4" aria-hidden="true" />}
              label="Delivery rate"
              value={`${derived?.deliveryRate ?? 0}%`}
              hint={`${compact(stats?.totalDelivered)} delivered`}
            />
            <Kpi
              icon={<Eye className="h-4 w-4" aria-hidden="true" />}
              label="Read rate"
              value={`${derived?.readRate ?? 0}%`}
              hint={`${compact(stats?.totalRead)} read`}
            />
            <Kpi
              icon={<CircleX className="h-4 w-4" aria-hidden="true" />}
              label="Failed"
              value={compact(stats?.totalFailed)}
              hint={`${derived?.failRate ?? 0}% fail rate`}
            />
          </div>
        )}

        {/* Middle row: Funnel / Actions / Chart */}
        {(layout.funnel || layout.actions || layout.chart) && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {layout.funnel && (
              <Card padding="lg" className="col-span-1">
                <CardHeader className="flex flex-row items-center justify-between pb-0">
                  <div>
                    <CardTitle className="text-sm">Delivery funnel</CardTitle>
                    <CardDescription className="mt-1 text-[11.5px]">
                      How your messages moved through WhatsApp
                    </CardDescription>
                  </div>
                  <IconButton
                    label="View broadcasts"
                    icon={TrendingUp}
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/wachat/broadcasts')}
                  />
                </CardHeader>

                <CardBody className="mt-5 flex flex-col gap-3">
                  <FunnelBar
                    label="Queued"
                    count={stats?.totalMessages ?? 0}
                    total={stats?.totalMessages ?? 0}
                    tone="neutral"
                  />
                  <FunnelBar
                    label="Sent"
                    count={stats?.totalSent ?? 0}
                    total={stats?.totalMessages ?? 0}
                    tone="info"
                  />
                  <FunnelBar
                    label="Delivered"
                    count={stats?.totalDelivered ?? 0}
                    total={stats?.totalMessages ?? 0}
                    tone="success"
                  />
                  <FunnelBar
                    label="Read"
                    count={stats?.totalRead ?? 0}
                    total={stats?.totalMessages ?? 0}
                    tone="warning"
                  />
                  <FunnelBar
                    label="Failed"
                    count={stats?.totalFailed ?? 0}
                    total={stats?.totalMessages ?? 0}
                    tone="danger"
                  />
                </CardBody>
              </Card>
            )}

            {layout.chart && (
              <Card
                padding="lg"
                className={cx(
                  !layout.funnel && !layout.actions
                    ? 'col-span-1 lg:col-span-3'
                    : layout.funnel && layout.actions
                      ? 'col-span-1'
                      : 'col-span-1 lg:col-span-2',
                )}
              >
                <CardHeader className="mb-4 pb-0">
                  <CardTitle className="text-sm">Messaging Activity</CardTitle>
                  <CardDescription className="mt-1 text-[11.5px]">
                    Last 30 days performance
                  </CardDescription>
                </CardHeader>
                <OverviewChart data={chart} />
              </Card>
            )}

            {layout.actions && (
              <div
                className={cx(
                  'flex flex-col gap-2',
                  !layout.funnel && !layout.chart
                    ? 'col-span-1 lg:col-span-3'
                    : 'col-span-1',
                )}
              >
                {[
                  { icon: Inbox, label: 'Open Live Chat', href: '/wachat/chat' },
                  { icon: BookCopy, label: 'Manage templates', href: '/wachat/templates' },
                  { icon: Users, label: 'Import contacts', href: '/wachat/contacts' },
                  {
                    icon: Send,
                    label: 'Start a broadcast',
                    href: '/wachat/broadcasts',
                    primary: true,
                  },
                ].map((item) => (
                  <Button
                    key={item.label}
                    block
                    variant={item.primary ? 'primary' : 'outline'}
                    iconLeft={item.icon}
                    onClick={() => router.push(item.href)}
                  >
                    {item.label}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  block
                  iconRight={ArrowUpRight}
                  onClick={() => router.push('/wachat/integrations')}
                >
                  Connect an integration
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Recent campaigns */}
        {layout.campaigns && (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[22px] tracking-tight leading-none text-[color:var(--st-text)]">
                  Recent campaigns
                </h2>
                <p className="mt-1.5 text-[12.5px] text-[color:var(--st-text-secondary)]">
                  {stats?.totalCampaigns ?? 0} campaigns all-time · {broadcasts.length} shown
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <IconButton
                  label="New campaign"
                  icon={Plus}
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/wachat/broadcasts')}
                />
                <IconButton
                  label="More"
                  icon={MoreHorizontal}
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/wachat/broadcasts')}
                />
              </div>
            </div>

            <Card padding="lg" className="mt-5">
              {broadcasts.length === 0 ? (
                <EmptyState
                  icon={MessagesSquare}
                  title="No campaigns yet"
                  description="Launch your first WhatsApp broadcast to reach your audience."
                  action={
                    <Button variant="primary" size="sm" onClick={() => router.push('/wachat/broadcasts')}>
                      Create broadcast
                    </Button>
                  }
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {broadcasts.map((b) => {
                    const total = b.contactCount ?? 0;
                    const delivered = b.deliveredCount ?? 0;
                    const rate = pct(delivered, total);
                    const s = (b.status || '').toLowerCase();
                    const tone: 'success' | 'danger' | 'warning' =
                      s === 'completed'
                        ? 'success'
                        : s === 'failed' || s === 'cancelled' || s === 'partial failure'
                          ? 'danger'
                          : 'warning';
                    const createdDate = b.createdAt ? new Date(b.createdAt as any) : null;
                    return (
                      <Card
                        key={b._id?.toString?.()}
                        variant="outlined"
                        padding="sm"
                        className="flex flex-row items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-[color:var(--st-text)]">
                            {b.fileName || b.templateName || 'Untitled campaign'}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-[color:var(--st-text-secondary)]">
                            {b.templateName && (
                              <>
                                <span className="text-[color:var(--st-text)]">{b.templateName}</span>
                                <span>·</span>
                              </>
                            )}
                            <span>
                              {createdDate
                                ? formatDistanceToNow(createdDate, { addSuffix: true })
                                : 'unknown time'}
                            </span>
                            <Badge tone={tone}>{b.status || 'unknown'}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-end pr-1 text-[11.5px]">
                            <div className="text-[color:var(--st-text)]">{rate}%</div>
                            <div className="text-[color:var(--st-text-secondary)]">
                              {compact(delivered)}/{compact(total)}
                            </div>
                          </div>
                          <IconButton
                            label="View broadcast"
                            icon={ArrowUpRight}
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/wachat/broadcasts/${b._id}/report`)}
                          />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </WachatPage>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  delta,
  up,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  up?: boolean;
}) {
  return (
    <Card padding="sm" className="transition-shadow hover:shadow-[var(--st-shadow-sm)]">
      <div className="flex items-start justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] bg-[color:var(--st-bg-secondary)] text-[color:var(--st-text)]">
          {icon}
        </span>
        {delta !== undefined && (
          <Badge tone={up ? 'success' : 'danger'} className="gap-1">
            {up ? (
              <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" aria-hidden="true" />
            )}
            {Math.abs(delta)}%
          </Badge>
        )}
      </div>
      <div className="mt-3.5 text-[11.5px] leading-none text-[color:var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] tracking-[-0.01em] leading-none text-[color:var(--st-text)]">
        {value}
      </div>
      {hint && (
        <div className="mt-1 truncate text-[11px] leading-tight text-[color:var(--st-text-secondary)]">
          {hint}
        </div>
      )}
    </Card>
  );
}

function FunnelBar({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}) {
  const width = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  const progressTone =
    tone === 'neutral'
      ? 'accent'
      : tone === 'info'
        ? 'accent'
        : tone === 'success'
          ? 'success'
          : tone === 'warning'
            ? 'warning'
            : 'danger';
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="text-[color:var(--st-text)]">{label}</span>
        <span className="text-[color:var(--st-text-secondary)]">
          {count.toLocaleString()} · {width}%
        </span>
      </div>
      <Progress
        value={width}
        tone={progressTone}
        size="sm"
        label={label}
        className="mt-1.5"
      />
    </div>
  );
}
