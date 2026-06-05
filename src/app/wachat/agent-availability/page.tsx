'use client';

import {
  useToast,
  Button,
  Card,
  Badge,
  EmptyState,
  StatCard,
  Spinner,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Users } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getAgentStatuses, setAgentStatus } from '@/app/actions/wachat-features.actions';
import WachatPage from '@/app/wachat/_components/wachat-page';

/**
 * /wachat/agent-availability — View and toggle agent online/away/offline,
 * rebuilt on 20ui primitives.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

const STATUS_TONES: Record<string, BadgeTone> = {
  online: 'success',
  away: 'warning',
  offline: 'neutral',
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
          toast({ title: 'Error', description: res.error, tone: 'danger' });
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
      toast({ title: 'Error', description: res.error, tone: 'danger' });
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Agent Availability' },
      ]}
      title="Agent Availability"
      description="View team status and manage agent availability."
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4">
          {(['online', 'away', 'offline'] as const).map((s) => (
            <StatCard
              key={s}
              label={s.charAt(0).toUpperCase() + s.slice(1)}
              value={counts[s]}
            />
          ))}
        </div>

        {isLoading && agents.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner label="Loading agents" />
          </div>
        ) : agents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No agents found"
            description="Once you add agents, their availability will appear here."
          />
        ) : (
          <Card variant="outlined" className="overflow-x-auto p-0">
            <Table>
              <THead>
                <Tr>
                  <Th>Agent</Th>
                  <Th>Status</Th>
                  <Th>Email</Th>
                  <Th align="right">Action</Th>
                </Tr>
              </THead>
              <TBody>
                {agents.map((agent) => (
                  <Tr key={agent._id}>
                    <Td className="[color:var(--st-text)]">
                      {agent.name || 'Agent'}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONES[agent.status] || 'neutral'}>
                        {agent.status || 'offline'}
                      </Badge>
                    </Td>
                    <Td className="[color:var(--st-text-secondary)]">
                      {agent.email || '--'}
                    </Td>
                    <Td align="right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cycleStatus(agent)}
                        disabled={togglingId === agent._id}
                      >
                        {togglingId === agent._id
                          ? 'Updating...'
                          : 'Toggle Status'}
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
      </div>
    </WachatPage>
  );
}
