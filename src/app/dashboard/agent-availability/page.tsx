'use client';

/**
 * Wachat Agent Availability -- view and manage agent online/offline status.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuUsers, LuCircle, LuMessageSquare, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { getAgentStatuses, setAgentStatus } from '@/app/actions/wachat-features.actions';

const STATUS_TONES: Record<string, 'green' | 'amber' | 'neutral'> = {
  online: 'green', away: 'amber', offline: 'neutral',
};

export default function AgentAvailabilityPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchAgents = useCallback((pid: string) => {
    startLoading(async () => {
      const res = await getAgentStatuses(pid);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        setAgents(res.agents || []);
      }
    });
  }, [toast]);

  useEffect(() => { if (projectId) fetchAgents(projectId); }, [projectId, fetchAgents]);

  const cycleStatus = async (agent: any) => {
    const next = agent.status === 'online' ? 'away' : agent.status === 'away' ? 'offline' : 'online';
    setTogglingId(agent._id);
    const res = await setAgentStatus(agent._id, next);
    setTogglingId(null);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      setAgents((prev) => prev.map((a) => a._id === agent._id ? { ...a, status: next } : a));
      toast({ title: 'Status Updated', description: `Agent is now ${next}.` });
    }
  };

  const counts = { online: 0, away: 0, offline: 0 };
  agents.forEach((a) => { counts[a.status as keyof typeof counts] = (counts[a.status as keyof typeof counts] || 0) + 1; });

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Agent Availability' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Agent Availability</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">View team status and manage agent availability.</p>
      </div>

      <div className="flex gap-4">
        {(['online', 'away', 'offline'] as const).map((s) => (
          <ClayCard key={s} padded={false} className="flex-1 p-4 text-center">
            <p className="text-[22px] font-semibold text-foreground">{counts[s]}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{s}</p>
          </ClayCard>
        ))}
      </div>

      {isLoading && agents.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <LuLoader className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : agents.length === 0 ? (
        <ClayCard className="p-12 text-center">
          <LuUsers className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">No agents found.</p>
        </ClayCard>
      ) : (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent._id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-[13px] font-medium text-foreground">{agent.name || 'Agent'}</td>
                  <td className="px-5 py-3">
                    <ClayBadge tone={STATUS_TONES[agent.status] || 'neutral'}>{agent.status || 'offline'}</ClayBadge>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-muted-foreground">{agent.email || '--'}</td>
                  <td className="px-5 py-3 text-right">
                    <ClayButton size="sm" variant="ghost" onClick={() => cycleStatus(agent)} disabled={togglingId === agent._id}>
                      {togglingId === agent._id ? 'Updating...' : 'Toggle Status'}
                    </ClayButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
