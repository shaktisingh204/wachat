'use client';

/**
 * Wachat Template Analytics — view delivery and read metrics per
 * template, rebuilt on ZoruUI primitives. Greyscale chart palette.
 */

import * as React from 'react';
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  useCallback,
} from 'react';
import {
  BarChart3,
  Loader2,
  RefreshCw,
  Send,
  CircleCheck,
  Eye,
  CircleX,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getTemplateAnalytics } from '@/app/actions/wachat-features.actions';

import {
  ZORU_CHART_PALETTE,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZoruEmptyState,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  cn,
  useZoruToast,
} from '@/components/zoruui';

type AnalyticsRow = {
  _id?: string;
  sent?: number;
  delivered?: number;
  read?: number;
  failed?: number;
};

function rateClass(rate: number): string {
  if (rate >= 80) return 'text-zoru-success';
  if (rate >= 50) return 'text-zoru-warning';
  return 'text-zoru-danger';
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

export default function TemplateAnalyticsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [isLoading, startLoading] = useTransition();

  const fetchAnalytics = useCallback(
    (pid: string, showToast = false) => {
      startLoading(async () => {
        const res = await getTemplateAnalytics(pid);
        if (res.error) {
          toast({
            title: 'Error',
            description: res.error,
            variant: 'destructive',
          });
        } else {
          setAnalytics(res.analytics || []);
          if (showToast) {
            toast({
              title: 'Refreshed',
              description: 'Analytics data updated.',
            });
          }
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchAnalytics(projectId);
  }, [projectId, fetchAnalytics]);

  const totals = useMemo(() => {
    const totalSent = analytics.reduce((s, a) => s + (a.sent || 0), 0);
    const totalDelivered = analytics.reduce(
      (s, a) => s + (a.delivered || 0),
      0,
    );
    const totalRead = analytics.reduce((s, a) => s + (a.read || 0), 0);
    const totalFailed = analytics.reduce((s, a) => s + (a.failed || 0), 0);
    return { totalSent, totalDelivered, totalRead, totalFailed };
  }, [analytics]);

  const chartData = useMemo(
    () =>
      analytics.slice(0, 10).map((row) => ({
        name: (row._id || 'Unknown').slice(0, 18),
        Sent: row.sent || 0,
        Delivered: row.delivered || 0,
        Read: row.read || 0,
      })),
    [analytics],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
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
            <ZoruBreadcrumbLink href="/wachat/templates">
              Templates
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Analytics</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader bordered={false}>
        <ZoruPageHeading>
          <ZoruPageTitle>Template analytics</ZoruPageTitle>
          <ZoruPageDescription>
            Track delivery, read, and failure rates for your WhatsApp message
            templates.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => projectId && fetchAnalytics(projectId, true)}
            disabled={!projectId || isLoading}
          >
            <RefreshCw className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ZoruStatCard
          label="Total sent"
          value={totals.totalSent.toLocaleString()}
          icon={<Send />}
        />
        <ZoruStatCard
          label="Delivered"
          value={totals.totalDelivered.toLocaleString()}
          icon={<CircleCheck />}
        />
        <ZoruStatCard
          label="Read"
          value={totals.totalRead.toLocaleString()}
          icon={<Eye />}
        />
        <ZoruStatCard
          label="Failed"
          value={totals.totalFailed.toLocaleString()}
          icon={<CircleX />}
        />
      </div>

      {/* Engagement chart */}
      <ZoruCard>
        <ZoruCardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-zoru-ink">
                Engagement by template
              </h3>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Top 10 templates by send volume
              </p>
            </div>
          </div>
          {isLoading && analytics.length === 0 ? (
            <ZoruSkeleton className="h-[280px] w-full" />
          ) : chartData.length === 0 ? (
            <ZoruEmptyState
              compact
              icon={<BarChart3 />}
              title="No engagement data"
              description="Send template messages to begin collecting metrics."
            />
          ) : (
            <ZoruChartContainer height={280}>
              <ZoruChart.BarChart data={chartData}>
                <ZoruChart.CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--zoru-line))"
                />
                <ZoruChart.XAxis
                  dataKey="name"
                  stroke="hsl(var(--zoru-ink-muted))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <ZoruChart.YAxis
                  stroke="hsl(var(--zoru-ink-muted))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <ZoruChart.Tooltip
                  content={(props: any) => <ZoruChartTooltip {...props} />}
                  cursor={{ fill: 'hsl(var(--zoru-surface))' }}
                />
                <ZoruChart.Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11 }}
                />
                <ZoruChart.Bar
                  dataKey="Sent"
                  fill={ZORU_CHART_PALETTE[0]}
                  radius={[4, 4, 0, 0]}
                />
                <ZoruChart.Bar
                  dataKey="Delivered"
                  fill={ZORU_CHART_PALETTE[1]}
                  radius={[4, 4, 0, 0]}
                />
                <ZoruChart.Bar
                  dataKey="Read"
                  fill={ZORU_CHART_PALETTE[2]}
                  radius={[4, 4, 0, 0]}
                />
              </ZoruChart.BarChart>
            </ZoruChartContainer>
          )}
        </ZoruCardContent>
      </ZoruCard>

      {/* Per-template table */}
      <ZoruCard>
        <ZoruCardContent className="pt-6">
          <div className="mb-4">
            <h3 className="text-[15px] font-semibold text-zoru-ink">
              Per-template breakdown
            </h3>
            <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
              Delivery and read rates for every template that sent messages.
            </p>
          </div>
          {isLoading && analytics.length === 0 ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
            </div>
          ) : analytics.length === 0 ? (
            <ZoruEmptyState
              compact
              icon={<BarChart3 />}
              title="No analytics data"
              description="Send template messages to start collecting delivery metrics."
            />
          ) : (
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Template name</ZoruTableHead>
                  <ZoruTableHead className="text-right">Sent</ZoruTableHead>
                  <ZoruTableHead className="text-right">Delivered</ZoruTableHead>
                  <ZoruTableHead className="text-right">Read</ZoruTableHead>
                  <ZoruTableHead className="text-right">Failed</ZoruTableHead>
                  <ZoruTableHead className="text-right">Delivery %</ZoruTableHead>
                  <ZoruTableHead className="text-right">Read %</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {analytics.map((row) => {
                  const deliveryRate = pct(row.delivered || 0, row.sent || 0);
                  const readRate = pct(row.read || 0, row.sent || 0);
                  return (
                    <ZoruTableRow key={row._id || 'unknown'}>
                      <ZoruTableCell className="text-[13px] font-medium">
                        {row._id || 'Unknown'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] tabular-nums">
                        {(row.sent || 0).toLocaleString()}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] tabular-nums">
                        {(row.delivered || 0).toLocaleString()}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] tabular-nums">
                        {(row.read || 0).toLocaleString()}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] tabular-nums">
                        {(row.failed || 0).toLocaleString()}
                      </ZoruTableCell>
                      <ZoruTableCell
                        className={cn(
                          'text-right text-[13px] font-semibold tabular-nums',
                          rateClass(deliveryRate),
                        )}
                      >
                        {deliveryRate}%
                      </ZoruTableCell>
                      <ZoruTableCell
                        className={cn(
                          'text-right text-[13px] font-semibold tabular-nums',
                          rateClass(readRate),
                        )}
                      >
                        {readRate}%
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })}
              </ZoruTableBody>
            </ZoruTable>
          )}
        </ZoruCardContent>
      </ZoruCard>

      <div className="h-6" />
    </div>
  );
}
