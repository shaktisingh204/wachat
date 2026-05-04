'use client';

/**
 * Wachat Team Performance — agent performance metrics.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuUsers, LuRefreshCw } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { getAgentPerformance } from '@/app/actions/wachat-features.actions';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

export const dynamic = 'force-dynamic';

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
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [agents, setAgents] = useState<any[]>([]);

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getAgentPerformance(activeProjectId);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else {
        const sorted = (res.performance ?? []).sort(
          (a: any, b: any) => (b.messagesSent ?? 0) - (a.messagesSent ?? 0),
        );
        setAgents(sorted);
      }
    });
  }, [activeProjectId, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxMessages = Math.max(1, ...agents.map((a) => a.messagesSent ?? 0));

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/dashboard' },
          { label: activeProject?.name || 'Project', href: '/wachat' },
          { label: 'Team Performance' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
            Team Performance
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
            Agent activity over the last 30 days — messages sent and average response time.
          </p>
        </div>
        <ClayButton size="sm" variant="ghost" onClick={fetchData} disabled={isPending}>
          <LuRefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
          Refresh
        </ClayButton>
      </div>

      {agents.length > 0 ? (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Messages Sent</th>
                <th className="px-5 py-3">Avg Response Time</th>
                <th className="px-5 py-3 w-[40%]">Activity</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a._id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-[13px] font-medium text-foreground">{a.agentName}</td>
                  <td className="px-5 py-3 font-mono text-[13px] text-foreground tabular-nums">
                    {a.messagesSent ?? 0}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-muted-foreground">
                    {formatResponseTime(a.avgResponseMs)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="h-3 w-full rounded-full bg-muted">
                      <div
                        className="h-3 rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                        style={{ width: `${((a.messagesSent ?? 0) / maxMessages) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      ) : (
        !isPending && (
          <ClayCard className="p-12 text-center">
            <LuUsers className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No agent activity recorded yet.</p>
          </ClayCard>
        )
      )}
    </div>
  );
}
