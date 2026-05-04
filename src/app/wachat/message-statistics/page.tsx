'use client';

/**
 * Wachat Message Statistics — ZoruUI rebuild.
 *
 * Aggregate stat-card grid + segment filter (daily / weekly / monthly)
 * + neutral bar histogram. Greyscale palette only.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Image as ImageIcon,
  Inbox,
  MessageSquare,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { getMessageStatistics } from '@/app/actions/wachat-features.actions';

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
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruSkeleton,
  ZoruStatCard,
} from '@/components/zoruui';

type Period = 'daily' | 'weekly' | 'monthly';

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function MessageStatisticsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [period, setPeriod] = useState<Period>('daily');
  const [stats, setStats] = useState({ total: 0, incoming: 0, outgoing: 0, media: 0 });
  const [isLoading, startTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getMessageStatistics(projectId, period);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      if (res.stats) setStats(res.stats);
    });
  }, [projectId, period, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const histogramData = [
    { name: 'Incoming', value: stats.incoming },
    { name: 'Outgoing', value: stats.outgoing },
    { name: 'Media', value: stats.media },
  ];

  const isEmpty = !isLoading && stats.total === 0;

  return (
    <div className="flex min-h-full flex-col gap-6">
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
            <ZoruBreadcrumbPage>Message Statistics</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Message Statistics
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Monitor your message volume and engagement metrics.
          </p>
        </div>
        <ZoruDropdownMenu>
          <ZoruDropdownMenuTrigger asChild>
            <ZoruButton variant="outline" size="sm">
              {PERIOD_LABELS[period]}
              <ChevronDown className="opacity-60" />
            </ZoruButton>
          </ZoruDropdownMenuTrigger>
          <ZoruDropdownMenuContent align="end">
            <ZoruDropdownMenuLabel>Segment</ZoruDropdownMenuLabel>
            <ZoruDropdownMenuRadioGroup
              value={period}
              onValueChange={(v) => setPeriod(v as Period)}
            >
              <ZoruDropdownMenuRadioItem value="daily">Daily</ZoruDropdownMenuRadioItem>
              <ZoruDropdownMenuRadioItem value="weekly">Weekly</ZoruDropdownMenuRadioItem>
              <ZoruDropdownMenuRadioItem value="monthly">Monthly</ZoruDropdownMenuRadioItem>
            </ZoruDropdownMenuRadioGroup>
          </ZoruDropdownMenuContent>
        </ZoruDropdownMenu>
      </div>

      {isLoading && stats.total === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ZoruStatCard
              label="Total Messages"
              value={stats.total.toLocaleString()}
              icon={<MessageSquare />}
              period={PERIOD_LABELS[period]}
            />
            <ZoruStatCard
              label="Incoming"
              value={stats.incoming.toLocaleString()}
              icon={<ArrowDownLeft />}
              period={PERIOD_LABELS[period]}
            />
            <ZoruStatCard
              label="Outgoing"
              value={stats.outgoing.toLocaleString()}
              icon={<ArrowUpRight />}
              period={PERIOD_LABELS[period]}
            />
            <ZoruStatCard
              label="Media Messages"
              value={stats.media.toLocaleString()}
              icon={<ImageIcon />}
              period={PERIOD_LABELS[period]}
            />
          </div>

          <ZoruCard>
            <ZoruCardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-zoru-ink-muted" />
                <ZoruCardTitle>Volume Breakdown</ZoruCardTitle>
              </div>
              <ZoruCardDescription>
                Distribution across incoming, outgoing, and media messages.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
              {isEmpty ? (
                <ZoruEmptyState
                  icon={<Inbox />}
                  title="No messages yet"
                  description="Statistics will appear here once your project starts exchanging messages."
                />
              ) : (
                <ZoruChartContainer height={240}>
                  <ZoruChart.BarChart
                    data={histogramData}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <ZoruChart.CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--zoru-line))"
                      vertical={false}
                    />
                    <ZoruChart.XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'hsl(var(--zoru-ink-muted))' }}
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--zoru-line))' }}
                    />
                    <ZoruChart.YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--zoru-ink-muted))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                    <ZoruChart.Bar
                      dataKey="value"
                      fill={ZORU_CHART_PALETTE[1]}
                      radius={[4, 4, 0, 0]}
                    />
                  </ZoruChart.BarChart>
                </ZoruChartContainer>
              )}
            </ZoruCardContent>
          </ZoruCard>
        </>
      )}
      <div className="h-6" />
    </div>
  );
}
