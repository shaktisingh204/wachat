'use client';

import {
  Button,
  Card,
  EmptyState,
  Field,
  Select,
  SegmentedControl,
  StatCard,
  useToast,
} from '@/components/sabcrm/20ui';
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
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Analytics — WhatsApp messaging analytics dashboard.
 */

import * as React from 'react';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

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
  broadcasts: Array<{
    name: string;
    templateName: string;
    contactCount: number;
    successCount: number;
    failedCount: number;
    status: string;
    createdAt: Date;
  }>;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="p-3"
        style={{
          borderRadius: 'var(--st-radius)',
          border: '1px solid var(--st-border)',
          background: 'var(--st-bg)',
          boxShadow: 'var(--st-shadow-sm, 0 1px 2px rgba(0,0,0,0.06))',
        }}
      >
        <p className="mb-2 text-sm font-medium" style={{ color: 'var(--st-text)' }}>{label}</p>
        <div className="flex flex-col gap-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span style={{ color: 'var(--st-text-secondary)' }}>{entry.name}:</span>
              <span className="font-medium" style={{ color: 'var(--st-text)' }}>{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [broadcastData, setBroadcastData] = useState<BroadcastData | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('all');
  const [yAxisLimit, setYAxisLimit] = useState<string>('auto');

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
        toast({ title: 'Error', description: localResult.error, tone: 'danger' });
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

  const filteredBroadcasts = React.useMemo(() => {
    if (!broadcastData) return [];
    return broadcastData.broadcasts.filter((b) => {
      if (selectedCampaign !== 'all' && b.name !== selectedCampaign) return false;
      if (selectedTemplate !== 'all' && b.templateName !== selectedTemplate) return false;
      return true;
    });
  }, [broadcastData, selectedCampaign, selectedTemplate]);

  const displayBroadcastData = React.useMemo(() => {
    if (!broadcastData) return null;
    return {
      totalBroadcasts: filteredBroadcasts.length,
      totalContacts: filteredBroadcasts.reduce((acc, b) => acc + b.contactCount, 0),
      totalSuccess: filteredBroadcasts.reduce((acc, b) => acc + b.successCount, 0),
      totalFailed: filteredBroadcasts.reduce((acc, b) => acc + b.failedCount, 0),
    };
  }, [broadcastData, filteredBroadcasts]);

  const statCards = [
    { label: 'Messages sent', value: analytics?.totalSent ?? 0, Icon: Send },
    { label: 'Delivered', value: analytics?.totalDelivered ?? 0, Icon: CheckCheck },
    { label: 'Read', value: analytics?.totalRead ?? 0, Icon: Eye },
    { label: 'Failed', value: analytics?.totalFailed ?? 0, Icon: CircleAlert },
    { label: 'Incoming', value: analytics?.totalIncoming ?? 0, Icon: ArrowDown },
    { label: 'Broadcasts', value: displayBroadcastData?.totalBroadcasts ?? 0, Icon: MessageSquare },
  ];

  const campaignOptions = React.useMemo(
    () => [
      { value: 'all', label: 'All Campaigns' },
      ...Array.from(new Set(broadcastData?.broadcasts.map((b) => b.name) || [])).map((name) => ({
        value: name,
        label: name,
      })),
    ],
    [broadcastData],
  );

  const templateOptions = React.useMemo(
    () => [
      { value: 'all', label: 'All Templates' },
      ...Array.from(new Set(broadcastData?.broadcasts.map((b) => b.templateName) || [])).map((name) => ({
        value: name,
        label: name,
      })),
    ],
    [broadcastData],
  );

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Analytics' },
      ]}
      title="Message analytics"
      description="Track your messaging performance, delivery rates, and broadcast metrics."
      width="wide"
      actions={
        <div className="flex items-center gap-2">
          <SegmentedControl
            aria-label="Date range"
            size="sm"
            value={dateRange}
            onChange={setDateRange}
            items={[
              { value: '7d', label: '7 days' },
              { value: '30d', label: '30 days' },
              { value: '90d', label: '90 days' },
            ]}
          />
          <Button size="sm" variant="outline" onClick={fetchAnalytics} disabled={isPending}>
            <RefreshCw className={cx('h-3.5 w-3.5', isPending && 'animate-spin')} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Advanced Filters */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Agent">
            <Select
              value={selectedAgent}
              onChange={(v) => setSelectedAgent(v ?? 'all')}
              placeholder="All Agents"
              options={[
                { value: 'all', label: 'All Agents' },
                { value: 'agent-1', label: 'Agent 1 (No data)', disabled: true },
                { value: 'agent-2', label: 'Agent 2 (No data)', disabled: true },
              ]}
            />
          </Field>
          <Field label="Campaign">
            <Select
              value={selectedCampaign}
              onChange={(v) => setSelectedCampaign(v ?? 'all')}
              placeholder="All Campaigns"
              options={campaignOptions}
            />
          </Field>
          <Field label="Template">
            <Select
              value={selectedTemplate}
              onChange={(v) => setSelectedTemplate(v ?? 'all')}
              placeholder="All Templates"
              options={templateOptions}
            />
          </Field>
          <Field label="Chart Y-Axis Limit">
            <Select
              value={yAxisLimit}
              onChange={(v) => setYAxisLimit(v ?? 'auto')}
              placeholder="Auto"
              options={[
                { value: 'auto', label: 'Auto' },
                { value: '100', label: '100' },
                { value: '500', label: '500' },
                { value: '1000', label: '1,000' },
                { value: '5000', label: '5,000' },
                { value: '10000', label: '10,000' },
              ]}
            />
          </Field>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {statCards.map((stat) => (
            <StatCard
              key={stat.label}
              icon={stat.Icon}
              label={stat.label}
              value={stat.value.toLocaleString()}
            />
          ))}
        </div>

        {/* Delivery rate */}
        {analytics && analytics.totalSent > 0 && (
          <Card padding="lg">
            <h2 className="mb-4 text-sm" style={{ color: 'var(--st-text)' }}>Delivery performance</h2>
            <div className="grid grid-cols-3 gap-6">
              {[
                {
                  label: 'Delivery rate',
                  value: ((analytics.totalDelivered / analytics.totalSent) * 100).toFixed(1),
                  tone: 'var(--st-status-ok)',
                },
                {
                  label: 'Read rate',
                  value: ((analytics.totalRead / analytics.totalSent) * 100).toFixed(1),
                  tone: 'var(--st-status-ok)',
                },
                {
                  label: 'Failure rate',
                  value: ((analytics.totalFailed / analytics.totalSent) * 100).toFixed(1),
                  tone: 'var(--st-danger)',
                },
              ].map((metric) => (
                <div key={metric.label}>
                  <p
                    className="mb-1 text-[11px] uppercase tracking-wider"
                    style={{ color: 'var(--st-text-tertiary)' }}
                  >
                    {metric.label}
                  </p>
                  <p className="text-3xl tabular-nums" style={{ color: metric.tone }}>{metric.value}%</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Daily trend chart */}
        {analytics && analytics.dailyBreakdown.length > 0 && (
          <Card padding="lg">
            <h2 className="mb-4 text-sm" style={{ color: 'var(--st-text)' }}>Daily trend</h2>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dailyBreakdown} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
                  <XAxis dataKey="date" stroke="var(--st-text-tertiary)" tick={{ fontSize: 10 }} />
                  <YAxis
                    stroke="var(--st-text-tertiary)"
                    tick={{ fontSize: 10 }}
                    domain={[0, yAxisLimit === 'auto' ? 'auto' : parseInt(yAxisLimit)]}
                    allowDataOverflow={true}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="sent" stroke="var(--st-text)" strokeWidth={2} dot={false} name="Sent" />
                  <Line type="monotone" dataKey="delivered" stroke="var(--st-status-ok)" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Delivered" />
                  <Line type="monotone" dataKey="read" stroke="var(--st-warn)" strokeWidth={2} strokeDasharray="3 3" dot={false} name="Read" />
                  <Line type="monotone" dataKey="failed" stroke="var(--st-danger)" strokeWidth={2} dot={false} name="Failed" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Daily breakdown table */}
        {analytics && analytics.dailyBreakdown.length > 0 && (
          <Card padding="none">
            <div className="p-4" style={{ borderBottom: '1px solid var(--st-border)' }}>
              <h2 className="text-sm" style={{ color: 'var(--st-text)' }}>Daily breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--st-border)', color: 'var(--st-text-tertiary)' }}>
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
                        style={{ borderBottom: '1px solid var(--st-border)' }}
                      >
                        <td className="px-4 py-2" style={{ color: 'var(--st-text)' }}>{day.date}</td>
                        <td className="px-4 py-2 text-right tabular-nums" style={{ color: 'var(--st-text)' }}>{day.sent}</td>
                        <td className="px-4 py-2 text-right tabular-nums" style={{ color: 'var(--st-status-ok)' }}>{day.delivered}</td>
                        <td className="px-4 py-2 text-right tabular-nums" style={{ color: 'var(--st-status-ok)' }}>{day.read}</td>
                        <td className="px-4 py-2 text-right tabular-nums" style={{ color: 'var(--st-danger)' }}>{day.failed}</td>
                        <td className="px-4 py-2 text-right tabular-nums" style={{ color: 'var(--st-warn)' }}>{day.incoming}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Broadcast performance */}
        {displayBroadcastData && displayBroadcastData.totalBroadcasts > 0 && (
          <Card padding="lg">
            <h2 className="mb-4 text-sm" style={{ color: 'var(--st-text)' }}>Broadcast performance</h2>
            <div className="grid grid-cols-4 gap-6">
              {[
                { label: 'Total campaigns', value: displayBroadcastData.totalBroadcasts, tone: 'var(--st-text)' },
                {
                  label: 'Total recipients',
                  value: displayBroadcastData.totalContacts.toLocaleString(),
                  tone: 'var(--st-text)',
                },
                {
                  label: 'Successful',
                  value: displayBroadcastData.totalSuccess.toLocaleString(),
                  tone: 'var(--st-status-ok)',
                },
                {
                  label: 'Failed',
                  value: displayBroadcastData.totalFailed.toLocaleString(),
                  tone: 'var(--st-danger)',
                },
              ].map((metric) => (
                <div key={metric.label}>
                  <p
                    className="mb-1 text-[11px] uppercase tracking-wider"
                    style={{ color: 'var(--st-text-tertiary)' }}
                  >
                    {metric.label}
                  </p>
                  <p className="text-2xl tabular-nums" style={{ color: metric.tone }}>{metric.value}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!analytics && !isPending && (
          <EmptyState
            icon={Activity}
            title="No analytics yet"
            description="Select a project to view analytics."
          />
        )}
      </div>
    </WachatPage>
  );
}
