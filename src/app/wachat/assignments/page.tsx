'use client';

/**
 * Wachat Conversation Assignments — assign unassigned chats to agents.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuInbox, LuUserPlus, LuRefreshCw } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  getUnassignedConversations,
  assignConversation,
} from '@/app/actions/wachat-features.actions';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

export const dynamic = 'force-dynamic';

export default function AssignmentsPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [agentInputs, setAgentInputs] = useState<Record<string, string>>({});

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getUnassignedConversations(activeProjectId);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else setContacts(res.contacts ?? []);
    });
  }, [activeProjectId, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAssign = (contactId: string) => {
    const agentId = agentInputs[contactId]?.trim();
    if (!agentId) { toast({ title: 'Error', description: 'Enter an agent ID.', variant: 'destructive' }); return; }
    startTransition(async () => {
      const res = await assignConversation(contactId, agentId);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else {
        toast({ title: 'Assigned', description: 'Conversation assigned to agent.' });
        setAgentInputs((prev) => { const n = { ...prev }; delete n[contactId]; return n; });
        fetchData();
      }
    });
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/dashboard' },
          { label: activeProject?.name || 'Project', href: '/wachat' },
          { label: 'Assignments' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
            Conversation Assignments
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
            Assign unassigned conversations to agents for follow-up.
          </p>
        </div>
        <ClayButton size="sm" variant="ghost" onClick={fetchData} disabled={isPending}>
          <LuRefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
          Refresh
        </ClayButton>
      </div>

      {/* Stat */}
      <ClayCard className="p-5 w-fit">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Unassigned Conversations
        </div>
        <div className="mt-1 text-[28px] font-semibold text-foreground tabular-nums">
          {contacts.length}
        </div>
      </ClayCard>

      {contacts.length > 0 ? (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Last Message</th>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Assign</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c._id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3">
                    <div className="text-[13px] font-medium text-foreground">{c.name || c.phone || 'Unknown'}</div>
                    {c.phone && c.name && (
                      <div className="text-[11px] text-muted-foreground font-mono">{c.phone}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 max-w-[260px]">
                    <p className="truncate text-[13px] text-muted-foreground">
                      {c.lastMessage || c.lastMessagePreview || '--'}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                    {c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp).toLocaleString() : '--'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={agentInputs[c._id] || ''}
                        onChange={(e) => setAgentInputs((p) => ({ ...p, [c._id]: e.target.value }))}
                        placeholder="Agent ID"
                        className="w-[140px] rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                      />
                      <ClayButton size="sm" onClick={() => handleAssign(c._id)} disabled={isPending}>
                        <LuUserPlus className="mr-1 h-3.5 w-3.5" /> Assign
                      </ClayButton>
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
            <LuInbox className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">All conversations are assigned.</p>
          </ClayCard>
        )
      )}
    </div>
  );
}
