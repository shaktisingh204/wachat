'use client';

/**
 * /wachat/assignments — Assign unassigned conversations to agents,
 * rebuilt on ZoruUI primitives.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { Inbox, UserPlus, RefreshCw, Loader2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useZoruToast } from '@/components/zoruui';
import {
  getUnassignedConversations,
  assignConversation,
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
  ZoruInput,
  ZoruEmptyState,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';

export const dynamic = 'force-dynamic';

export default function AssignmentsPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [agentInputs, setAgentInputs] = useState<Record<string, string>>({});

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getUnassignedConversations(activeProjectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        setContacts(res.contacts ?? []);
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
        variant: 'destructive',
      });
      return;
    }
    startTransition(async () => {
      const res = await assignConversation(contactId, agentId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
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
            <ZoruBreadcrumbPage>Assignments</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Conversation Assignments
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-zoru-ink-muted">
            Assign unassigned conversations to agents for follow-up.
          </p>
        </div>
        <ZoruButton
          size="sm"
          variant="ghost"
          onClick={fetchData}
          disabled={isPending}
        >
          <RefreshCw className={isPending ? 'animate-spin' : ''} />
          Refresh
        </ZoruButton>
      </div>

      <ZoruCard className="w-fit p-5">
        <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
          Unassigned Conversations
        </div>
        <div className="mt-1 text-[28px] tabular-nums text-zoru-ink">
          {contacts.length}
        </div>
      </ZoruCard>

      {isPending && contacts.length === 0 && (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
        </div>
      )}

      {contacts.length > 0 ? (
        <ZoruCard className="overflow-x-auto p-0">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Contact</ZoruTableHead>
                <ZoruTableHead>Last Message</ZoruTableHead>
                <ZoruTableHead>Time</ZoruTableHead>
                <ZoruTableHead>Assign</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {contacts.map((c) => (
                <ZoruTableRow key={c._id}>
                  <ZoruTableCell>
                    <div className="text-[13px] text-zoru-ink">
                      {c.name || c.phone || 'Unknown'}
                    </div>
                    {c.phone && c.name && (
                      <div className="font-mono text-[11px] text-zoru-ink-muted">
                        {c.phone}
                      </div>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="max-w-[260px]">
                    <p className="truncate text-[13px] text-zoru-ink-muted">
                      {c.lastMessage || c.lastMessagePreview || '--'}
                    </p>
                  </ZoruTableCell>
                  <ZoruTableCell className="whitespace-nowrap text-[12px] text-zoru-ink-muted">
                    {c.lastMessageTimestamp
                      ? new Date(c.lastMessageTimestamp).toLocaleString()
                      : '--'}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <div className="flex items-center gap-2">
                      <ZoruInput
                        value={agentInputs[c._id] || ''}
                        onChange={(e) =>
                          setAgentInputs((p) => ({
                            ...p,
                            [c._id]: e.target.value,
                          }))
                        }
                        placeholder="Agent ID"
                        className="h-8 w-[140px] text-xs"
                      />
                      <ZoruButton
                        size="sm"
                        onClick={() => handleAssign(c._id)}
                        disabled={isPending}
                      >
                        <UserPlus /> Assign
                      </ZoruButton>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </ZoruTable>
        </ZoruCard>
      ) : (
        !isPending && (
          <ZoruEmptyState
            icon={<Inbox />}
            title="All caught up"
            description="All conversations are currently assigned."
          />
        )
      )}
      <div className="h-6" />
    </div>
  );
}
