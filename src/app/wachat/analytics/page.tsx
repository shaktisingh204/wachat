'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
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
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  Tabs,
} from '@/components/wachat-ui';
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  useZoruToast,
} from '@/components/zoruui';

/**
 * Wachat Analytics - WhatsApp messaging analytics dashboard.
 */

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
      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.12)]">
        <p className="mb-2 text-[12.5px] font-semibold text-zinc-900">{label}</p>
        <div className="flex flex-col gap-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-[11.5px]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-zinc-500">{entry.name}:</span>
              <span className="font-medium text-zinc-900 tabular-nums">{entry.value}</span>
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

  useEffect(() => {
    document.title = 'Analytics · Wachat';
  }, []);

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

  const filteredBroadcasts = useMemo(() => {
    if (!broadcastData) return [];
    return broadcastData.broadcasts.filter((b) => {
      if (selectedCampaign !== 'all' && b.name !== selectedCampaign) return false;
      if (selectedTemplate !== 'all' && b.templateName !== selectedTemplate) return false;
      return true;
    });
  }, [broadcastData, selectedCampaign, selectedTemplate]);

  const displayBroadcastData = useMemo(() => {
    if (!broadcastData) return null;
    return {
      totalBroadcasts: filteredBroadcasts.length,
      totalContacts: filteredBroadcasts.reduce((acc, b) => acc + b.contactCount, 0),
      totalSuccess: filteredBroadcasts.reduce((acc, b) => acc + b.successCount, 0),
      totalFailed: filteredBroadcasts.reduce((acc, b) => acc + b.failedCount, 0),
    };
  }, [broadcastData, filteredBroadcasts]);

  const statCards = [
    { label: 'Messages sent', value: analytics?.totalSent ?? 0, icon: Send },
    { label: 'Delivered', value: analytics?.totalDelivered ?? 0, icon: CheckCheck },
    { label: 'Read', value: analytics?.totalRead ?? 0, icon: Eye },
    { label: 'Failed', value: analytics?.totalFailed ?? 0, icon: CircleAlert },
    { label: 'Incoming', value: analytics?.totalIncoming ?? 0, icon: ArrowDown },
    { label: 'Broadcasts', value: displayBroadcastData?.totalBroadcasts ?? 0, icon: MessageSquare },
  ];

  return (
    <WaPage>
      <PageHeader
        title="Message analytics"
        kicker="Analytics"
        description="Track messaging performance, delivery rates, and broadcast metrics."
        eyebrowIcon={Activity}
        actions={
          <>
            <Tabs
              items={[
                { id: '7d', label: '7 days' },
                { id: '30d', label: '30 days' },
                { id: '90d', label: '90 days' },
              ]}
              active={dateRange}
              onChange={(id) => setDateRange(id as '7d' | '30d' | '90d')}
              layoutId="analytics-range"
            />
            <WaButton
              size="sm"
              variant="outline"
              onClick={fetchAnalytics}
              disabled={isPending}
              leftIcon={RefreshCw}
            >
              Refresh
            </WaButton>
          </>
        }
      />

      {/* Filters */}
      <Section title="Filters" description="Narrow analytics by segment.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Agent
            </label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                <SelectItem value="agent-1" disabled>
                  Agent 1 (no data)
                </SelectItem>
                <SelectItem value="agent-2" disabled>
                  Agent 2 (no data)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Campaign
            </label>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger>
                <SelectValue placeholder="All campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {Array.from(new Set(broadcastData?.broadcasts.map((b) => b.name) || [])).map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Template
            </label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="All templates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {Array.from(new Set(broadcastData?.broadcasts.map((b) => b.templateName) || [])).map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Chart Y-axis limit
            </label>
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
      </Section>

      {/* Stats grid */}
      <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((s, i) => (
          <MetricTile
            key={s.label}
            label={s.label}
            value={s.value.toLocaleString()}
            icon={s.icon}
            delay={0.02 + i * 0.04}
          />
        ))}
      </div>

      {/* Delivery performance */}
      {analytics && analytics.totalSent > 0 && (
        <div className="mb-6">
          <Section title="Delivery performance" description="Headline rates over the selected window.">
            <div className="grid grid-cols-3 gap-6">
              {[
                {
                  label: 'Delivery rate',
                  value: ((analytics.totalDelivered / analytics.totalSent) * 100).toFixed(1),
                  positive: true,
                },
                {
                  label: 'Read rate',
                  value: ((analytics.totalRead / analytics.totalSent) * 100).toFixed(1),
                  positive: true,
                },
                {
                  label: 'Failure rate',
                  value: ((analytics.totalFailed / analytics.totalSent) * 100).toFixed(1),
                  positive: false,
                },
              ].map((metric) => (
                <div key={metric.label}>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
                    {metric.label}
                  </p>
                  <p
                    className={`text-3xl font-semibold tabular-nums ${
                      metric.positive ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {metric.value}%
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Daily trend */}
      {analytics && analytics.dailyBreakdown.length > 0 && (
        <div className="mb-6">
          <Section title="Daily trend" description="Sent, delivered, read, and failed over time.">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dailyBreakdown} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} />
                  <YAxis
                    stroke="#71717a"
                    tick={{ fontSize: 10 }}
                    domain={[0, yAxisLimit === 'auto' ? 'auto' : parseInt(yAxisLimit)]}
                    allowDataOverflow
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="sent" stroke="#10b981" strokeWidth={2} dot={false} name="Sent" />
                  <Line
                    type="monotone"
                    dataKey="delivered"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    name="Delivered"
                  />
                  <Line
                    type="monotone"
                    dataKey="read"
                    stroke="#a16207"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    dot={false}
                    name="Read"
                  />
                  <Line type="monotone" dataKey="failed" stroke="#e11d48" strokeWidth={2} dot={false} name="Failed" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>
      )}

      {/* Daily breakdown table */}
      {analytics && analytics.dailyBreakdown.length > 0 && (
        <div className="mb-6">
          <Section title="Daily breakdown" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    <th className="px-5 py-2.5 text-left">Date</th>
                    <th className="px-5 py-2.5 text-right">Sent</th>
                    <th className="px-5 py-2.5 text-right">Delivered</th>
                    <th className="px-5 py-2.5 text-right">Read</th>
                    <th className="px-5 py-2.5 text-right">Failed</th>
                    <th className="px-5 py-2.5 text-right">Incoming</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {analytics.dailyBreakdown
                    .slice()
                    .reverse()
                    .map((day) => (
                      <tr key={day.date} className="hover:bg-zinc-50">
                        <td className="px-5 py-2 text-zinc-900">{day.date}</td>
                        <td className="px-5 py-2 text-right tabular-nums text-zinc-900">{day.sent}</td>
                        <td className="px-5 py-2 text-right tabular-nums text-emerald-700">{day.delivered}</td>
                        <td className="px-5 py-2 text-right tabular-nums text-emerald-700">{day.read}</td>
                        <td className="px-5 py-2 text-right tabular-nums text-rose-700">{day.failed}</td>
                        <td className="px-5 py-2 text-right tabular-nums text-amber-700">{day.incoming}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* Broadcast performance */}
      {displayBroadcastData && displayBroadcastData.totalBroadcasts > 0 && (
        <div className="mb-6">
          <Section title="Broadcast performance" description="Filtered campaigns from the date window.">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {[
                { label: 'Total campaigns', value: displayBroadcastData.totalBroadcasts.toLocaleString(), tone: 'zinc' },
                { label: 'Total recipients', value: displayBroadcastData.totalContacts.toLocaleString(), tone: 'zinc' },
                { label: 'Successful', value: displayBroadcastData.totalSuccess.toLocaleString(), tone: 'emerald' },
                { label: 'Failed', value: displayBroadcastData.totalFailed.toLocaleString(), tone: 'rose' },
              ].map((metric) => (
                <div key={metric.label}>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
                    {metric.label}
                  </p>
                  <p
                    className={`text-2xl font-semibold tabular-nums ${
                      metric.tone === 'emerald'
                        ? 'text-emerald-600'
                        : metric.tone === 'rose'
                        ? 'text-rose-600'
                        : 'text-zinc-950'
                    }`}
                  >
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {!analytics && !isPending && (
        <EmptyState
          icon={Activity}
          title="No analytics yet"
          description="Select a project or send messages to populate this dashboard."
        />
      )}
    </WaPage>
  );
}
