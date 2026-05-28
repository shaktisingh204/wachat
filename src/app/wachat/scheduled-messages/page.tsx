'use client';
import { fmtDate } from "@/lib/utils";

import {
  useZoruToast,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetTrigger,
  Textarea,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useActionState,
  } from 'react';
import { Ban,
  Clock,
  Loader2,
  Pencil,
  Send } from 'lucide-react';

import { useProject } from '@/context/project-context';

/**
 * Wachat Scheduled Messages — schedule individual future messages.
 * ZoruUI rebuild. Same handlers (getScheduledMessages, scheduleMessage,
 * cancelScheduledMessage). Edit-schedule sheet + cancel-schedule alert.
 */

import * as React from 'react';

import {
  getScheduledMessages,
  scheduleMessage,
  cancelScheduledMessage,
  updateScheduledMessage,
} from '@/app/actions/wachat-features.actions';
import { ZoruFullscreenCalendar, ZoruFullscreenCalendarEvent } from '@/components/zoruui';

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

function EditScheduleSheet({ message, projectId, onUpdated }: { message: any, projectId: string, onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useZoruToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const now = mounted ? Date.now() : 0;
  const scheduledTime = new Date(message.scheduledAt).getTime();
  const isLocked = mounted && (scheduledTime - now < 5 * 60 * 1000);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLocked) {
      toast({ title: 'Error', description: 'Editing is locked 5 minutes prior to dispatch.', variant: 'destructive' });
      return;
    }
    setIsUpdating(true);
    const formData = new FormData(e.currentTarget);
    const res = await updateScheduledMessage(message._id, projectId, formData);
    setIsUpdating(false);
    
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: res.message || 'Updated successfully.' });
      setOpen(false);
      onUpdated();
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <ZoruSheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Edit schedule" disabled={isLocked} title={isLocked ? "Editing locked 5 mins before dispatch" : "Edit schedule"}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </ZoruSheetTrigger>
      <ZoruSheetContent side="right" className="sm:max-w-md">
        <ZoruSheetHeader>
          <ZoruSheetTitle>Edit schedule</ZoruSheetTitle>
          <ZoruSheetDescription>
            Update the recipient, message, or send time before it goes out.
          </ZoruSheetDescription>
        </ZoruSheetHeader>
        <form
          onSubmit={handleSubmit}
          className="mt-5 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="es-phone">Recipient phone</Label>
            <Input
              id="es-phone"
              name="recipientPhone"
              defaultValue={message.recipientPhone}
              required
              disabled={isLocked || isUpdating}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="es-text">Message</Label>
            <Textarea
              id="es-text"
              name="messageText"
              defaultValue={message.messageText}
              rows={4}
              required
              disabled={isLocked || isUpdating}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="es-when">Scheduled at</Label>
            <Input
              id="es-when"
              name="scheduledAt"
              type="datetime-local"
              defaultValue={
                message.scheduledAt
                  ? new Date(message.scheduledAt).toISOString().slice(0, 16)
                  : undefined
              }
              required
              disabled={isLocked || isUpdating}
            />
          </div>
          <ZoruSheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLocked || isUpdating}>
              {isUpdating ? 'Saving...' : 'Save changes'}
            </Button>
          </ZoruSheetFooter>
        </form>
      </ZoruSheetContent>
    </Sheet>
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
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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
      <Breadcrumb>
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
      </Breadcrumb>

      <div>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Scheduled Messages
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Schedule WhatsApp messages to be sent at a future date and time.
        </p>
      </div>

      {/* Schedule form */}
      <Card className="p-6">
        <h2 className="mb-4 text-sm text-zoru-ink">Schedule a message</h2>
        <form
          action={formAction}
          className="flex max-w-lg flex-col gap-4"
        >
          <input type="hidden" name="projectId" value={projectId || ''} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sm-phone">Recipient phone</Label>
            <Input
              id="sm-phone"
              name="recipientPhone"
              placeholder="+919876543210"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sm-text">Message</Label>
            <Textarea
              id="sm-text"
              name="messageText"
              rows={3}
              placeholder="Message text…"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sm-when">Scheduled at</Label>
            <Input
              id="sm-when"
              name="scheduledAt"
              type="datetime-local"
              required
            />
          </div>
          <div>
            <Button type="submit" disabled={isPending || !projectId}>
              <Send className="h-3.5 w-3.5" />
              {isPending ? 'Scheduling…' : 'Schedule message'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Messages table */}
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <h2 className="text-sm text-zoru-ink font-semibold">Messages ({filtered.length})</h2>
          
          <div className="flex items-center gap-1 rounded-[var(--zoru-radius)] bg-zoru-surface p-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              List
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              Calendar
            </Button>
          </div>

          <div className="ml-auto flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'secondary' : 'ghost'}
                onClick={() => setStatusFilter(s)}
                className="capitalize text-xs h-7 px-2"
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        {isLoading && messages.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<Clock />}
            title="No scheduled messages"
            description="Schedule your first message above."
          />
        ) : viewMode === 'calendar' ? (
          <div className="h-[600px]">
            <ZoruFullscreenCalendar
              events={filtered.map((msg) => ({
                id: msg._id,
                date: new Date(msg.scheduledAt),
                title: msg.recipientPhone,
                meta: <Badge variant={statusVariant(msg.status)} className="scale-75 origin-left">{msg.status}</Badge>,
              }))}
            />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zoru-line bg-zoru-surface text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  <th className="px-4 py-3 font-medium">Recipient</th>
                  <th className="px-4 py-3 font-medium">Message</th>
                  <th className="px-4 py-3 font-medium">Scheduled time</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((msg) => {
                  const now = mounted ? Date.now() : 0;
                  const scheduledTime = new Date(msg.scheduledAt).getTime();
                  const isLocked = mounted && (scheduledTime - now < 5 * 60 * 1000);
                  return (
                    <tr
                      key={msg._id}
                      className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-[13px] text-zoru-ink font-medium">
                        {msg.recipientPhone}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-[13px] text-zoru-ink-muted">
                        {msg.messageText}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-zoru-ink-muted">
                        {fmtDate(msg.scheduledAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(msg.status)}>
                          {msg.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {msg.status === 'pending' && (
                          <div className="inline-flex items-center gap-1">
                            <EditScheduleSheet message={msg} projectId={projectId || ''} onUpdated={() => { if(projectId) fetchMessages(projectId); }} />
                            <ZoruAlertDialog>
                              <ZoruAlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Cancel schedule"
                                  disabled={cancellingId === msg._id || isLocked}
                                  title={isLocked ? "Cancellation locked near dispatch time" : "Cancel schedule"}
                                  className="text-zoru-danger hover:bg-zoru-danger/10 hover:text-zoru-danger"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </Button>
                              </ZoruAlertDialogTrigger>
                              <ZoruAlertDialogContent>
                                <ZoruAlertDialogHeader>
                                  <ZoruAlertDialogTitle>
                                    Cancel scheduled message?
                                  </ZoruAlertDialogTitle>
                                  <ZoruAlertDialogDescription>
                                    This message to {msg.recipientPhone} will not
                                    be sent at{' '}
                                    {fmtDate(msg.scheduledAt)}.
                                  </ZoruAlertDialogDescription>
                                </ZoruAlertDialogHeader>
                                <ZoruAlertDialogFooter>
                                  <ZoruAlertDialogCancel>
                                    Keep it
                                  </ZoruAlertDialogCancel>
                                  <ZoruAlertDialogAction
                                    onClick={() => handleCancel(msg._id)}
                                    className="bg-zoru-danger hover:bg-zoru-danger/90 text-white"
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="h-6" />
    </div>
  );
}
