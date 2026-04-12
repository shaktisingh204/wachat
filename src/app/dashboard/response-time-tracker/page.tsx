'use client';

/**
 * Wachat Response Time Tracker — view response time metrics per agent.
 * Uses getAgentPerformance to pull real per-agent response data.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuChartBar, LuCircleCheck, LuCircleX, LuTriangleAlert, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { getAgentPerformance } from '@/app/actions/wachat-features.actions';

function fmtMs(ms: number | undefined) {
  if (!ms) return '--';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export default function ResponseTimeTrackerPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [agents, setAgents] = useState<any[]>([]);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getAgentPerformance(String(activeProject._id));
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setAgents(res.performance ?? []);
    });
  }, [activeProject?._id, toast]);

  useEffect(() => { load(); }, [load]);

  const totalMsgs = agents.reduce((s, a) => s + (a.messagesSent || 0), 0);
  const avgResp = agents.length
    ? agents.reduce((s, a) => s + (a.avgResponseMs || 0), 0) / agents.length
    : 0;
  const fastest = agents.length ? Math.min(...agents.map(a => a.avgResponseMs || Infinity)) : 0;
  const slowest = agents.length ? Math.max(...agents.map(a => a.avgResponseMs || 0)) : 0;

  const stats = [
    { label: 'Total Messages', value: totalMsgs.toString(), icon: LuChartBar, tone: 'blue' as const },
    { label: 'Avg Response', value: fmtMs(avgResp), icon: LuCircleCheck, tone: 'green' as const },
    { label: 'Fastest Agent', value: fmtMs(fastest), icon: LuCircleCheck, tone: 'amber' as const },
    { label: 'Slowest Agent', value: fmtMs(slowest), icon: LuTriangleAlert, tone: 'red' as const },
  ];

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Response Time Tracker' },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Response Time Tracker</h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">Monitor how quickly your team responds to customer messages.</p>
        </div>
        <ClayButton variant="pill" size="sm" onClick={load} disabled={isPending}>
          {isPending ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
        </ClayButton>
      </div>

      {isPending && agents.length === 0 ? (
        <div className="flex h-40 items-center justify-center gap-3">
          <LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" />
          <span className="text-[13px] text-clay-ink-muted">Loading performance data...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <ClayCard key={s.label} padded={false} className="flex items-center gap-4 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-clay-surface-2">
                  <s.icon className="h-5 w-5 text-clay-ink-muted" strokeWidth={1.75} />
                </span>
                <div>
                  <div className="text-[12px] text-clay-ink-muted">{s.label}</div>
                  <div className="text-[22px] font-semibold text-clay-ink leading-tight">{s.value}</div>
                </div>
              </ClayCard>
            ))}
          </div>

          <ClayCard padded={false} className="overflow-x-auto">
            <div className="px-5 py-4 border-b border-clay-border">
              <h2 className="text-[15px] font-semibold text-clay-ink">Per-Agent Breakdown</h2>
            </div>
            {agents.length === 0 ? (
              <div className="px-5 py-12 text-center text-[13px] text-clay-ink-muted">
                <LuCircleX className="mx-auto mb-3 h-8 w-8 text-clay-ink-muted/30" />
                No agent performance data found for this project yet.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                    <th className="px-5 py-3">Agent</th>
                    <th className="px-5 py-3">Avg Response</th>
                    <th className="px-5 py-3 text-right">Messages Sent</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a: any) => (
                    <tr key={a._id} className="border-b border-clay-border last:border-0">
                      <td className="px-5 py-3 font-medium text-[13px] text-clay-ink">{a.agentName}</td>
                      <td className="px-5 py-3 text-[13px] text-clay-ink tabular-nums">{fmtMs(a.avgResponseMs)}</td>
                      <td className="px-5 py-3 text-right text-[13px] text-clay-ink tabular-nums">{a.messagesSent}</td>
                      <td className="px-5 py-3 text-right">
                        <ClayBadge tone={(a.avgResponseMs || 0) < 60000 ? 'green' : (a.avgResponseMs || 0) < 300000 ? 'amber' : 'red'}>
                          {(a.avgResponseMs || 0) < 60000 ? 'Fast' : (a.avgResponseMs || 0) < 300000 ? 'Average' : 'Slow'}
                        </ClayBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ClayCard>
        </>
      )}
      <div className="h-6" />
    </div>
  );
}
