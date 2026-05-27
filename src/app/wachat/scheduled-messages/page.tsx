'use client';

import { fmtDate } from '@/lib/utils';
import React, { useEffect, useMemo, useState, useTransition, useCallback, useActionState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { Ban, Clock, Loader2, Pencil, Send, CalendarCheck, CalendarX, Hourglass } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getScheduledMessages,
  scheduleMessage,
  cancelScheduledMessage,
  updateScheduledMessage,
} from '@/app/actions/wachat-features.actions';

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
  ZoruFullscreenCalendar,
} from '@/components/zoruui';

import {
  WaPage,
  PageHeader,
  Section,
  WaButton,
  EmptyState,
  StatusPill,
  MetricTile,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

function compact(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}

/**
 * Wachat scheduled messages. Same actions; wachat-ui chrome.
 */

const STATUS_FILTERS = ['all', 'pending', 'sent', 'cancelled', 'failed'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function tone(s: string): StatusTone {
  if (s === 'sent') return 'sent';
  if (s === 'failed') return 'failed';
  if (s === 'pending') return 'queued';
  if (s === 'cancelled') return 'paused';
  return 'draft';
}

function EditScheduleSheet({
  message,
  projectId,
  onUpdated,
}: {
  message: any;
  projectId: string;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useZoruToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const now = mounted ? Date.now() : 0;
  const scheduledTime = new Date(message.scheduledAt).getTime();
  const isLocked = mounted && scheduledTime - now < 5 * 60 * 1000;

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
        <button
          type="button"
          aria-label="Edit schedule"
          disabled={isLocked}
          title={isLocked ? 'Editing locked 5 mins before dispatch' : 'Edit schedule'}
          className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97] disabled:opacity-50"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      </ZoruSheetTrigger>
      <ZoruSheetContent side="right" className="sm:max-w-md">
        <ZoruSheetHeader>
          <ZoruSheetTitle>Edit schedule</ZoruSheetTitle>
          <ZoruSheetDescription>Update the recipient, message, or send time before it goes out.</ZoruSheetDescription>
        </ZoruSheetHeader>
        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
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
                message.scheduledAt ? new Date(message.scheduledAt).toISOString().slice(0, 16) : undefined
              }
              required
              disabled={isLocked || isUpdating}
            />
          </div>
          <ZoruSheetFooter>
            <WaButton variant="outline" onClick={() => setOpen(false)} disabled={isUpdating}>
              Cancel
            </WaButton>
            <WaButton type="submit" disabled={isLocked || isUpdating}>
              {isUpdating ? 'Saving' : 'Save changes'}
            </WaButton>
          </ZoruSheetFooter>
        </form>
      </ZoruSheetContent>
    </Sheet>
  );
}

