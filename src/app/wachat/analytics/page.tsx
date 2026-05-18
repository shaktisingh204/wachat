'use client';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import {
  Activity,
  ArrowDown,
  CircleAlert,
  CheckCheck,
  Eye,
  MessageSquare,
  RefreshCw,
  Send,
  } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  } from 'recharts';

import { useProject } from '@/context/project-context';
import {
  getLocalMessageAnalytics,
  getBroadcastAnalytics,
  } from '@/app/actions/whatsapp-analytics.actions';

/**
 * Wachat Analytics — WhatsApp messaging analytics dashboard.
 */

import * as React from 'react';

export const dynamic = 'force-dynamic';

type AnalyticsData = {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  totalIncoming: number;
  dailyBreakdown: Array<{
    date: string;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    incoming: number;
  }>;
};

type BroadcastData = {
  totalBroadcasts: number;
  totalContacts: number;
  totalSuccess: number;
  totalFailed: number;
};

export default function AnalyticsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [broadcastData, setBroadcastData] = useState<BroadcastData | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchAnalytics = useCallback(() => {
    if (!activeProject?._id) return;

    startTransition(async () => {
      const now = new Date();
      const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      const [localResult, broadcastResult] = await Promise.all([
        getLocalMessageAnalytics(activeProject._id.toString(), startDate, now),
        getBroadcastAnalytics(activeProject._id.toString(), startDate, now),
      ]);

      if (localResult.error) {
        toast({ title: 'Error', description: localResult.error, variant: 'destructive' });
      } else {
        setAnalytics(localResult);
      }

      if (!broadcastResult.error) {
        setBroadcastData(broadcastResult);
      }
    });
  }, [activeProject?._id, dateRange, toast]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const statCards = [
    { label: 'Messages sent', value: analytics?.totalSent ?? 0, Icon: Send },
    { label: 'Delivered', value: analytics?.totalDelivered ?? 0, Icon: CheckCheck },
    { label: 'Read', value: analytics?.totalRead ?? 0, Icon: Eye },
    { label: 'Failed', value: analytics?.totalFailed ?? 0, Icon: CircleAlert },
    { label: 'Incoming', value: analytics?.totalIncoming ?? 0, Icon: ArrowDown },
    { label: 'Broadcasts', value: broadcastData?.totalBroadcasts ?? 0, Icon: MessageSquare },
  ];

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
            <ZoruBreadcrumbPage>Analytics</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <ZoruPageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Message analytics</ZoruPageTitle>
            <ZoruPageDescription>
              Track your messaging performance, delivery rates, and broadcast metrics.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </ZoruPageHeader>

        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-[var(--zoru-radius-sm)] border border-zoru-line text-xs">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  'px-3 py-1.5 transition-colors',
                  dateRange === range
                    ? 'bg-zoru-surface-2 text-zoru-ink'
                    : 'text-zoru-ink-muted hover:bg-zoru-surface',
                )}
              >
                {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
              </button>
            ))}
          </div>
          <ZoruButton size="sm" variant="outline" onClick={fetchAnalytics} disabled={isPending}>
            <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
            Refresh
          </ZoruButton>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((stat) => (
          <ZoruCard key={stat.label} className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <stat.Icon className="h-4 w-4 text-zoru-ink-muted" />
              <span className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">
                {stat.label}
              </span>
            </div>
            <p className="text-2xl tabular-nums text-zoru-ink">{stat.value.toLocaleString()}</p>
          </ZoruCard>
        ))}
      </div>

      {/* Delivery rate */}
      {analytics && analytics.totalSent > 0 && (
        <ZoruCard className="p-6">
          <h2 className="mb-4 text-sm text-zoru-ink">Delivery performance</h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              {
                label: 'Delivery rate',
                value: ((analytics.totalDelivered / analytics.totalSent) * 100).toFixed(1),
                tone: 'text-zoru-success-ink',
              },
              {
                label: 'Read rate',
                value: ((analytics.totalRead / analytics.totalSent) * 100).toFixed(1),
                tone: 'text-zoru-success-ink',
              },
              {
                label: 'Failure rate',
                value: ((analytics.totalFailed / analytics.totalSent) * 100).toFixed(1),
                tone: 'text-zoru-danger-ink',
              },
            ].map((metric) => (
              <div key={metric.label}>
                <p className="mb-1 text-[11px] uppercase tracking-wider text-zoru-ink-muted">
                  {metric.label}
                </p>
                <p className={cn('text-3xl tabular-nums', metric.tone)}>{metric.value}%</p>
              </div>
            ))}
          </div>
        </ZoruCard>
      )}

      {/* Daily trend chart */}
      {analytics && analytics.dailyBreakdown.length > 0 && (
        <ZoruCard className="p-6">
          <h2 className="mb-4 text-sm text-zoru-ink">Daily trend</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.dailyBreakdown} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--zoru-line))" />
                <XAxis dataKey="date" stroke="hsl(var(--zoru-ink-muted))" tick={{ fontSize: 10 }} />
                <YAxis stroke="hsl(var(--zoru-ink-muted))" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="sent" stroke="hsl(var(--zoru-ink))" strokeWidth={2} dot={false} name="Sent" />
                <Line type="monotone" dataKey="delivered" stroke="hsl(var(--zoru-success))" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Delivered" />
                <Line type="monotone" dataKey="read" stroke="hsl(var(--zoru-warning))" strokeWidth={2} strokeDasharray="3 3" dot={false} name="Read" />
                <Line type="monotone" dataKey="failed" stroke="hsl(var(--zoru-danger))" strokeWidth={2} dot={false} name="Failed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ZoruCard>
      )}

      {/* Daily breakdown table */}
      {analytics && analytics.dailyBreakdown.length > 0 && (
        <ZoruCard>
          <div className="border-b border-zoru-line p-4">
            <h2 className="text-sm text-zoru-ink">Daily breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zoru-line text-zoru-ink-muted">
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-right">Sent</th>
                  <th className="px-4 py-2.5 text-right">Delivered</th>
                  <th className="px-4 py-2.5 text-right">Read</th>
                  <th className="px-4 py-2.5 text-right">Failed</th>
                  <th className="px-4 py-2.5 text-right">Incoming</th>
                </tr>
              </thead>
              <tbody>
                {analytics.dailyBreakdown
                  .slice()
                  .reverse()
                  .map((day) => (
                    <tr
                      key={day.date}
                      className="border-b border-zoru-line/50 hover:bg-zoru-surface-2"
                    >
                      <td className="px-4 py-2 text-zoru-ink">{day.date}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-zoru-ink">{day.sent}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-zoru-success-ink">{day.delivered}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-zoru-success-ink">{day.read}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-zoru-danger-ink">{day.failed}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-zoru-warning-ink">{day.incoming}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </ZoruCard>
      )}

      {/* Broadcast performance */}
      {broadcastData && broadcastData.totalBroadcasts > 0 && (
        <ZoruCard className="p-6">
          <h2 className="mb-4 text-sm text-zoru-ink">Broadcast performance</h2>
          <div className="grid grid-cols-4 gap-6">
            {[
              { label: 'Total campaigns', value: broadcastData.totalBroadcasts, tone: 'text-zoru-ink' },
              {
                label: 'Total recipients',
                value: broadcastData.totalContacts.toLocaleString(),
                tone: 'text-zoru-ink',
              },
              {
                label: 'Successful',
                value: broadcastData.totalSuccess.toLocaleString(),
                tone: 'text-zoru-success-ink',
              },
              {
                label: 'Failed',
                value: broadcastData.totalFailed.toLocaleString(),
                tone: 'text-zoru-danger-ink',
              },
            ].map((metric) => (
              <div key={metric.label}>
                <p className="mb-1 text-[11px] uppercase tracking-wider text-zoru-ink-muted">
                  {metric.label}
                </p>
                <p className={cn('text-2xl tabular-nums', metric.tone)}>{metric.value}</p>
              </div>
            ))}
          </div>
        </ZoruCard>
      )}

      {!analytics && !isPending && (
        <ZoruEmptyState
          icon={<Activity className="h-12 w-12" />}
          title="No analytics yet"
          description="Select a project to view analytics."
        />
      )}
    </div>
  );
}
