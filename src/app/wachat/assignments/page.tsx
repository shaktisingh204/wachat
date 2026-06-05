'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  Button,
  Card,
  EmptyState,
  Table,
  THead,
  TBody,
  Th,
  Tr,
  Td,
  Select,
  StatCard,
  Spinner,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Inbox,
  UserPlus,
  RefreshCw,
  Bot } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getUnassignedConversations, assignConversation, getAgentStatuses, autoRouteConversations } from '@/app/actions/wachat-features.actions';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * /wachat/assignments — Assign unassigned conversations to agents,
 * rebuilt on 20ui primitives.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

export default function AssignmentsPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [agentInputs, setAgentInputs] = useState<Record<string, string>>({});
  const [agents, setAgents] = useState<any[]>([]);

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getUnassignedConversations(activeProjectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
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
      toast({
        title: 'Error',
        description: 'Enter an agent ID.',
        tone: 'danger',
      });
      return;
    }
    startTransition(async () => {
      const res = await assignConversation(contactId, agentId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
      } else {
        toast({
          title: 'Assigned',
          description: 'Conversation assigned to agent.',
        });
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
        toast({ title: 'Routing Error', description: res.error, tone: 'danger' });
      } else {
        toast({ title: 'Routed', description: `Successfully routed ${res.count} conversations.` });
        fetchData();
      }
    });
  };

  const agentOptions = agents.map((a) => ({
    value: (a.id || a._id) as string,
    label: `${a.name} (${a.status})`,
  }));

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Assignments' },
      ]}
      title="Conversation Assignments"
      description="Assign unassigned conversations to agents for follow-up."
      actions={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            iconLeft={Bot}
            onClick={() => handleAutoRoute('round-robin')}
            disabled={isPending || contacts.length === 0}
          >
            Auto-Route
          </Button>
          <Button
            size="sm"
            variant="ghost"
            iconLeft={RefreshCw}
            onClick={fetchData}
            disabled={isPending}
          >
            Refresh
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <StatCard
          className="w-fit"
          label="Unassigned Conversations"
          value={contacts.length}
        />

        {isPending && contacts.length === 0 && (
          <div className="flex h-20 items-center justify-center">
            <Spinner />
          </div>
        )}

        {contacts.length > 0 ? (
          <Card variant="outlined" padding="none" className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>Contact</Th>
                  <Th>Last Message</Th>
                  <Th>Time</Th>
                  <Th>Assign</Th>
                </Tr>
              </THead>
              <TBody>
                {contacts.map((c) => (
                  <Tr key={c._id}>
                    <Td>
                      <div className="[color:var(--st-text)]">
                        {c.name || c.phone || 'Unknown'}
                      </div>
                      {c.phone && c.name && (
                        <div className="font-mono text-[11px] [color:var(--st-text-tertiary)]">
                          {c.phone}
                        </div>
                      )}
                    </Td>
                    <Td className="max-w-[260px]">
                      <p className="truncate [color:var(--st-text-secondary)]">
                        {c.lastMessage || c.lastMessagePreview || '--'}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap [color:var(--st-text-secondary)]">
                      {c.lastMessageTimestamp
                        ? fmtDate(c.lastMessageTimestamp)
                        : '--'}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Select
                          size="sm"
                          className="w-[160px]"
                          aria-label="Select agent"
                          placeholder="Select Agent"
                          value={agentInputs[c._id] || null}
                          options={agentOptions}
                          onChange={(val) =>
                            setAgentInputs((p) => ({
                              ...p,
                              [c._id]: val ?? '',
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="primary"
                          iconLeft={UserPlus}
                          onClick={() => handleAssign(c._id)}
                          disabled={isPending || !agentInputs[c._id]}
                        >
                          Assign
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </Card>
        ) : (
          !isPending && (
            <EmptyState
              icon={Inbox}
              title="All caught up"
              description="All conversations are currently assigned."
            />
          )
        )}
      </div>
    </WachatPage>
  );
}
