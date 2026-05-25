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
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuCheckboxItem,
  EmptyState,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  cn,
} from '@/components/zoruui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowUpRight,
  BookCopy,
  CheckCheck,
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
import {
  getDashboardStats,
  getDashboardChartData,
} from '@/app/actions/dashboard.actions';
import { getBroadcasts } from '@/app/actions/broadcast.actions';

const OverviewChart = dynamic(() => import('./overview-chart'), {
  ssr: false,
  loading: () => <Skeleton className="h-[300px] w-full" />,
});

/**
 * Wachat Overview — project-scoped dashboard.
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
      Promise.all([
        getDashboardStats(projectId),
        getDashboardChartData(projectId),
        getBroadcasts(projectId, 1, 5),
      ]).then(([s, c, b]) => {
        setStats(s as Stats);
        setChart((c as ChartPoint[]) || []);
        setBroadcasts(b.broadcasts || []);
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

  const breadcrumbs = (
    <Breadcrumb>
      <ZoruBreadcrumbList>
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbPage>Overview</ZoruBreadcrumbPage>
        </ZoruBreadcrumbItem>
      </ZoruBreadcrumbList>
    </Breadcrumb>
  );

  if (!projectId) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <EmptyState
          icon={<Inbox className="h-10 w-10" />}
          title="Select a project to continue"
          description="Overview stats are scoped to a single WhatsApp Business project. Pick one from the home screen."
          action={<Button onClick={() => router.push('/dashboard')}>Go to projects</Button>}
        />
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-3 w-52" />
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[118px]" />
          ))}
        </div>
        <Skeleton className="h-[260px]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-6">
      {breadcrumbs}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Project overview</ZoruPageTitle>
            <ZoruPageDescription>
              {activeProject?.name
                ? `${activeProject.name} · Last 30 days of messaging activity`
                : 'Last 30 days of messaging activity'}
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <LayoutTemplate className="h-3.5 w-3.5" />
                Customize
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuLabel>Widgets</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuCheckboxItem
                checked={layout.kpi}
                onCheckedChange={() => toggleWidget('kpi')}
              >
                KPI Grid
              </ZoruDropdownMenuCheckboxItem>
              <ZoruDropdownMenuCheckboxItem
                checked={layout.funnel}
                onCheckedChange={() => toggleWidget('funnel')}
              >
                Delivery Funnel
              </ZoruDropdownMenuCheckboxItem>
              <ZoruDropdownMenuCheckboxItem
                checked={layout.actions}
                onCheckedChange={() => toggleWidget('actions')}
              >
                Quick Actions
              </ZoruDropdownMenuCheckboxItem>
              <ZoruDropdownMenuCheckboxItem
                checked={layout.chart}
                onCheckedChange={() => toggleWidget('chart')}
              >
                Activity Chart
              </ZoruDropdownMenuCheckboxItem>
              <ZoruDropdownMenuCheckboxItem
                checked={layout.campaigns}
                onCheckedChange={() => toggleWidget('campaigns')}
              >
                Recent Campaigns
              </ZoruDropdownMenuCheckboxItem>
            </ZoruDropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button onClick={() => router.push('/wachat/broadcasts')}>
            <Plus className="h-3.5 w-3.5" />
            New campaign
          </Button>
        </div>
      </div>

      {/* KPI grid */}
      {layout.kpi && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Kpi
            icon={<Send className="h-4 w-4" />}
            label="Messages sent"
            value={compact(stats?.totalSent)}
            hint={`${compact(stats?.totalMessages)} total`}
            delta={derived?.trend.delta}
            up={derived?.trend.up}
          />
          <Kpi
            icon={<CheckCheck className="h-4 w-4" />}
            label="Delivery rate"
            value={`${derived?.deliveryRate ?? 0}%`}
            hint={`${compact(stats?.totalDelivered)} delivered`}
          />
          <Kpi
            icon={<Eye className="h-4 w-4" />}
            label="Read rate"
            value={`${derived?.readRate ?? 0}%`}
            hint={`${compact(stats?.totalRead)} read`}
          />
          <Kpi
            icon={<CircleX className="h-4 w-4" />}
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
            <Card className="p-6 col-span-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-zoru-ink">Delivery funnel</div>
                  <div className="mt-1 text-[11.5px] text-zoru-ink-muted">
                    How your messages moved through WhatsApp
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => router.push('/wachat/broadcasts')}>
                  <TrendingUp className="h-3 w-3" />
                </Button>
              </div>

              <div className="mt-5 flex flex-col gap-3">
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
              </div>
            </Card>
          )}

          {layout.chart && (
            <Card className={cn("p-6", (!layout.funnel && !layout.actions) ? "col-span-1 lg:col-span-3" : layout.funnel && layout.actions ? "col-span-1" : "col-span-1 lg:col-span-2")}>
              <div className="mb-4">
                <div className="text-sm text-zoru-ink">Messaging Activity</div>
                <div className="mt-1 text-[11.5px] text-zoru-ink-muted">
                  Last 30 days performance
                </div>
              </div>
              <OverviewChart data={chart} />
            </Card>
          )}

          {layout.actions && (
            <div className={cn("flex flex-col gap-2", (!layout.funnel && !layout.chart) ? "col-span-1 lg:col-span-3" : "col-span-1")}>
              {[
                { icon: <Inbox className="h-4 w-4" />, label: 'Open Live Chat', href: '/wachat/chat' },
                { icon: <BookCopy className="h-4 w-4" />, label: 'Manage templates', href: '/wachat/templates' },
                { icon: <Users className="h-4 w-4" />, label: 'Import contacts', href: '/wachat/contacts' },
                {
                  icon: <Send className="h-4 w-4" />,
                  label: 'Start a broadcast',
                  href: '/wachat/broadcasts',
                  primary: true,
                },
              ].map((item) => (
                <Button
                  key={item.label}
                  block
                  variant={item.primary ? 'default' : 'outline'}
                  onClick={() => router.push(item.href)}
                >
                  {item.icon}
                  {item.label}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                block
                onClick={() => router.push('/wachat/integrations')}
              >
                Connect an integration
                <ArrowUpRight className="h-3 w-3" />
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
              <h2 className="text-[22px] tracking-tight leading-none text-zoru-ink">
                Recent campaigns
              </h2>
              <p className="mt-1.5 text-[12.5px] text-zoru-ink-muted">
                {stats?.totalCampaigns ?? 0} campaigns all-time · {broadcasts.length} shown
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="New campaign"
                onClick={() => router.push('/wachat/broadcasts')}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="More"
                onClick={() => router.push('/wachat/broadcasts')}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card className="mt-5 p-6">
            {broadcasts.length === 0 ? (
              <EmptyState
                icon={<MessagesSquare className="h-10 w-10" />}
                title="No campaigns yet"
                description="Launch your first WhatsApp broadcast to reach your audience."
                action={
                  <Button size="sm" onClick={() => router.push('/wachat/broadcasts')}>
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
                  const variant: 'success' | 'danger' | 'warning' =
                    s === 'completed'
                      ? 'success'
                      : s === 'failed' || s === 'cancelled' || s === 'partial failure'
                        ? 'danger'
                        : 'warning';
                  const createdDate = b.createdAt ? new Date(b.createdAt as any) : null;
                  return (
                    <div
                      key={b._id?.toString?.()}
                      className="flex items-center justify-between gap-3 rounded-[var(--zoru-radius)] border border-zoru-line p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-zoru-ink">
                          {b.fileName || b.templateName || 'Untitled campaign'}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-zoru-ink-muted">
                          {b.templateName && (
                            <>
                              <span className="text-zoru-ink">{b.templateName}</span>
                              <span>·</span>
                            </>
                          )}
                          <span>
                            {createdDate
                              ? formatDistanceToNow(createdDate, { addSuffix: true })
                              : 'unknown time'}
                          </span>
                          <Badge variant={variant}>{b.status || 'unknown'}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end pr-1 text-[11.5px]">
                          <div className="text-zoru-ink">{rate}%</div>
                          <div className="text-zoru-ink-muted">
                            {compact(delivered)}/{compact(total)}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="View broadcast"
                          onClick={() => router.push(`/wachat/broadcasts/${b._id}/report`)}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
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
    <Card className="p-4 transition-shadow hover:shadow-[var(--zoru-shadow-sm)]">
      <div className="flex items-start justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
          {icon}
        </span>
        {delta !== undefined && (
          <Badge variant={up ? 'success' : 'danger'} className="gap-1">
            {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {Math.abs(delta)}%
          </Badge>
        )}
      </div>
      <div className="mt-3.5 text-[11.5px] leading-none text-zoru-ink-muted">{label}</div>
      <div className="mt-1.5 text-[22px] tracking-[-0.01em] leading-none text-zoru-ink">{value}</div>
      {hint && (
        <div className="mt-1 truncate text-[11px] leading-tight text-zoru-ink-muted">{hint}</div>
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
  const color = {
    neutral: 'bg-zoru-ink/70',
    info: 'bg-zoru-info',
    success: 'bg-zoru-success',
    warning: 'bg-zoru-warning',
    danger: 'bg-zoru-danger',
  }[tone];
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="text-zoru-ink">{label}</span>
        <span className="text-zoru-ink-muted">
          {count.toLocaleString()} · {width}%
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zoru-surface-2">
        <div
          className={cn('h-full rounded-full transition-[width]', color)}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
