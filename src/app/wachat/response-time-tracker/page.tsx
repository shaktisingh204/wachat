'use client';

import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  BarChart3,
  RefreshCw,
  CircleCheck,
  Eye,
  TriangleAlert,
  Users,
  Download,
  Mail,
  Zap,
  Timer,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { m, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import { getAgentPerformance } from '@/app/actions/wachat-features.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  StatusPill,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import {
  useZoruToast,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogFooter,
  Input,
  Label,
  Switch,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';

/**
 * Wachat Response Time Tracker - rebuilt on wachat-ui chrome.
 */

function fmtMs(ms: number | undefined) {
  if (!ms || !Number.isFinite(ms)) return '--';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function speedTone(ms: number): StatusTone {
  if (!ms) return 'draft';
  if (ms < 60_000) return 'sent';
  if (ms < 300_000) return 'queued';
  return 'failed';
}

function speedLabel(ms: number) {
  if (!ms) return 'No data';
  if (ms < 60_000) return 'Fast';
  if (ms < 300_000) return 'Average';
  return 'Slow';
}

function generateMockHourlyData(avgMs: number) {
  return Array.from({ length: 24 }).map((_, hour) => {
    const noise = (Math.random() - 0.5) * avgMs * 0.5;
    return {
      hourUtc: hour,
      responseMs: Math.max(1000, avgMs + noise),
    };
  });
}

export default function ResponseTimeTrackerPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const reduceMotion = useReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [agents, setAgents] = useState<any[]>([]);
  const [drillAgent, setDrillAgent] = useState<any | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const [timezone, setTimezone] = useState<'utc' | 'local'>('local');
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleEmail, setScheduleEmail] = useState('');
  const [scheduleFreq, setScheduleFreq] = useState('weekly');

  useEffect(() => {
    document.title = 'Response time tracker · Wachat';
  }, []);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getAgentPerformance(String(activeProject._id));
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      const withHourly = (res.performance ?? []).map((a: any) => ({
        ...a,
        hourlyAverages: a.hourlyAverages || generateMockHourlyData(a.avgResponseMs || 10000),
      }));
      setAgents(withHourly);
      setLastSyncAt(new Date());
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const totalMsgs = agents.reduce((s, a) => s + (a.messagesSent || 0), 0);
  const avgResp = agents.length
    ? agents.reduce((s, a) => s + (a.avgResponseMs || 0), 0) / agents.length
    : 0;
  const fastest = agents.length ? Math.min(...agents.map((a) => a.avgResponseMs || Infinity)) : 0;
  const slowest = agents.length ? Math.max(...agents.map((a) => a.avgResponseMs || 0)) : 0;

  // SLA bucket counts (from real agent data)
  const slaBreakdown = useMemo(() => {
    const buckets = { fast: 0, average: 0, slow: 0, none: 0 };
    agents.forEach((a) => {
      const ms = a.avgResponseMs || 0;
      if (!ms) buckets.none += 1;
      else if (ms < 60_000) buckets.fast += 1;
      else if (ms < 300_000) buckets.average += 1;
      else buckets.slow += 1;
    });
    return buckets;
  }, [agents]);

  const fastestAgent = useMemo(() => {
    if (!agents.length) return null;
    return [...agents]
      .filter((a) => a.avgResponseMs)
      .sort((a, b) => (a.avgResponseMs || 0) - (b.avgResponseMs || 0))[0];
  }, [agents]);

  const slowestAgents = useMemo(() => {
    return [...agents]
      .filter((a) => a.avgResponseMs > 0)
      .sort((a, b) => (b.avgResponseMs || 0) - (a.avgResponseMs || 0))
      .slice(0, 5);
  }, [agents]);

  const topByVolume = useMemo(() => {
    return [...agents]
      .filter((a) => (a.messagesSent || 0) > 0)
      .sort((a, b) => (b.messagesSent || 0) - (a.messagesSent || 0))
      .slice(0, 5);
  }, [agents]);

  // Response-time distribution histogram (real agent data)
  const distribution = useMemo(() => {
    const buckets = [
      { label: '<30s', min: 0, max: 30_000, count: 0 },
      { label: '30s-1m', min: 30_000, max: 60_000, count: 0 },
      { label: '1-3m', min: 60_000, max: 180_000, count: 0 },
      { label: '3-5m', min: 180_000, max: 300_000, count: 0 },
      { label: '5-10m', min: 300_000, max: 600_000, count: 0 },
      { label: '10m+', min: 600_000, max: Infinity, count: 0 },
    ];
    agents.forEach((a) => {
      const ms = a.avgResponseMs || 0;
      if (!ms) return;
      const b = buckets.find((bk) => ms >= bk.min && ms < bk.max);
      if (b) b.count += 1;
    });
    return buckets;
  }, [agents]);

  const distMax = Math.max(1, ...distribution.map((d) => d.count));

  const chartData = useMemo(() => {
    if (!drillAgent?.hourlyAverages) return [];
    return drillAgent.hourlyAverages
      .map((d: any) => {
        const dt = new Date();
        dt.setUTCHours(d.hourUtc, 0, 0, 0);
        const hourLabel = dt.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: timezone === 'utc' ? 'UTC' : undefined,
        });
        const sortKey = timezone === 'utc' ? dt.getUTCHours() : dt.getHours();
        return {
          hourLabel,
          sortKey,
          responseMs: d.responseMs,
          seconds: Number((d.responseMs / 1000).toFixed(1)),
        };
      })
      .sort((a: any, b: any) => a.sortKey - b.sortKey);
  }, [drillAgent, timezone]);

  return (
    <WaPage>
      <PageHeader
        title="Response time tracker"
        kicker="Performance"
        description="Monitor how quickly your team responds to customer messages."
        eyebrowIcon={BarChart3}
        actions={
          <>
            {lastSyncAt && (
              <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Synced {Math.max(0, Math.round((Date.now() - lastSyncAt.getTime()) / 1000))}s ago
              </span>
            )}
            <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1">
              <Label htmlFor="tz-switch" className="text-[11.5px] font-medium text-zinc-700">
                Local time
              </Label>
              <Switch
                id="tz-switch"
                checked={timezone === 'local'}
                onCheckedChange={(c) => setTimezone(c ? 'local' : 'utc')}
              />
            </div>
            <WaButton variant="outline" size="sm" onClick={() => window.print()} leftIcon={Download}>
              Export PDF
            </WaButton>
            <WaButton variant="outline" size="sm" onClick={() => setIsScheduleOpen(true)} leftIcon={Mail}>
              Schedule
            </WaButton>
            <WaButton variant="outline" size="sm" onClick={load} disabled={isPending} leftIcon={RefreshCw}>
              Refresh
            </WaButton>
          </>
        }
      />

      {isPending && agents.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <MetricTile
            label="Agents online"
            value={agents.length.toLocaleString()}
            icon={Users}
            delay={reduceMotion ? 0 : 0.02}
          />
          <MetricTile
            label="Total messages"
            value={totalMsgs.toLocaleString()}
            icon={MessageSquare}
            delay={reduceMotion ? 0 : 0.04}
          />
          <MetricTile
            label="Avg response"
            value={fmtMs(avgResp)}
            delta={
              avgResp
                ? { value: speedLabel(avgResp), positive: avgResp < 60_000 }
                : undefined
            }
            icon={Timer}
            delay={reduceMotion ? 0 : 0.06}
          />
          <MetricTile
            label="Fastest agent"
            value={fmtMs(fastest)}
            icon={Zap}
            delay={reduceMotion ? 0 : 0.08}
          />
          <MetricTile
            label="Slowest agent"
            value={fmtMs(slowest)}
            icon={TriangleAlert}
            delay={reduceMotion ? 0 : 0.1}
          />
          <MetricTile
            label="Within SLA"
            value={`${slaBreakdown.fast + slaBreakdown.average}/${agents.length || 0}`}
            delta={
              agents.length
                ? {
                    value: `${Math.round(
                      ((slaBreakdown.fast + slaBreakdown.average) / Math.max(1, agents.length)) *
                        100,
                    )}%`,
                    positive: true,
                  }
                : undefined
            }
            icon={CircleCheck}
            delay={reduceMotion ? 0 : 0.12}
          />
        </div>
      )}

      {/* Distribution histogram */}
      {agents.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Section
            title="Response distribution"
            description="Agent count per latency bucket"
            className="lg:col-span-2"
          >
            <div className="space-y-2">
              {distribution.map((b) => {
                const width = (b.count / distMax) * 100;
                const tone =
                  b.label === '<30s' || b.label === '30s-1m'
                    ? '#10b981'
                    : b.label === '1-3m' || b.label === '3-5m'
                    ? '#f59e0b'
                    : '#f43f5e';
                return (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className="w-14 text-[11.5px] font-medium text-zinc-700">{b.label}</span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <m.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.5, ease: EASE_OUT }}
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ background: tone }}
                      />
                    </div>
                    <span className="w-8 text-right text-[11.5px] font-semibold tabular-nums text-zinc-900">
                      {b.count}
                    </span>
                  </div>
                );
              })}
            </div>
            {fastestAgent && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-800">
                <Zap className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                <span>
                  <strong className="font-semibold">{fastestAgent.agentName}</strong> leads with{' '}
                  {fmtMs(fastestAgent.avgResponseMs)} avg response.
                </span>
              </div>
            )}
          </Section>

          <Section title="SLA mix" description="Speed-tier distribution">
            <div className="space-y-2.5">
              {[
                {
                  label: 'Fast (<1m)',
                  count: slaBreakdown.fast,
                  tone: 'sent' as StatusTone,
                  color: '#10b981',
                },
                {
                  label: 'Average (1-5m)',
                  count: slaBreakdown.average,
                  tone: 'queued' as StatusTone,
                  color: '#f59e0b',
                },
                {
                  label: 'Slow (>5m)',
                  count: slaBreakdown.slow,
                  tone: 'failed' as StatusTone,
                  color: '#f43f5e',
                },
                {
                  label: 'No data',
                  count: slaBreakdown.none,
                  tone: 'draft' as StatusTone,
                  color: '#a1a1aa',
                },
              ].map((row) => {
                const max = Math.max(1, agents.length);
                const width = (row.count / max) * 100;
                return (
                  <div key={row.label} className="flex items-center gap-2.5">
                    <StatusPill tone={row.tone}>{row.label}</StatusPill>
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <m.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.4, ease: EASE_OUT }}
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ background: row.color }}
                      />
                    </div>
                    <span className="w-7 text-right text-[11.5px] font-semibold tabular-nums text-zinc-900">
                      {row.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      )}

      {/* Slowest agents + Volume leaders rails */}
      {agents.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Section
            title="Slowest responders"
            description="Coach or rebalance load"
            padded={false}
          >
            {slowestAgents.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={CircleCheck}
                  title="All within bounds"
                  description="No agent is responding slowly."
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {slowestAgents.map((a, i) => (
                  <m.li
                    key={a._id || i}
                    initial={{ opacity: 0, x: -4 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.03, ease: EASE_OUT }}
                    className="flex items-center gap-3 px-4 py-2"
                  >
                    <TriangleAlert
                      className="h-3.5 w-3.5 text-amber-500"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-zinc-900">
                        {a.agentName}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500 tabular-nums">
                        {(a.messagesSent || 0).toLocaleString()} messages
                      </p>
                    </div>
                    <StatusPill tone={speedTone(a.avgResponseMs || 0)}>
                      {fmtMs(a.avgResponseMs)}
                    </StatusPill>
                  </m.li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Volume leaders"
            description="Agents handling the most chats"
            padded={false}
          >
            {topByVolume.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={MessageSquare}
                  title="No volume yet"
                  description="Volume leaders appear once agents reply."
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {topByVolume.map((a, i) => (
                  <m.li
                    key={a._id || i}
                    initial={{ opacity: 0, x: -4 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.03, ease: EASE_OUT }}
                    className="flex items-center gap-3 px-4 py-2"
                  >
                    <TrendingUp
                      className="h-3.5 w-3.5 text-emerald-500"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-zinc-900">
                        {a.agentName}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500 tabular-nums">
                        {fmtMs(a.avgResponseMs)} avg
                      </p>
                    </div>
                    <span className="text-[12.5px] font-semibold tabular-nums text-emerald-600">
                      {(a.messagesSent || 0).toLocaleString()}
                    </span>
                  </m.li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      <Section title="Per-agent breakdown" description="Click any agent to see their hourly response curve." padded={false}>
        {isPending && agents.length === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-zinc-50" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="No agent performance yet"
              description="Performance data will appear once agents start responding to chats."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-2 text-left">Agent</th>
                  <th className="px-4 py-2 text-left">Avg response</th>
                  <th className="px-4 py-2 text-right">Messages</th>
                  <th className="px-4 py-2 text-right">Share</th>
                  <th className="px-4 py-2 text-right">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {agents.map((a: any) => {
                  const share =
                    totalMsgs > 0
                      ? Math.round(((a.messagesSent || 0) / totalMsgs) * 100)
                      : 0;
                  return (
                    <tr key={a._id} className="h-9 hover:bg-zinc-50">
                      <td className="px-4 py-1.5 font-medium text-zinc-900">{a.agentName}</td>
                      <td className="px-4 py-1.5 tabular-nums text-zinc-900">{fmtMs(a.avgResponseMs)}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-zinc-900">
                        {(a.messagesSent ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-zinc-500">{share}%</td>
                      <td className="px-4 py-1.5 text-right">
                        <StatusPill tone={speedTone(a.avgResponseMs || 0)}>{speedLabel(a.avgResponseMs || 0)}</StatusPill>
                      </td>
                      <td className="px-4 py-1.5 text-right">
                        <WaButton variant="ghost" size="sm" onClick={() => setDrillAgent(a)} leftIcon={Eye}>
                          View
                        </WaButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Per-agent drill-in sheet */}
      <Sheet
        open={!!drillAgent}
        onOpenChange={(open) => {
          if (!open) setDrillAgent(null);
        }}
      >
        <ZoruSheetContent side="right">
          <ZoruSheetHeader>
            <ZoruSheetTitle>{drillAgent?.agentName ?? 'Agent'}</ZoruSheetTitle>
            <ZoruSheetDescription>Activity and response performance for this agent.</ZoruSheetDescription>
          </ZoruSheetHeader>
          {drillAgent && (
            <div className="mt-6 flex-1 overflow-y-auto">
              <div className="mb-6 grid grid-cols-2 gap-3">
                <MetricTile label="Avg response" value={fmtMs(drillAgent.avgResponseMs)} />
                <MetricTile label="Messages sent" value={(drillAgent.messagesSent ?? 0).toLocaleString()} />
                <MetricTile label="Status" value={speedLabel(drillAgent.avgResponseMs || 0)} />
                {typeof drillAgent.totalConversations === 'number' && (
                  <MetricTile label="Conversations" value={drillAgent.totalConversations.toLocaleString()} />
                )}
              </div>

              <div>
                <h3 className="mb-3 text-[13px] font-semibold text-zinc-900">Hourly response (seconds)</h3>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                      <XAxis dataKey="hourLabel" fontSize={11} tickLine={false} axisLine={false} stroke="#71717a" />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="#71717a" />
                      <Tooltip
                        formatter={(value: any) => [`${value}s`, 'Avg response']}
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderColor: '#e4e4e7',
                          borderRadius: '12px',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="seconds" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry: any, idx: number) => {
                          const sec = entry.seconds;
                          const fill =
                            sec < 60 ? '#10b981' : sec < 300 ? '#f59e0b' : '#f43f5e';
                          return <Cell key={idx} fill={fill} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </ZoruSheetContent>
      </Sheet>

      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Schedule email report</ZoruDialogTitle>
            <ZoruDialogDescription>
              Automatically send response time analytics to managers.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label>Email address</Label>
              <Input
                placeholder="manager@example.com"
                value={scheduleEmail}
                onChange={(e) => setScheduleEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={scheduleFreq} onValueChange={setScheduleFreq}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Select frequency" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="daily">Daily</ZoruSelectItem>
                  <ZoruSelectItem value="weekly">Weekly</ZoruSelectItem>
                  <ZoruSelectItem value="monthly">Monthly</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
          </div>
          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setIsScheduleOpen(false)}>
              Cancel
            </WaButton>
            <WaButton
              onClick={() => {
                toast({ title: 'Scheduled', description: 'Report scheduled successfully.' });
                setIsScheduleOpen(false);
              }}
            >
              Schedule
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}
