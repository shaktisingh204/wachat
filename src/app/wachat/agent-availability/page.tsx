'use client';

/**
 * /wachat/agent-availability — View and toggle agent online/away/offline,
 * rebuilt on ZoruUI primitives.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { Users, Loader2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  getAgentStatuses,
  setAgentStatus,
} from '@/app/actions/wachat-features.actions';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruBadge,
  ZoruEmptyState,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  type ZoruBadgeProps,
} from '@/components/zoruui';

const STATUS_VARIANTS: Record<string, ZoruBadgeProps['variant']> = {
  online: 'success',
  away: 'warning',
  offline: 'secondary',
};

export default function AgentAvailabilityPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchAgents = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getAgentStatuses(pid);
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
          setAgents(res.agents || []);
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchAgents(projectId);
  }, [projectId, fetchAgents]);

  const cycleStatus = async (agent: any) => {
    const next =
      agent.status === 'online'
        ? 'away'
        : agent.status === 'away'
          ? 'offline'
          : 'online';
    setTogglingId(agent._id);
    const res = await setAgentStatus(agent._id, next);
    setTogglingId(null);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      setAgents((prev) =>
        prev.map((a) => (a._id === agent._id ? { ...a, status: next } : a)),
      );
      toast({
        title: 'Status Updated',
        description: `Agent is now ${next}.`,
      });
    }
  };

  const counts = { online: 0, away: 0, offline: 0 };
  agents.forEach((a) => {
    counts[a.status as keyof typeof counts] =
      (counts[a.status as keyof typeof counts] || 0) + 1;
  });

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
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
            <ZoruBreadcrumbPage>Agent Availability</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Agent Availability
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          View team status and manage agent availability.
        </p>
      </div>

      <div className="flex gap-4">
        {(['online', 'away', 'offline'] as const).map((s) => (
          <ZoruCard key={s} className="flex-1 p-4 text-center">
            <p className="text-[22px] text-zoru-ink">{counts[s]}</p>
            <p className="text-[11px] capitalize text-zoru-ink-muted">{s}</p>
          </ZoruCard>
        ))}
      </div>

      {isLoading && agents.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
        </div>
      ) : agents.length === 0 ? (
        <ZoruEmptyState
          icon={<Users />}
          title="No agents found"
          description="Once you add agents, their availability will appear here."
        />
      ) : (
        <ZoruCard className="overflow-x-auto p-0">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Agent</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Email</ZoruTableHead>
                <ZoruTableHead className="text-right">Action</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {agents.map((agent) => (
                <ZoruTableRow key={agent._id}>
                  <ZoruTableCell className="text-[13px] text-zoru-ink">
                    {agent.name || 'Agent'}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruBadge
                      variant={
                        STATUS_VARIANTS[agent.status] || 'secondary'
                      }
                    >
                      {agent.status || 'offline'}
                    </ZoruBadge>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                    {agent.email || '--'}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <ZoruButton
                      size="sm"
                      variant="ghost"
                      onClick={() => cycleStatus(agent)}
                      disabled={togglingId === agent._id}
                    >
                      {togglingId === agent._id
                        ? 'Updating...'
                        : 'Toggle Status'}
                    </ZoruButton>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </ZoruTable>
        </ZoruCard>
      )}
      <div className="h-6" />
    </div>
  );
}
