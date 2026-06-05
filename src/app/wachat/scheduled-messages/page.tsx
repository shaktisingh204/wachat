'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  type BadgeTone,
  Button,
  IconButton,
  Card,
  EmptyState,
  Field,
  Input,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  SegmentedControl,
  Spinner,
  Textarea,
  FullscreenCalendar,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useActionState,
  } from 'react';
import { Ban,
  Clock,
  Pencil,
  Send } from 'lucide-react';

import { useProject } from '@/context/project-context';

/**
 * Wachat Scheduled Messages — schedule individual future messages.
 * 20ui rebuild. Same handlers (getScheduledMessages, scheduleMessage,
 * cancelScheduledMessage). Edit-schedule drawer + cancel-schedule alert.
 */

import * as React from 'react';

import {
  getScheduledMessages,
  scheduleMessage,
  cancelScheduledMessage,
  updateScheduledMessage,
} from '@/app/actions/wachat-features.actions';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

const STATUS_FILTERS = ['all', 'pending', 'sent', 'cancelled', 'failed'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusTone(s: string): BadgeTone {
  if (s === 'sent') return 'success';
  if (s === 'failed') return 'danger';
  if (s === 'pending') return 'warning';
  return 'neutral';
}

/* ── edit-schedule drawer ───────────────────────────────────────── */

function EditScheduleSheet({ message, projectId, onUpdated }: { message: any, projectId: string, onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const now = mounted ? Date.now() : 0;
  const scheduledTime = new Date(message.scheduledAt).getTime();
  const isLocked = mounted && (scheduledTime - now < 5 * 60 * 1000);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLocked) {
      toast({ title: 'Error', description: 'Editing is locked 5 minutes prior to dispatch.', tone: 'danger' });
      return;
    }
    setIsUpdating(true);
    const formData = new FormData(e.currentTarget);
    const res = await updateScheduledMessage(message._id, projectId, formData);
    setIsUpdating(false);

    if (res.error) {
      toast({ title: 'Error', description: res.error, tone: 'danger' });
    } else {
      toast({ title: 'Success', description: res.message || 'Updated successfully.', tone: 'success' });
      setOpen(false);
      onUpdated();
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} side="right">
      <DrawerTrigger asChild>
        <IconButton
          icon={Pencil}
          variant="ghost"
          size="sm"
          label="Edit schedule"
          disabled={isLocked}
          title={isLocked ? "Editing locked 5 mins before dispatch" : "Edit schedule"}
        />
      </DrawerTrigger>
      <DrawerContent side="right">
        <DrawerHeader>
          <DrawerTitle>Edit schedule</DrawerTitle>
          <DrawerDescription>
            Update the recipient, message, or send time before it goes out.
          </DrawerDescription>
        </DrawerHeader>
        <form
          onSubmit={handleSubmit}
          className="mt-5 flex flex-col gap-4 px-1"
        >
          <Field label="Recipient phone" id="es-phone">
            <Input
              id="es-phone"
              name="recipientPhone"
              defaultValue={message.recipientPhone}
              required
              disabled={isLocked || isUpdating}
            />
          </Field>
          <Field label="Message" id="es-text">
            <Textarea
              id="es-text"
              name="messageText"
              defaultValue={message.messageText}
              rows={4}
              required
              disabled={isLocked || isUpdating}
            />
          </Field>
          <Field label="Scheduled at" id="es-when">
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
          </Field>
          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isUpdating} disabled={isLocked || isUpdating}>
              {isUpdating ? 'Saving...' : 'Save changes'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

export default function ScheduledMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
            tone: 'danger',
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
      toast({ title: 'Success', description: formState.message, tone: 'success' });
      if (projectId) fetchMessages(projectId);
    }
    if (formState?.error) {
      toast({
        title: 'Error',
        description: formState.error,
        tone: 'danger',
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
        tone: 'danger',
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Scheduled Messages' },
      ]}
      title="Scheduled Messages"
      description="Schedule WhatsApp messages to be sent at a future date and time."
      width="wide"
    >
      <div className="flex flex-col gap-6">
        {/* Schedule form */}
        <Card padding="lg">
          <h2 className="mb-4 text-sm" style={{ color: 'var(--st-text)' }}>Schedule a message</h2>
          <form
            action={formAction}
            className="flex max-w-lg flex-col gap-4"
          >
            <input type="hidden" name="projectId" value={projectId || ''} />
            <Field label="Recipient phone" id="sm-phone">
              <Input
                id="sm-phone"
                name="recipientPhone"
                placeholder="+919876543210"
                required
              />
            </Field>
            <Field label="Message" id="sm-text">
              <Textarea
                id="sm-text"
                name="messageText"
                rows={3}
                placeholder="Message text…"
                required
              />
            </Field>
            <Field label="Scheduled at" id="sm-when">
              <Input
                id="sm-when"
                name="scheduledAt"
                type="datetime-local"
                required
              />
            </Field>
            <div>
              <Button type="submit" variant="primary" iconLeft={Send} loading={isPending} disabled={isPending || !projectId}>
                {isPending ? 'Scheduling…' : 'Schedule message'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Messages table */}
        <Card padding="lg">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--st-text)' }}>Messages ({filtered.length})</h2>

            <SegmentedControl
              aria-label="View mode"
              size="sm"
              value={viewMode}
              onChange={(v) => setViewMode(v as 'list' | 'calendar')}
              items={[
                { value: 'list', label: 'List' },
                { value: 'calendar', label: 'Calendar' },
              ]}
            />

            <div className="ml-auto">
              <SegmentedControl
                aria-label="Filter by status"
                size="sm"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as StatusFilter)}
                items={STATUS_FILTERS.map((s) => ({
                  value: s,
                  label: <span className="capitalize">{s}</span>,
                }))}
              />
            </div>
          </div>

          {isLoading && messages.length === 0 ? (
            <div className="flex h-20 items-center justify-center">
              <Spinner label="Loading scheduled messages" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No scheduled messages"
              description="Schedule your first message above."
            />
          ) : viewMode === 'calendar' ? (
            <div className="h-[600px]">
              <FullscreenCalendar
                events={filtered.map((msg) => ({
                  id: msg._id,
                  date: new Date(msg.scheduledAt),
                  title: (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="truncate">{msg.recipientPhone}</span>
                      <Badge tone={statusTone(msg.status)} className="scale-75 origin-left">{msg.status}</Badge>
                    </span>
                  ),
                }))}
              />
            </div>
          ) : (
            <div
              className="overflow-x-auto"
              style={{
                borderRadius: 'var(--st-radius)',
                border: '1px solid var(--st-border)',
              }}
            >
              <table className="w-full text-left text-sm">
                <thead>
                  <tr
                    className="text-[11px] uppercase tracking-wide"
                    style={{
                      borderBottom: '1px solid var(--st-border)',
                      background: 'var(--st-bg-secondary)',
                      color: 'var(--st-text-tertiary)',
                    }}
                  >
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
                        className="transition-colors last:border-0"
                        style={{ borderBottom: '1px solid var(--st-border)' }}
                      >
                        <td className="px-4 py-3 text-[13px] font-medium" style={{ color: 'var(--st-text)' }}>
                          {msg.recipientPhone}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-[13px]" style={{ color: 'var(--st-text-secondary)' }}>
                          {msg.messageText}
                        </td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: 'var(--st-text-secondary)' }}>
                          {fmtDate(msg.scheduledAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={statusTone(msg.status)}>
                            {msg.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {msg.status === 'pending' && (
                            <div className="inline-flex items-center gap-1">
                              <EditScheduleSheet message={msg} projectId={projectId || ''} onUpdated={() => { if(projectId) fetchMessages(projectId); }} />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <IconButton
                                    icon={Ban}
                                    variant="ghost"
                                    size="sm"
                                    label="Cancel schedule"
                                    disabled={cancellingId === msg._id || isLocked}
                                    title={isLocked ? "Cancellation locked near dispatch time" : "Cancel schedule"}
                                    style={{ color: 'var(--st-danger)' }}
                                  />
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Cancel scheduled message?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This message to {msg.recipientPhone} will not
                                      be sent at{' '}
                                      {fmtDate(msg.scheduledAt)}.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Keep it
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      intent="danger"
                                      onClick={() => handleCancel(msg._id)}
                                    >
                                      Cancel schedule
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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
      </div>
    </WachatPage>
  );
}