export default function ScheduledMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const reduce = useReducedMotion();

  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

  const filtered = messages.filter((m) => statusFilter === 'all' || m.status === statusFilter);

  const kpis = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let scheduled = 0;
    let sentToday = 0;
    let queued = 0;
    let cancelled = 0;
    for (const m of messages) {
      if (m.status === 'pending') {
        scheduled++;
        if (new Date(m.scheduledAt) <= new Date(Date.now() + 60 * 60 * 1000)) queued++;
      }
      if (m.status === 'sent' && m.sentAt && new Date(m.sentAt) >= todayStart) sentToday++;
      if (m.status === 'cancelled') cancelled++;
    }
    return { scheduled, sentToday, queued, cancelled };
  }, [messages]);

  return (
    <WaPage>
      <PageHeader
        title="Scheduled messages"
        description="Queue individual WhatsApp messages to be sent at a future date and time."
        kicker="Wachat / scheduled"
        eyebrowIcon={Clock}
        backHref="/wachat"
      />

      {/* 4-tile KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Scheduled" value={compact(kpis.scheduled)} icon={Clock} delay={0} />
        <MetricTile label="Sent today" value={compact(kpis.sentToday)} icon={CalendarCheck} delay={0.05} />
        <MetricTile label="Queued (next hour)" value={compact(kpis.queued)} icon={Hourglass} delay={0.1} />
        <MetricTile label="Cancelled" value={compact(kpis.cancelled)} icon={CalendarX} delay={0.15} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <Section title="Schedule a message" description="One-off send for a specific number.">
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="projectId" value={projectId || ''} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sm-phone">Recipient phone</Label>
              <Input id="sm-phone" name="recipientPhone" placeholder="+919876543210" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sm-text">Message</Label>
              <Textarea id="sm-text" name="messageText" rows={3} placeholder="Message text" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sm-when">Scheduled at</Label>
              <Input id="sm-when" name="scheduledAt" type="datetime-local" required />
            </div>
            <div>
              <WaButton type="submit" disabled={isPending || !projectId} leftIcon={Send}>
                {isPending ? 'Scheduling' : 'Schedule message'}
              </WaButton>
            </div>
          </form>
        </Section>

        <Section
          title={`Messages (${filtered.length})`}
          action={
            <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors active:scale-[0.97] ${viewMode === 'list' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors active:scale-[0.97] ${viewMode === 'calendar' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                Calendar
              </button>
            </div>
          }
          padded={false}
        >
          <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 px-5 py-3">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors active:scale-[0.97] ${
                  statusFilter === s
                    ? 'bg-zinc-900 text-white'
                    : 'border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-900 hover:text-zinc-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {isLoading && messages.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Clock} title="No scheduled messages" description="Schedule your first message on the left." />
            </div>
          ) : viewMode === 'calendar' ? (
            <div className="h-[600px] p-5">
              <ZoruFullscreenCalendar
                events={filtered.map((msg) => ({
                  id: msg._id,
                  date: new Date(msg.scheduledAt),
                  title: msg.recipientPhone,
                  meta: (
                    <span className="origin-left scale-75">
                      <StatusPill tone={tone(msg.status)}>{msg.status}</StatusPill>
                    </span>
                  ),
                }))}
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {filtered.map((msg, i) => {
                const now = mounted ? Date.now() : 0;
                const scheduledTime = new Date(msg.scheduledAt).getTime();
                const isLocked = mounted && scheduledTime - now < 5 * 60 * 1000;
                return (
                  <m.li
                    key={msg._id}
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 0.02 + Math.min(i, 20) * 0.03, ease: EASE_OUT }}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-zinc-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-zinc-900">{msg.recipientPhone}</span>
                        <StatusPill tone={tone(msg.status)}>{msg.status}</StatusPill>
                      </div>
                      <p className="mt-0.5 truncate text-[11.5px] text-zinc-500">{msg.messageText}</p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-zinc-400">{fmtDate(msg.scheduledAt)}</p>
                    </div>
                    {msg.status === 'pending' && (
                      <div className="flex shrink-0 items-center gap-1">
                        <EditScheduleSheet
                          message={msg}
                          projectId={projectId || ''}
                          onUpdated={() => {
                            if (projectId) fetchMessages(projectId);
                          }}
                        />
                        <ZoruAlertDialog>
                          <ZoruAlertDialogTrigger asChild>
                            <button
                              type="button"
                              aria-label="Cancel schedule"
                              disabled={cancellingId === msg._id || isLocked}
                              title={isLocked ? 'Cancellation locked near dispatch time' : 'Cancel schedule'}
                              className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.97] disabled:opacity-50"
                            >
                              <Ban className="h-3.5 w-3.5" strokeWidth={2.25} />
                            </button>
                          </ZoruAlertDialogTrigger>
                          <ZoruAlertDialogContent>
                            <ZoruAlertDialogHeader>
                              <ZoruAlertDialogTitle>Cancel scheduled message?</ZoruAlertDialogTitle>
                              <ZoruAlertDialogDescription>
                                This message to {msg.recipientPhone} will not be sent at {fmtDate(msg.scheduledAt)}.
                              </ZoruAlertDialogDescription>
                            </ZoruAlertDialogHeader>
                            <ZoruAlertDialogFooter>
                              <ZoruAlertDialogCancel>Keep it</ZoruAlertDialogCancel>
                              <ZoruAlertDialogAction onClick={() => handleCancel(msg._id)}>
                                Cancel schedule
                              </ZoruAlertDialogAction>
                            </ZoruAlertDialogFooter>
                          </ZoruAlertDialogContent>
                        </ZoruAlertDialog>
                      </div>
                    )}
                  </m.li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </WaPage>
  );
}
