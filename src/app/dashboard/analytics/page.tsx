'use client';

/**
 * Wachat Analytics — WhatsApp messaging analytics dashboard.
 *
 * Shows conversation analytics from Meta API and local message stats
 * including delivery rates, read rates, and broadcast performance.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  LuActivity,
  LuMessageSquare,
  LuSend,
  LuCheckCheck,
  LuEye,
  LuCircleAlert,
  LuArrowDown,
  LuRefreshCw,
} from 'react-icons/lu';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { getLocalMessageAnalytics, getBroadcastAnalytics } from '@/app/actions/whatsapp-analytics.actions';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

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
  const { toast } = useToast();
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
    { label: 'Messages Sent', value: analytics?.totalSent ?? 0, icon: LuSend, color: 'text-blue-500' },
    { label: 'Delivered', value: analytics?.totalDelivered ?? 0, icon: LuCheckCheck, color: 'text-green-500' },
    { label: 'Read', value: analytics?.totalRead ?? 0, icon: LuEye, color: 'text-emerald-500' },
    { label: 'Failed', value: analytics?.totalFailed ?? 0, icon: LuCircleAlert, color: 'text-red-500' },
    { label: 'Incoming', value: analytics?.totalIncoming ?? 0, icon: LuArrowDown, color: 'text-amber-500' },
    { label: 'Broadcasts', value: broadcastData?.totalBroadcasts ?? 0, icon: LuMessageSquare, color: 'text-purple-500' },
  ];

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Analytics' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
            Message Analytics
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
            Track your messaging performance, delivery rates, and broadcast metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 transition-colors ${dateRange === range ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <ClayButton size="sm" variant="ghost" onClick={fetchAnalytics} disabled={isPending}>
            <LuRefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </ClayButton>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((stat) => (
          <ClayCard key={stat.label} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-2xl font-semibold text-foreground tabular-nums">
              {stat.value.toLocaleString()}
            </p>
          </ClayCard>
        ))}
      </div>

      {/* Delivery Rate */}
      {analytics && analytics.totalSent > 0 && (
        <ClayCard className="p-6">
          <h2 className="text-sm font-medium text-foreground mb-4">Delivery Performance</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Delivery Rate</p>
              <p className="text-3xl font-semibold text-green-500 tabular-nums">
                {((analytics.totalDelivered / analytics.totalSent) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Read Rate</p>
              <p className="text-3xl font-semibold text-emerald-500 tabular-nums">
                {((analytics.totalRead / analytics.totalSent) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Failure Rate</p>
              <p className="text-3xl font-semibold text-red-500 tabular-nums">
                {((analytics.totalFailed / analytics.totalSent) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </ClayCard>
      )}

      {/* Daily trend chart */}
      {analytics && analytics.dailyBreakdown.length > 0 && (
        <ClayCard className="p-6">
          <h2 className="mb-4 text-sm font-medium text-foreground">Daily trend</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.dailyBreakdown} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="date" stroke="#a1a1aa" tick={{ fontSize: 10 }} />
                <YAxis stroke="#a1a1aa" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="sent" stroke="#18181b" strokeWidth={2} dot={false} name="Sent" />
                <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} dot={false} name="Delivered" />
                <Line type="monotone" dataKey="read" stroke="#f59e0b" strokeWidth={2} dot={false} name="Read" />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={false} name="Failed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ClayCard>
      )}

      {/* Daily Breakdown Table */}
      {analytics && analytics.dailyBreakdown.length > 0 && (
        <ClayCard padded={false}>
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-foreground">Daily Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sent</th>
                  <th className="px-4 py-2.5 text-right font-medium">Delivered</th>
                  <th className="px-4 py-2.5 text-right font-medium">Read</th>
                  <th className="px-4 py-2.5 text-right font-medium">Failed</th>
                  <th className="px-4 py-2.5 text-right font-medium">Incoming</th>
                </tr>
              </thead>
              <tbody>
                {analytics.dailyBreakdown.slice().reverse().map((day) => (
                  <tr key={day.date} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="px-4 py-2 text-foreground font-medium">{day.date}</td>
                    <td className="px-4 py-2 text-right text-foreground tabular-nums">{day.sent}</td>
                    <td className="px-4 py-2 text-right text-green-500 tabular-nums">{day.delivered}</td>
                    <td className="px-4 py-2 text-right text-emerald-500 tabular-nums">{day.read}</td>
                    <td className="px-4 py-2 text-right text-red-500 tabular-nums">{day.failed}</td>
                    <td className="px-4 py-2 text-right text-amber-500 tabular-nums">{day.incoming}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ClayCard>
      )}

      {/* Broadcast Performance */}
      {broadcastData && broadcastData.totalBroadcasts > 0 && (
        <ClayCard className="p-6">
          <h2 className="text-sm font-medium text-foreground mb-4">Broadcast Performance</h2>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Total Campaigns</p>
              <p className="text-2xl font-semibold text-foreground tabular-nums">{broadcastData.totalBroadcasts}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Total Recipients</p>
              <p className="text-2xl font-semibold text-foreground tabular-nums">{broadcastData.totalContacts.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Successful</p>
              <p className="text-2xl font-semibold text-green-500 tabular-nums">{broadcastData.totalSuccess.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Failed</p>
              <p className="text-2xl font-semibold text-red-500 tabular-nums">{broadcastData.totalFailed.toLocaleString()}</p>
            </div>
          </div>
        </ClayCard>
      )}

      {!analytics && !isPending && (
        <ClayCard className="p-12 text-center">
          <LuActivity className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">Select a project to view analytics</p>
        </ClayCard>
      )}
    </div>
  );
}
