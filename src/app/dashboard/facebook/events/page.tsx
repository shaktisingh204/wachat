'use client';

import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertTitle,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  StatCard,
  Textarea,
  toast,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  CalendarDays,
  MapPin,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getFacebookEvents,
  getEventDetails,
  handleCreateFacebookEvent,
  deleteFacebookEvent,
  getEventAttendees,
  } from '@/app/actions/facebook.actions';
import type { FacebookEvent } from '@/lib/definitions';

/**
 * /dashboard/facebook/events - Facebook Page events.
 *
 * Lists upcoming events on the connected Page, exposes a "New event" dialog
 * (name/description/place/start_time), and opens a details Sheet on
 * click to surface attending counts and an attendee list. Cancel/delete is
 * a confirm-step via AlertDialog.
 *
 * Server actions live in `@/app/actions/facebook.actions`. The rust client
 * may currently return "not implemented" - in that case the page renders
 * the error inline and remains usable for the create dialog.
 */

import * as React from 'react';

interface Attendee {
  id?: string;
  name?: string;
  rsvp_status?: string;
}

function safeWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

function placeName(ev: FacebookEvent): string {
  return ev.place?.name ?? ev.place?.location?.city ?? '';
}

export default function FacebookEventsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [events, setEvents] = useState<FacebookEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const [activeEvent, setActiveEvent] = useState<FacebookEvent | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeLoading, startAttendeeLoading] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const [confirmDelete, setConfirmDelete] = useState<FacebookEvent | null>(null);
  const [deleting, startDelete] = useTransition();

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const res = await getFacebookEvents(projectId);
      if (res.error) {
        setError(res.error);
        setEvents(res.events ?? []);
        return;
      }
      setError(null);
      setEvents(res.events ?? []);
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openDetails = (ev: FacebookEvent) => {
    setActiveEvent(ev);
    setAttendees([]);
    startAttendeeLoading(async () => {
      const [det, att] = await Promise.all([
        getEventDetails(ev.id, projectId),
        getEventAttendees(ev.id, projectId, 'attending'),
      ]);
      if (det.event) setActiveEvent(det.event);
      setAttendees((att.attendees ?? []) as Attendee[]);
    });
  };

  const onCreate = (formData: FormData) => {
    formData.set('projectId', projectId);
    startSubmit(async () => {
      const res = await handleCreateFacebookEvent(undefined, formData);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? 'Event created.');
      setCreateOpen(false);
      refresh();
    });
  };

  const onConfirmDelete = () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    startDelete(async () => {
      const res = await deleteFacebookEvent(id, projectId);
      if (!res.success) {
        toast.error(res.error ?? 'Could not cancel event.');
        return;
      }
      toast.success('Event cancelled.');
      setConfirmDelete(null);
      if (activeEvent?.id === id) setActiveEvent(null);
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={CalendarDays}
          title="No project selected"
          description="Pick a Facebook page / project to manage its events."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">Meta Suite</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Events</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader bordered={false}>
        <PageHeaderHeading>
          <PageTitle>Events</PageTitle>
          <PageDescription>
            Plan and track upcoming events on the connected Facebook Page.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="ghost"
            onClick={refresh}
            disabled={loading}
            iconLeft={RefreshCw}
          >
            Refresh
          </Button>
          <Button variant="primary" onClick={() => setCreateOpen(true)} iconLeft={Plus}>
            New event
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load events</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && events.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No upcoming events"
          description="Create your first event to gather RSVPs from your Page audience."
          action={
            <Button variant="primary" onClick={() => setCreateOpen(true)} iconLeft={Plus}>
              New event
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <li key={ev.id}>
              <Card
                variant="interactive"
                padding="none"
                role="button"
                tabIndex={0}
                aria-label={`Open details for ${ev.name}`}
                onClick={() => openDetails(ev)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDetails(ev);
                  }
                }}
                className="flex h-full flex-col overflow-hidden"
              >
                <div className="h-32 w-full bg-[var(--st-bg-secondary)]">
                  {ev.cover?.source ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ev.cover.source}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="line-clamp-2 text-base text-[var(--st-text)]">{ev.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      {safeWhen(ev.start_time)}
                    </span>
                    {placeName(ev) ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        {placeName(ev)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <Badge variant="success">
                      <Users className="h-3 w-3" aria-hidden="true" />
                      {ev.attending_count ?? 0} attending
                    </Badge>
                    {ev.is_online ? <Badge variant="info">Online</Badge> : null}
                  </div>
                </div>
                <div className="flex items-center justify-end border-t border-[var(--st-border)] p-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton
                        label="Event actions"
                        icon={MoreHorizontal}
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openDetails(ev)}>
                        View details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="danger"
                        iconLeft={Trash2}
                        onSelect={() => setConfirmDelete(ev)}
                      >
                        Cancel event
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* New event dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
            <DialogDescription>
              Publish a new event to the connected Facebook Page.
            </DialogDescription>
          </DialogHeader>
          <form
            action={onCreate}
            className="space-y-3"
          >
            <Field label="Name" required>
              <Input name="name" required maxLength={150} />
            </Field>
            <Field label="Description">
              <Textarea name="description" rows={3} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Place">
                <Input name="place" placeholder="Venue or city" />
              </Field>
              <Field label="Starts at" required>
                <Input name="start_time" type="datetime-local" required />
              </Field>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                {submitting ? 'Creating' : 'Create event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Details sheet */}
      <Sheet
        open={!!activeEvent}
        onOpenChange={(open) => !open && setActiveEvent(null)}
      >
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{activeEvent?.name ?? 'Event'}</SheetTitle>
            <SheetDescription>
              RSVP counts and attendee list for this event.
            </SheetDescription>
          </SheetHeader>
          {activeEvent ? (
            <div className="mt-4 space-y-4 text-sm">
              {activeEvent.cover?.source ? (
                <div className="h-32 w-full overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeEvent.cover.source}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  When
                </p>
                <p className="text-[var(--st-text)]">
                  {activeEvent.start_time
                    ? new Date(activeEvent.start_time).toLocaleString()
                    : '-'}
                </p>
              </div>
              {placeName(activeEvent) ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Where
                  </p>
                  <p className="text-[var(--st-text)]">{placeName(activeEvent)}</p>
                </div>
              ) : null}
              {activeEvent.description ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Description
                  </p>
                  <p className="whitespace-pre-wrap text-[var(--st-text)]">
                    {activeEvent.description}
                  </p>
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Attending" value={activeEvent.attending_count ?? 0} />
                <StatCard label="Interested" value={activeEvent.interested_count ?? 0} />
                <StatCard label="Maybe" value={activeEvent.maybe_count ?? 0} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Attendees
                </p>
                {attendeeLoading ? (
                  <div className="mt-2 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ) : attendees.length === 0 ? (
                  <p className="text-xs text-[var(--st-text-secondary)]">No attendees yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {attendees.slice(0, 50).map((a, i) => (
                      <li
                        key={a.id ?? `${i}-${a.name ?? 'attendee'}`}
                        className="text-[var(--st-text)]"
                      >
                        {a.name ?? '(unknown)'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  iconLeft={Trash2}
                  onClick={() => setConfirmDelete(activeEvent)}
                >
                  Cancel event
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setActiveEvent(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Cancel/delete confirmation */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel &quot;{confirmDelete?.name}&quot; on the Facebook
              Page. RSVPs will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep event</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete} disabled={deleting}>
              {deleting ? 'Cancelling' : 'Cancel event'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
