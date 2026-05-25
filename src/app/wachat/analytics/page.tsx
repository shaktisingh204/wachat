'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
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
      <div className="rounded-lg border border-zoru-line bg-zoru-surface p-3 shadow-sm">
        <p className="mb-2 text-sm font-medium text-zoru-ink">{label}</p>
        <div className="flex flex-col gap-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-zoru-ink-muted">{entry.name}:</span>
              <span className="font-medium text-zoru-ink">{entry.value}</span>
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
  const { toast } = useZoruToast();
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

  return (
    <div className="flex min-h-full flex-col gap-6">
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
            <ZoruBreadcrumbPage>Analytics</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Message analytics</ZoruPageTitle>
            <ZoruPageDescription>
              Track your messaging performance, delivery rates, and broadcast metrics.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>

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
          <Button size="sm" variant="outline" onClick={fetchAnalytics} disabled={isPending}>
            <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zoru-ink-muted">Agent</label>
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger>
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              <SelectItem value="agent-1" disabled>Agent 1 (No data)</SelectItem>
              <SelectItem value="agent-2" disabled>Agent 2 (No data)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zoru-ink-muted">Campaign</label>
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger>
              <SelectValue placeholder="All Campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {Array.from(new Set(broadcastData?.broadcasts.map((b) => b.name) || [])).map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zoru-ink-muted">Template</label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger>
              <SelectValue placeholder="All Templates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Templates</SelectItem>
              {Array.from(new Set(broadcastData?.broadcasts.map((b) => b.templateName) || [])).map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zoru-ink-muted">Chart Y-Axis Limit</label>
          <Select value={yAxisLimit} onValueChange={setYAxisLimit}>
            <SelectTrigger>
              <SelectValue placeholder="Auto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="500">500</SelectItem>
              <SelectItem value="1000">1,000</SelectItem>
              <SelectItem value="5000">5,000</SelectItem>
              <SelectItem value="10000">10,000</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <stat.Icon className="h-4 w-4 text-zoru-ink-muted" />
              <span className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">
                {stat.label}
              </span>
            </div>
            <p className="text-2xl tabular-nums text-zoru-ink">{stat.value.toLocaleString()}</p>
          </Card>
        ))}
      </div>

      {/* Delivery rate */}
      {analytics && analytics.totalSent > 0 && (
        <Card className="p-6">
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
        </Card>
      )}

      {/* Daily trend chart */}
      {analytics && analytics.dailyBreakdown.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-4 text-sm text-zoru-ink">Daily trend</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.dailyBreakdown} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--zoru-line))" />
                <XAxis dataKey="date" stroke="hsl(var(--zoru-ink-muted))" tick={{ fontSize: 10 }} />
                <YAxis 
                  stroke="hsl(var(--zoru-ink-muted))" 
                  tick={{ fontSize: 10 }} 
                  domain={[0, yAxisLimit === 'auto' ? 'auto' : parseInt(yAxisLimit)]}
                  allowDataOverflow={true}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="sent" stroke="hsl(var(--zoru-ink))" strokeWidth={2} dot={false} name="Sent" />
                <Line type="monotone" dataKey="delivered" stroke="hsl(var(--zoru-success))" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Delivered" />
                <Line type="monotone" dataKey="read" stroke="hsl(var(--zoru-warning))" strokeWidth={2} strokeDasharray="3 3" dot={false} name="Read" />
                <Line type="monotone" dataKey="failed" stroke="hsl(var(--zoru-danger))" strokeWidth={2} dot={false} name="Failed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Daily breakdown table */}
      {analytics && analytics.dailyBreakdown.length > 0 && (
        <Card>
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
        </Card>
      )}

      {/* Broadcast performance */}
      {displayBroadcastData && displayBroadcastData.totalBroadcasts > 0 && (
        <Card className="p-6">
          <h2 className="mb-4 text-sm text-zoru-ink">Broadcast performance</h2>
          <div className="grid grid-cols-4 gap-6">
            {[
              { label: 'Total campaigns', value: displayBroadcastData.totalBroadcasts, tone: 'text-zoru-ink' },
              {
                label: 'Total recipients',
                value: displayBroadcastData.totalContacts.toLocaleString(),
                tone: 'text-zoru-ink',
              },
              {
                label: 'Successful',
                value: displayBroadcastData.totalSuccess.toLocaleString(),
                tone: 'text-zoru-success-ink',
              },
              {
                label: 'Failed',
                value: displayBroadcastData.totalFailed.toLocaleString(),
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
        </Card>
      )}

      {!analytics && !isPending && (
        <EmptyState
          icon={<Activity className="h-12 w-12" />}
          title="No analytics yet"
          description="Select a project to view analytics."
        />
      )}
    </div>
  );
}
