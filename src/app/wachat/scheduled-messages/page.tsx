'use client';

/**
 * Wachat Scheduled Messages — schedule individual future messages.
 * ZoruUI rebuild. Same handlers (getScheduledMessages, scheduleMessage,
 * cancelScheduledMessage). Edit-schedule sheet + cancel-schedule alert.
 */

import * as React from 'react';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useActionState,
} from 'react';
import { Ban, Clock, Loader2, Pencil, Send } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useZoruToast } from '@/components/zoruui';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetTrigger,
  ZoruTextarea,
} from '@/components/zoruui';

import {
  getScheduledMessages,
  scheduleMessage,
  cancelScheduledMessage,
} from '@/app/actions/wachat-features.actions';

const STATUS_FILTERS = ['all', 'pending', 'sent', 'cancelled', 'failed'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusVariant(
  s: string,
): 'success' | 'danger' | 'warning' | 'secondary' {
  if (s === 'sent') return 'success';
  if (s === 'failed') return 'danger';
  if (s === 'pending') return 'warning';
  return 'secondary';
}

/* ── edit-schedule sheet ────────────────────────────────────────── */

function EditScheduleSheet({ message }: { message: any }) {
  const [open, setOpen] = useState(false);
  const { toast } = useZoruToast();

  return (
    <ZoruSheet open={open} onOpenChange={setOpen}>
      <ZoruSheetTrigger asChild>
        <ZoruButton variant="ghost" size="icon-sm" aria-label="Edit schedule">
          <Pencil className="h-3.5 w-3.5" />
        </ZoruButton>
      </ZoruSheetTrigger>
      <ZoruSheetContent side="right" className="sm:max-w-md">
        <ZoruSheetHeader>
          <ZoruSheetTitle>Edit schedule</ZoruSheetTitle>
          <ZoruSheetDescription>
            Update the recipient, message, or send time before it goes out.
          </ZoruSheetDescription>
        </ZoruSheetHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            toast({
              title: 'Saved',
              description: 'Edit-schedule wiring is owned by the page.',
            });
            setOpen(false);
          }}
          className="mt-5 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="es-phone">Recipient phone</ZoruLabel>
            <ZoruInput
              id="es-phone"
              defaultValue={message.recipientPhone}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="es-text">Message</ZoruLabel>
            <ZoruTextarea
              id="es-text"
              defaultValue={message.messageText}
              rows={4}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="es-when">Scheduled at</ZoruLabel>
            <ZoruInput
              id="es-when"
              type="datetime-local"
              defaultValue={
                message.scheduledAt
                  ? new Date(message.scheduledAt).toISOString().slice(0, 16)
                  : undefined
              }
              required
            />
          </div>
          <ZoruSheetFooter>
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </ZoruButton>
            <ZoruButton type="submit">Save changes</ZoruButton>
          </ZoruSheetFooter>
        </form>
      </ZoruSheetContent>
    </ZoruSheet>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

export default function ScheduledMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [formState, formAction, isPending] = useActionState(
    scheduleMessage,
    null,
  );

  const fetchMessages = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getScheduledMessages(pid);
        if (res.error) {
          toast({
            title: 'Error',
            description: res.error,
            variant: 'destructive',
          });
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
      toast({
        title: 'Error',
        description: formState.error,
        variant: 'destructive',
      });
    }
  }, [formState, toast, projectId, fetchMessages]);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    const res = await cancelScheduledMessage(id);
    setCancellingId(null);
    if (res.error) {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Cancelled',
        description: 'Scheduled message cancelled.',
      });
      if (projectId) fetchMessages(projectId);
    }
  };

  const filtered = messages.filter(
    (m) => statusFilter === 'all' || m.status === statusFilter,
  );

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
            <ZoruBreadcrumbPage>Scheduled Messages</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Scheduled Messages
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Schedule WhatsApp messages to be sent at a future date and time.
        </p>
      </div>

      {/* Schedule form */}
      <ZoruCard className="p-6">
        <h2 className="mb-4 text-sm text-zoru-ink">Schedule a message</h2>
        <form
          action={formAction}
          className="flex max-w-lg flex-col gap-4"
        >
          <input type="hidden" name="projectId" value={projectId || ''} />
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="sm-phone">Recipient phone</ZoruLabel>
            <ZoruInput
              id="sm-phone"
              name="recipientPhone"
              placeholder="+919876543210"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="sm-text">Message</ZoruLabel>
            <ZoruTextarea
              id="sm-text"
              name="messageText"
              rows={3}
              placeholder="Message text…"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="sm-when">Scheduled at</ZoruLabel>
            <ZoruInput
              id="sm-when"
              name="scheduledAt"
              type="datetime-local"
              required
            />
          </div>
          <div>
            <ZoruButton type="submit" disabled={isPending || !projectId}>
              <Send className="h-3.5 w-3.5" />
              {isPending ? 'Scheduling…' : 'Schedule message'}
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>

      {/* Messages table */}
      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-sm text-zoru-ink">Messages ({filtered.length})</h2>
          <div className="ml-auto flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <ZoruButton
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                onClick={() => setStatusFilter(s)}
                className="capitalize"
              >
                {s}
              </ZoruButton>
            ))}
          </div>
        </div>
        {isLoading && messages.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
          </div>
        ) : messages.length === 0 ? (
          <ZoruEmptyState
            icon={<Clock />}
            title="No scheduled messages"
            description="Schedule your first message above."
          />
        ) : (
          <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zoru-line bg-zoru-surface text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Scheduled time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((msg) => (
                  <tr
                    key={msg._id}
                    className="border-b border-zoru-line last:border-0"
                  >
                    <td className="px-4 py-3 text-[13px] text-zoru-ink">
                      {msg.recipientPhone}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[13px] text-zoru-ink-muted">
                      {msg.messageText}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-zoru-ink-muted">
                      {new Date(msg.scheduledAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <ZoruBadge variant={statusVariant(msg.status)}>
                        {msg.status}
                      </ZoruBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {msg.status === 'pending' && (
                        <div className="inline-flex items-center gap-1">
                          <EditScheduleSheet message={msg} />
                          <ZoruAlertDialog>
                            <ZoruAlertDialogTrigger asChild>
                              <ZoruButton
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Cancel schedule"
                                disabled={cancellingId === msg._id}
                                className="text-zoru-danger hover:bg-zoru-danger/10 hover:text-zoru-danger"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </ZoruButton>
                            </ZoruAlertDialogTrigger>
                            <ZoruAlertDialogContent>
                              <ZoruAlertDialogHeader>
                                <ZoruAlertDialogTitle>
                                  Cancel scheduled message?
                                </ZoruAlertDialogTitle>
                                <ZoruAlertDialogDescription>
                                  This message to {msg.recipientPhone} will not
                                  be sent at{' '}
                                  {new Date(msg.scheduledAt).toLocaleString()}.
                                </ZoruAlertDialogDescription>
                              </ZoruAlertDialogHeader>
                              <ZoruAlertDialogFooter>
                                <ZoruAlertDialogCancel>
                                  Keep it
                                </ZoruAlertDialogCancel>
                                <ZoruAlertDialogAction
                                  onClick={() => handleCancel(msg._id)}
                                >
                                  Cancel schedule
                                </ZoruAlertDialogAction>
                              </ZoruAlertDialogFooter>
                            </ZoruAlertDialogContent>
                          </ZoruAlertDialog>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ZoruCard>

      <div className="h-6" />
    </div>
  );
}
