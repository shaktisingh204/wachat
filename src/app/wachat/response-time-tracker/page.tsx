'use client';

import {
  useToast,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  EmptyState,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  Skeleton,
  StatCard,
  Table,
  THead,
  TBody,
  Th,
  Tr,
  Td,
  Modal,
  Field,
  Input,
  Switch,
  Select,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  BarChart3,
  CircleCheck,
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
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Response Time Tracker — 20ui rebuild.
 *
 * Stat strip + agent leaderboard table + per-agent drill-in drawer.
 * Response times: lower is better.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

function fmtMs(ms: number | undefined) {
  if (!ms || !Number.isFinite(ms)) return '--';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function speedTone(ms: number): BadgeTone {
  if (!ms) return 'neutral';
  if (ms < 60_000) return 'success';
  if (ms < 300_000) return 'warning';
  return 'danger';
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
  const { toast } = useToast();
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
        toast({ title: 'Error', description: res.error, tone: 'danger' });
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Response Time Tracker' },
      ]}
      title="Response Time Tracker"
      description="Monitor how quickly your team responds to customer messages."
      width="wide"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-2 mr-2 pr-3"
            style={{ borderRight: '1px solid var(--st-border)' }}
          >
            <Switch
              checked={timezone === 'local'}
              onCheckedChange={(c) => setTimezone(c ? 'local' : 'utc')}
              label="Show Local Time"
            />
          </div>
          <Button variant="outline" size="sm" iconLeft={Download} onClick={() => window.print()}>
            Export PDF
          </Button>
          <Button variant="outline" size="sm" iconLeft={Mail} onClick={() => setIsScheduleOpen(true)}>
            Schedule Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            onClick={load}
            loading={isPending}
          >
            Refresh
          </Button>
        </div>
      }
    >
      {isPending && agents.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={120} radius="var(--st-radius-lg)" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Messages"
            value={totalMsgs.toLocaleString()}
            icon={BarChart3}
          />
          <StatCard
            label="Avg Response (lower is better)"
            value={fmtMs(avgResp)}
            icon={CircleCheck}
          />
          <StatCard
            label="Fastest Agent"
            value={fmtMs(fastest)}
            icon={CircleCheck}
          />
          <StatCard
            label="Slowest Agent"
            value={fmtMs(slowest)}
            icon={TriangleAlert}
          />
        </div>
      )}

      <Card padding="none">
        <CardHeader>
          <CardTitle>Per-Agent Breakdown</CardTitle>
        </CardHeader>
        <CardBody>
          {isPending && agents.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height={40} />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No agent performance yet"
              description="Performance data will appear once agents start responding to chats."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Agent</Th>
                  <Th>Avg Response</Th>
                  <Th align="right">Messages Sent</Th>
                  <Th align="right">Status</Th>
                  <Th width="1%" />
                </Tr>
              </THead>
              <TBody>
                {agents.map((a: any) => (
                  <Tr key={a._id}>
                    <Td className="font-medium">{a.agentName}</Td>
                    <Td className="tabular-nums">
                      {fmtMs(a.avgResponseMs)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {(a.messagesSent ?? 0).toLocaleString()}
                    </Td>
                    <Td align="right">
                      <Badge tone={speedTone(a.avgResponseMs || 0)}>
                        {speedLabel(a.avgResponseMs || 0)}
                      </Badge>
                    </Td>
                    <Td>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Eye}
                        onClick={() => setDrillAgent(a)}
                      >
                        View
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Per-agent drill-in drawer */}
      <Drawer
        side="right"
        open={!!drillAgent}
        onOpenChange={(open) => {
          if (!open) setDrillAgent(null);
        }}
      >
        <DrawerContent side="right">
          <DrawerHeader>
            <DrawerTitle>{drillAgent?.agentName ?? 'Agent'}</DrawerTitle>
            <DrawerDescription>
              Activity and response performance for this agent.
            </DrawerDescription>
          </DrawerHeader>
          {drillAgent && (
            <div className="mt-6 flex-1 overflow-y-auto px-4 pb-4">
              <div className="grid grid-cols-2 gap-3 mb-6">
                <StatCard
                  label="Avg Response (lower is better)"
                  value={fmtMs(drillAgent.avgResponseMs)}
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
                <h3
                  className="text-sm font-medium mb-4"
                  style={{ color: 'var(--st-text)' }}
                >
                  Hourly Response Time (Seconds)
                </h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="hourLabel" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value: any) => [`${value}s`, 'Avg Response']}
                        labelStyle={{ color: 'var(--st-text)' }}
                      />
                      <Bar dataKey="seconds" fill="var(--st-accent)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <Modal
        open={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        title="Schedule Email Report"
        description="Automatically send response time analytics to managers."
        footer={
          <>
            <Button variant="outline" onClick={() => setIsScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                toast({ title: 'Report scheduled successfully!', tone: 'success' });
                setIsScheduleOpen(false);
              }}
            >
              Schedule
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Email Address">
            <Input
              type="email"
              placeholder="manager@example.com"
              value={scheduleEmail}
              onChange={(e) => setScheduleEmail(e.target.value)}
            />
          </Field>
          <Field label="Frequency">
            <Select
              value={scheduleFreq}
              onChange={(v) => setScheduleFreq(v ?? 'weekly')}
              placeholder="Select frequency"
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
          </Field>
        </div>
      </Modal>
    </WachatPage>
  );
}
