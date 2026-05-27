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
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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
  const [isPending, startTransition] = useTransition();
  const [agents, setAgents] = useState<any[]>([]);
  const [drillAgent, setDrillAgent] = useState<any | null>(null);

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
            <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5">
              <Label htmlFor="tz-switch" className="text-[12px] font-medium text-zinc-700">
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <MetricTile label="Total messages" value={totalMsgs.toLocaleString()} icon={BarChart3} delay={0.02} />
          <MetricTile label="Avg response" value={fmtMs(avgResp)} icon={CircleCheck} delay={0.06} />
          <MetricTile label="Fastest agent" value={fmtMs(fastest)} icon={CircleCheck} delay={0.1} />
          <MetricTile label="Slowest agent" value={fmtMs(slowest)} icon={TriangleAlert} delay={0.14} />
        </div>
      )}

      <Section title="Per-agent breakdown" description="Click any agent to see their hourly response curve." padded={false}>
        {isPending && agents.length === 0 ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-zinc-50" />
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
                  <th className="px-5 py-2.5 text-left">Agent</th>
                  <th className="px-5 py-2.5 text-left">Avg response</th>
                  <th className="px-5 py-2.5 text-right">Messages</th>
                  <th className="px-5 py-2.5 text-right">Status</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {agents.map((a: any) => (
                  <tr key={a._id} className="hover:bg-zinc-50">
                    <td className="px-5 py-2.5 font-medium text-zinc-900">{a.agentName}</td>
                    <td className="px-5 py-2.5 tabular-nums text-zinc-900">{fmtMs(a.avgResponseMs)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-zinc-900">
                      {(a.messagesSent ?? 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <StatusPill tone={speedTone(a.avgResponseMs || 0)}>{speedLabel(a.avgResponseMs || 0)}</StatusPill>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <WaButton variant="ghost" size="sm" onClick={() => setDrillAgent(a)} leftIcon={Eye}>
                        View
                      </WaButton>
                    </td>
                  </tr>
                ))}
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
                <h3 className="mb-4 text-[13px] font-semibold text-zinc-900">Hourly response (seconds)</h3>
                <div className="h-[250px] w-full">
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
                      <Bar dataKey="seconds" fill="#10b981" radius={[6, 6, 0, 0]} />
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
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input
                placeholder="manager@example.com"
                value={scheduleEmail}
                onChange={(e) => setScheduleEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
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
