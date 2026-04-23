'use client';

/**
 * Wachat Scheduled Messages — schedule future WhatsApp messages,
 * built on Clay primitives.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback, useActionState } from 'react';
import { LuClock, LuLoader, LuBan, LuSend } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  getScheduledMessages,
  scheduleMessage,
  cancelScheduledMessage,
} from '@/app/actions/wachat-features.actions';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    sent: 'bg-green-100 text-green-800',
    cancelled: 'bg-zinc-100 text-zinc-600',
    failed: 'bg-red-100 text-red-800',
  };
  return map[status] || 'bg-zinc-100 text-zinc-600';
}

export default function ScheduledMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [formState, formAction, isPending] = useActionState(scheduleMessage, null);

  const fetchMessages = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getScheduledMessages(pid);
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
          setMessages(res.messages || []);
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchMessages(projectId);
  }, [projectId, fetchMessages]);

  useEffect(() => {
    if (formState?.message) {
      toast({ title: 'Success', description: formState.message });
      if (projectId) fetchMessages(projectId);
    }
    if (formState?.error) {
      toast({ title: 'Error', description: formState.error, variant: 'destructive' });
    }
  }, [formState, toast, projectId, fetchMessages]);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    const res = await cancelScheduledMessage(id);
    setCancellingId(null);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      toast({ title: 'Cancelled', description: 'Scheduled message cancelled.' });
      if (projectId) fetchMessages(projectId);
    }
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Scheduled Messages' },
        ]}
      />

      <div className="min-w-0">
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
          Scheduled Messages
        </h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">
          Schedule WhatsApp messages to be sent at a future date and time.
        </p>
      </div>

      {/* Schedule form */}
      <ClayCard padded={false} className="p-6">
        <h2 className="text-[16px] font-semibold text-clay-ink mb-4">Schedule a message</h2>
        <form action={formAction} className="flex flex-col gap-4 max-w-lg">
          <input type="hidden" name="projectId" value={projectId || ''} />
          <Input name="recipientPhone" placeholder="Recipient phone (e.g. +919876543210)" required />
          <Textarea name="messageText" placeholder="Message text..." rows={3} required />
          <Input name="scheduledAt" type="datetime-local" required />
          <div>
            <ClayButton
              type="submit"
              variant="obsidian"
              size="md"
              disabled={isPending || !projectId}
              leading={<LuSend className="h-3.5 w-3.5" strokeWidth={2} />}
            >
              {isPending ? 'Scheduling...' : 'Schedule Message'}
            </ClayButton>
          </div>
        </form>
      </ClayCard>

      {/* Messages table */}
      <ClayCard padded={false} className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-[16px] font-semibold text-clay-ink">
            Messages ({messages.filter(m => statusFilter === 'all' || m.status === statusFilter).length})
          </h2>
          <div className="ml-auto flex gap-1">
            {(['all','pending','sent','cancelled','failed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-2.5 py-1 text-[11px] capitalize transition-colors ${statusFilter === s ? 'bg-clay-ink text-white' : 'bg-clay-surface-2 text-clay-ink-muted hover:bg-clay-bg-2'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {isLoading && messages.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" strokeWidth={1.75} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-clay-md border border-dashed border-clay-border bg-clay-surface-2 px-4 py-10 text-center">
            <LuClock className="h-5 w-5 text-clay-ink-muted" strokeWidth={1.5} />
            <div className="text-[13px] font-semibold text-clay-ink">No scheduled messages</div>
            <div className="text-[11.5px] text-clay-ink-muted">Schedule your first message above.</div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Scheduled Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.filter((m) => statusFilter === 'all' || m.status === statusFilter).map((msg) => (
                <TableRow key={msg._id}>
                  <TableCell className="font-medium text-[13px]">{msg.recipientPhone}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-[13px] text-clay-ink-muted">
                    {msg.messageText}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {new Date(msg.scheduledAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusBadge(msg.status)}>
                      {msg.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {msg.status === 'pending' && (
                      <ClayButton
                        variant="pill"
                        size="sm"
                        onClick={() => handleCancel(msg._id)}
                        disabled={cancellingId === msg._id}
                        leading={<LuBan className="h-3 w-3" strokeWidth={2} />}
                      >
                        {cancellingId === msg._id ? 'Cancelling...' : 'Cancel'}
                      </ClayButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ClayCard>

      <div className="h-6" />
    </div>
  );
}
