'use client';

/**
 * Wachat Agent Availability — view and manage agent online/offline status.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuUsers, LuCircle, LuMessageSquare } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';

type Status = 'online' | 'away' | 'offline';

interface Agent {
  id: string;
  name: string;
  email: string;
  status: Status;
  chats: number;
  lastActive: string;
  isMe?: boolean;
}

const INITIAL_AGENTS: Agent[] = [
  { id: '1', name: 'You', email: 'me@company.com', status: 'online', chats: 5, lastActive: 'Now', isMe: true },
  { id: '2', name: 'Priya Sharma', email: 'priya@company.com', status: 'online', chats: 3, lastActive: '2 min ago' },
  { id: '3', name: 'Alex Johnson', email: 'alex@company.com', status: 'away', chats: 1, lastActive: '15 min ago' },
  { id: '4', name: 'Maria Garcia', email: 'maria@company.com', status: 'offline', chats: 0, lastActive: '2 hours ago' },
  { id: '5', name: 'Sam Wilson', email: 'sam@company.com', status: 'offline', chats: 0, lastActive: 'Yesterday' },
];

const STATUS_CONFIG: Record<Status, { label: string; color: string; dot: string }> = {
  online:  { label: 'Online',  color: 'bg-green-100 text-green-700', dot: 'text-green-500' },
  away:    { label: 'Away',    color: 'bg-amber-100 text-amber-700', dot: 'text-amber-500' },
  offline: { label: 'Offline', color: 'bg-zinc-100 text-zinc-500',   dot: 'text-zinc-400' },
};

export default function AgentAvailabilityPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);

  const cycleStatus = () => {
    setAgents((prev) =>
      prev.map((a) => {
        if (!a.isMe) return a;
        const next: Status = a.status === 'online' ? 'away' : a.status === 'away' ? 'offline' : 'online';
        toast({ title: 'Status Updated', description: `You are now ${next}.` });
        return { ...a, status: next };
      }),
    );
  };

  const onlineCount = agents.filter((a) => a.status === 'online').length;
  const awayCount = agents.filter((a) => a.status === 'away').length;

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Agent Availability' },
        ]}
      />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
          Agent Availability
        </h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">
          View team status and manage your availability.
        </p>
      </div>

      {/* Summary */}
      <div className="flex gap-4">
        <ClayCard padded={false} className="flex-1 p-4 text-center">
          <p className="text-[22px] font-semibold text-green-600">{onlineCount}</p>
          <p className="text-[11px] text-clay-ink-muted">Online</p>
        </ClayCard>
        <ClayCard padded={false} className="flex-1 p-4 text-center">
          <p className="text-[22px] font-semibold text-amber-600">{awayCount}</p>
          <p className="text-[11px] text-clay-ink-muted">Away</p>
        </ClayCard>
        <ClayCard padded={false} className="flex-1 p-4 text-center">
          <p className="text-[22px] font-semibold text-zinc-400">{agents.length - onlineCount - awayCount}</p>
          <p className="text-[11px] text-clay-ink-muted">Offline</p>
        </ClayCard>
      </div>

      {/* Agents table */}
      <ClayCard padded={false} className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
              <th className="px-5 py-3">Agent</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Active Chats</th>
              <th className="px-5 py-3">Last Active</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => {
              const cfg = STATUS_CONFIG[agent.status];
              return (
                <tr key={agent.id} className="border-b border-clay-border last:border-0">
                  <td className="px-5 py-3">
                    <div className="text-[13px] font-medium text-clay-ink">{agent.name}</div>
                    <div className="text-[11px] text-clay-ink-muted">{agent.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cfg.color}`}>
                      <LuCircle className={`h-2 w-2 fill-current ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-clay-ink">
                    <LuMessageSquare className="inline mr-1 h-3.5 w-3.5 text-clay-ink-muted" />{agent.chats}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-clay-ink-muted">{agent.lastActive}</td>
                  <td className="px-5 py-3 text-right">
                    {agent.isMe && (
                      <ClayButton size="sm" variant="ghost" onClick={cycleStatus}>
                        Change Status
                      </ClayButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
