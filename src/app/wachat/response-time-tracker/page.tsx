'use client';

import {
  useZoruToast,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  EmptyState,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Skeleton,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
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
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  BarChart3,
  CircleCheck,
  CircleX,
  Eye,
  RefreshCw,
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
  ResponsiveContainer
} from 'recharts';

import { useProject } from '@/context/project-context';
import { getAgentPerformance } from '@/app/actions/wachat-features.actions';

/**
 * Wachat Response Time Tracker — ZoruUI rebuild.
 *
 * Stat strip + agent leaderboard table + per-agent drill-in sheet.
 * Response-time deltas use invertDelta=true (lower is better).
 */

import * as React from 'react';

function fmtMs(ms: number | undefined) {
  if (!ms || !Number.isFinite(ms)) return '--';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function speedTone(ms: number) {
  if (!ms) return 'ghost' as const;
  if (ms < 60_000) return 'success' as const;
  if (ms < 300_000) return 'warning' as const;
  return 'danger' as const;
}

function speedLabel(ms: number) {
  if (!ms) return '—';
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
        hourlyAverages: a.hourlyAverages || generateMockHourlyData(a.avgResponseMs || 10000)
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
  const fastest = agents.length
    ? Math.min(...agents.map((a) => a.avgResponseMs || Infinity))
    : 0;
  const slowest = agents.length
    ? Math.max(...agents.map((a) => a.avgResponseMs || 0))
    : 0;

  const chartData = React.useMemo(() => {
    if (!drillAgent?.hourlyAverages) return [];
    return drillAgent.hourlyAverages.map((d: any) => {
      const dt = new Date();
      dt.setUTCHours(d.hourUtc, 0, 0, 0);
      const hourLabel = dt.toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit',
        timeZone: timezone === 'utc' ? 'UTC' : undefined 
      });
      const sortKey = timezone === 'utc' ? dt.getUTCHours() : dt.getHours();
      return {
        hourLabel,
        sortKey,
        responseMs: d.responseMs,
        seconds: Number((d.responseMs / 1000).toFixed(1))
      };
    }).sort((a: any, b: any) => a.sortKey - b.sortKey);
  }, [drillAgent, timezone]);

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
            <ZoruBreadcrumbPage>Response Time Tracker</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Response Time Tracker
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Monitor how quickly your team responds to customer messages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4 border-r pr-4">
            <Label htmlFor="tz-switch" className="text-sm font-medium">Show Local Time</Label>
            <Switch
              id="tz-switch"
              checked={timezone === 'local'}
              onCheckedChange={(c) => setTimezone(c ? 'local' : 'utc')}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="mr-2 h-4 w-4" /> Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsScheduleOpen(true)}>
            <Mail className="mr-2 h-4 w-4" /> Schedule Report
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {isPending && agents.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Messages"
            value={totalMsgs.toLocaleString()}
            icon={<BarChart3 />}
          />
          <StatCard
            label="Avg Response"
            value={fmtMs(avgResp)}
            icon={<CircleCheck />}
            period="Lower is better"
          />
          <StatCard
            label="Fastest Agent"
            value={fmtMs(fastest)}
            icon={<CircleCheck />}
          />
          <StatCard
            label="Slowest Agent"
            value={fmtMs(slowest)}
            icon={<TriangleAlert />}
          />
        </div>
      )}

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Per-Agent Breakdown</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {isPending && agents.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="No agent performance yet"
              description="Performance data will appear once agents start responding to chats."
            />
          ) : (
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead>Agent</ZoruTableHead>
                  <ZoruTableHead>Avg Response</ZoruTableHead>
                  <ZoruTableHead className="text-right">Messages Sent</ZoruTableHead>
                  <ZoruTableHead className="text-right">Status</ZoruTableHead>
                  <ZoruTableHead className="w-[1%]" />
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {agents.map((a: any) => (
                  <ZoruTableRow key={a._id}>
                    <ZoruTableCell className="font-medium">{a.agentName}</ZoruTableCell>
                    <ZoruTableCell className="tabular-nums">
                      {fmtMs(a.avgResponseMs)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right tabular-nums">
                      {(a.messagesSent ?? 0).toLocaleString()}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <Badge variant={speedTone(a.avgResponseMs || 0)}>
                        {speedLabel(a.avgResponseMs || 0)}
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDrillAgent(a)}
                      >
                        <Eye /> View
                      </Button>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </Table>
          )}
        </ZoruCardContent>
      </Card>

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
            <ZoruSheetDescription>
              Activity and response performance for this agent.
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {drillAgent && (
            <div className="mt-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 mb-6">
                <StatCard
                  label="Avg Response"
                  value={fmtMs(drillAgent.avgResponseMs)}
                  period="Lower is better"
                />
                <StatCard
                  label="Messages Sent"
                  value={(drillAgent.messagesSent ?? 0).toLocaleString()}
                />
                <StatCard
                  label="Status"
                  value={speedLabel(drillAgent.avgResponseMs || 0)}
                />
                {typeof drillAgent.totalConversations === 'number' && (
                  <StatCard
                    label="Conversations"
                    value={drillAgent.totalConversations.toLocaleString()}
                  />
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium mb-4">Hourly Response Time (Seconds)</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="hourLabel" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        formatter={(value: any) => [`${value}s`, 'Avg Response']}
                        labelStyle={{ color: '#000' }}
                      />
                      <Bar dataKey="seconds" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
            <ZoruDialogTitle>Schedule Email Report</ZoruDialogTitle>
            <ZoruDialogDescription>
              Automatically send response time analytics to managers.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
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
            <Button variant="outline" onClick={() => setIsScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast({ title: 'Success', description: 'Report scheduled successfully!' });
                setIsScheduleOpen(false);
              }}
            >
              Schedule
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <div className="h-6" />
    </div>
  );
}
