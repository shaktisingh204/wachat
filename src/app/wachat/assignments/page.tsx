'use client';
import { fmtDate } from '@/lib/utils';

import {
  useZoruToast,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/zoruui';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { Inbox, UserPlus, RefreshCw, Loader2, Bot, Users } from 'lucide-react';
import { m } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getUnassignedConversations,
  assignConversation,
  getAgentStatuses,
  autoRouteConversations,
} from '@/app/actions/wachat-features.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  StatusPill,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

export default function AssignmentsPage() {
  const { activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [agentInputs, setAgentInputs] = useState<Record<string, string>>({});
  const [agents, setAgents] = useState<any[]>([]);

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getUnassignedConversations(activeProjectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        setContacts(res.contacts ?? []);
      }
      const agentRes = await getAgentStatuses(activeProjectId);
      if (!agentRes.error) {
        setAgents(agentRes.agents ?? []);
      }
    });
  }, [activeProjectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssign = (contactId: string) => {
    const agentId = agentInputs[contactId]?.trim();
    if (!agentId) {
      toast({ title: 'Error', description: 'Pick an agent first.', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const res = await assignConversation(contactId, agentId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        toast({ title: 'Assigned', description: 'Conversation assigned to agent.' });
        setAgentInputs((prev) => {
          const n = { ...prev };
          delete n[contactId];
          return n;
        });
        fetchData();
      }
    });
  };

  const handleAutoRoute = (strategy: 'round-robin' | 'skill-based') => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await autoRouteConversations(activeProjectId, strategy);
      if (res.error) {
        toast({ title: 'Routing error', description: res.error, variant: 'destructive' });
      } else {
        toast({ title: 'Routed', description: `Successfully routed ${res.count} conversations.` });
        fetchData();
      }
    });
  };

  const onlineAgents = agents.filter((a) => a.status === 'online').length;

  return (
    <WaPage>
      <PageHeader
        title="Conversation assignments"
        description="Assign unassigned conversations to agents for follow-up. Auto-route in one click."
        kicker="Wachat"
        eyebrowIcon={Users}
        backHref="/wachat"
        actions={
          <>
            <WaButton
              variant="outline"
              size="sm"
              leftIcon={Bot}
              onClick={() => handleAutoRoute('round-robin')}
              disabled={isPending || contacts.length === 0}
            >
              Auto-route
            </WaButton>
            <WaButton
              variant="ghost"
              size="sm"
              leftIcon={RefreshCw}
              onClick={fetchData}
              disabled={isPending}
              className={isPending ? '[&_svg]:animate-spin' : ''}
            >
              Refresh
            </WaButton>
          </>
        }
      />

      {/* Metrics */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:max-w-md">
        <MetricTile label="Unassigned" value={contacts.length} icon={Inbox} delay={0.02} />
        <MetricTile label="Agents online" value={onlineAgents} icon={Users} delay={0.06} />
      </div>

      {isPending && contacts.length === 0 ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="All caught up"
          description="Every conversation is currently assigned."
        />
      ) : (
        <Section title="Waiting for assignment" description="Pick an agent for each conversation.">
          <ul className="space-y-2">
            {contacts.map((c, i) => (
              <m.li
                key={c._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.02 + i * 0.03, ease: EASE_OUT }}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:bg-zinc-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-zinc-950">
                    {c.name || c.phone || 'Unknown'}
                  </div>
                  {c.phone && c.name && (
                    <div className="font-mono text-[11px] text-zinc-400">{c.phone}</div>
                  )}
                </div>
                <div className="hidden min-w-0 max-w-[260px] flex-1 truncate text-[12.5px] text-zinc-500 sm:block">
                  {c.lastMessage || c.lastMessagePreview || '--'}
                </div>
                <div className="whitespace-nowrap text-[11.5px] text-zinc-400">
                  {c.lastMessageTimestamp ? fmtDate(c.lastMessageTimestamp) : '--'}
                </div>
                <Select
                  value={agentInputs[c._id] || ''}
                  onValueChange={(val) => setAgentInputs((p) => ({ ...p, [c._id]: val }))}
                >
                  <SelectTrigger className="h-8 w-[180px] rounded-xl text-[12px]">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id || a._id} value={a.id || a._id}>
                        {a.name} ({a.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <WaButton
                  size="sm"
                  leftIcon={UserPlus}
                  onClick={() => handleAssign(c._id)}
                  disabled={isPending || !agentInputs[c._id]}
                >
                  Assign
                </WaButton>
              </m.li>
            ))}
          </ul>
        </Section>
      )}
    </WaPage>
  );
}
