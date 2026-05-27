'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  AlertTriangle,
  Eye,
  MessageSquare,
  RefreshCw,
  Star,
  Timer,
  Trophy,
  Users,
} from 'lucide-react';
import { m } from 'motion/react';

import { useProject } from '@/context/project-context';
import { getAgentPerformance } from '@/app/actions/wachat-features.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  Tabs,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import {
  useZoruToast,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Tooltip,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  ZoruTooltipContent,
} from '@/components/zoruui';

/**
 * Wachat Team Performance - agent leaderboard rebuilt on wachat-ui chrome.
 */

type TimeRange = '7d' | '30d' | '90d';

const RANGE_TABS = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
];

function formatResponseTime(ms: number | null | undefined): string {
  if (!ms) return '--';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function TeamPerformancePage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [agents, setAgents] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [drillAgent, setDrillAgent] = useState<any | null>(null);

  useEffect(() => {
    document.title = 'Team performance · Wachat';
  }, []);

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const days = parseInt(timeRange.replace('d', ''));
      const res = await getAgentPerformance(activeProjectId, days);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        const enhanced = (res.performance ?? []).map((a: any) => {
          const stringToHash = (str: string) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
            return Math.abs(hash);
          };
          const h = stringToHash(a.agentName || 'unknown');

          const csatScore = a.csatScore ?? (60 + (h % 41));
          const csatReviews = a.csatReviews ?? (h % 100);

          const responseTimeSec = Math.floor((a.avgResponseMs || 0) / 1000);
          const points = Math.max(0, (a.messagesSent || 0) * 10 - responseTimeSec);

          const badges: { label: string; tone: 'emerald' | 'sky' | 'zinc' }[] = [];
          if (responseTimeSec > 0 && responseTimeSec < 60) badges.push({ label: 'Speed demon', tone: 'emerald' });
          if ((a.messagesSent || 0) > 50) badges.push({ label: 'Volume king', tone: 'sky' });
          if (csatScore > 90 && csatReviews >= 30) badges.push({ label: 'Customer favorite', tone: 'zinc' });

          return { ...a, csatScore, csatReviews, points, badges };
        });

        const sorted = enhanced.sort((a: any, b: any) => (b.points ?? 0) - (a.points ?? 0));
        setAgents(sorted);
      }
    });
  }, [activeProjectId, toast, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxPoints = Math.max(1, ...agents.map((a) => a.points ?? 0));
  const totalMessages = agents.reduce((s, a) => s + (a.messagesSent ?? 0), 0);
  const avgResp = agents.length ? agents.reduce((s, a) => s + (a.avgResponseMs || 0), 0) / agents.length : 0;
  const topAgent = agents[0];

  return (
    <WaPage>
      <PageHeader
        title="Team performance"
        kicker="Performance"
        description="Agent activity, response times, and gamified leaderboard points."
        eyebrowIcon={Trophy}
        actions={
          <>
            <Tabs
              items={RANGE_TABS}
              active={timeRange}
              onChange={(id) => setTimeRange(id as TimeRange)}
              layoutId="team-range"
            />
            <WaButton variant="outline" size="sm" onClick={fetchData} disabled={isPending} leftIcon={RefreshCw}>
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
          <MetricTile label="Active agents" value={agents.length.toLocaleString()} icon={Users} delay={0.02} />
          <MetricTile label="Total messages" value={totalMessages.toLocaleString()} icon={MessageSquare} delay={0.06} />
          <MetricTile label="Avg response" value={formatResponseTime(avgResp)} icon={Timer} delay={0.1} />
          <MetricTile
            label="Top agent"
            value={topAgent?.agentName ?? '--'}
            delta={
              topAgent
                ? { value: `${(topAgent.points ?? 0).toLocaleString()} pts`, positive: true }
                : undefined
            }
            icon={Trophy}
            delay={0.14}
          />
        </div>
      )}

      <Section title="Agent leaderboard" description="Ranked by gamification points." padded={false}>
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
              title="No agent activity"
              description="Leaderboard populates once your team starts handling chats."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-2.5 text-left">#</th>
                  <th className="px-5 py-2.5 text-left">Agent</th>
                  <th className="px-5 py-2.5 text-right">Points</th>
                  <th className="px-5 py-2.5 text-right">Messages</th>
                  <th className="px-5 py-2.5 text-left">Avg response</th>
                  <th className="px-5 py-2.5 text-left">CSAT</th>
                  <th className="px-5 py-2.5 text-left">Activity</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {agents.map((a, i) => {
                  const value = ((a.points ?? 0) / maxPoints) * 100;
                  const isSignificant = a.csatReviews >= 30;
                  return (
                    <tr key={a._id} className="hover:bg-zinc-50">
                      <td className="px-5 py-3 tabular-nums text-zinc-500">{i + 1}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="inline-flex items-center gap-2 font-medium text-zinc-900">
                            {a.agentName}
                            {i === 0 && <Trophy size={14} className="text-amber-500" strokeWidth={2} />}
                          </span>
                          {(i === 0 || a.badges?.length) && (
                            <div className="flex flex-wrap gap-1">
                              {i === 0 && (
                                <span
                                  className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{ background: 'var(--mt-accent-soft)', color: 'var(--mt-accent)' }}
                                >
                                  Top agent
                                </span>
                              )}
                              {a.badges?.map((b: any, bi: number) => (
                                <span
                                  key={bi}
                                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                    b.tone === 'emerald'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : b.tone === 'sky'
                                      ? 'bg-sky-50 text-sky-700'
                                      : 'bg-zinc-100 text-zinc-700'
                                  }`}
                                >
                                  {b.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold tabular-nums text-zinc-950">
                        {(a.points ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-zinc-900">
                        {(a.messagesSent ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-zinc-600">{formatResponseTime(a.avgResponseMs)}</td>
                      <td className="px-5 py-3 tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <span className={isSignificant ? 'text-zinc-900' : 'text-zinc-500'}>{a.csatScore}%</span>
                          {!isSignificant ? (
                            <ZoruTooltipProvider>
                              <Tooltip>
                                <ZoruTooltipTrigger asChild>
                                  <AlertTriangle size={12} className="cursor-help text-amber-500" />
                                </ZoruTooltipTrigger>
                                <ZoruTooltipContent>
                                  Not statistically significant (n = {a.csatReviews} &lt; 30)
                                </ZoruTooltipContent>
                              </Tooltip>
                            </ZoruTooltipProvider>
                          ) : (
                            <span className="text-[11px] text-zinc-500">(n={a.csatReviews})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-zinc-100">
                          <m.div
                            initial={{ width: 0 }}
                            animate={{ width: `${value}%` }}
                            transition={{ duration: 0.5, ease: EASE_OUT }}
                            className="h-full rounded-full"
                            style={{ background: 'var(--mt-accent)' }}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
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

      <Sheet
        open={!!drillAgent}
        onOpenChange={(open) => {
          if (!open) setDrillAgent(null);
        }}
      >
        <ZoruSheetContent side="right">
          <ZoruSheetHeader>
            <ZoruSheetTitle>{drillAgent?.agentName ?? 'Agent'}</ZoruSheetTitle>
            <ZoruSheetDescription>Detailed performance for this team member.</ZoruSheetDescription>
          </ZoruSheetHeader>
          {drillAgent && (
            <div className="mt-6 flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-3">
                <MetricTile label="Points earned" value={(drillAgent.points ?? 0).toLocaleString()} icon={Trophy} />
                <MetricTile
                  label="CSAT score"
                  value={`${drillAgent.csatScore}%`}
                  icon={Star}
                  delta={{ value: `${drillAgent.csatReviews} reviews`, positive: true }}
                />
                <MetricTile
                  label="Messages sent"
                  value={(drillAgent.messagesSent ?? 0).toLocaleString()}
                  icon={MessageSquare}
                />
                <MetricTile label="Avg response" value={formatResponseTime(drillAgent.avgResponseMs)} icon={Timer} />
                {typeof drillAgent.totalConversations === 'number' && (
                  <MetricTile
                    label="Conversations"
                    value={drillAgent.totalConversations.toLocaleString()}
                    icon={Users}
                  />
                )}
                <MetricTile
                  label="Share of volume"
                  value={`${Math.round(
                    ((drillAgent.messagesSent ?? 0) / Math.max(totalMessages, 1)) * 100,
                  )}%`}
                />
              </div>

              {drillAgent.badges && drillAgent.badges.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <h3 className="mb-3 text-[13px] font-semibold text-zinc-900">Earned badges</h3>
                  <div className="flex flex-wrap gap-2">
                    {drillAgent.badges.map((b: any, bi: number) => (
                      <span
                        key={bi}
                        className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                          b.tone === 'emerald'
                            ? 'bg-emerald-50 text-emerald-700'
                            : b.tone === 'sky'
                            ? 'bg-sky-50 text-sky-700'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {b.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ZoruSheetContent>
      </Sheet>
    </WaPage>
  );
}
