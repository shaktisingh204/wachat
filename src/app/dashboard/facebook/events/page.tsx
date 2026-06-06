'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Input,
  Label,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Skeleton,
  Textarea,
  zoruSonnerToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
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
 * /dashboard/facebook/events — Facebook Page events.
 *
 * Lists upcoming events on the connected Page, exposes a "New event" dialog
 * (name/description/place/start_time), and opens a details Sheet on
 * click to surface attending counts and an attendee list. Cancel/delete is
 * a confirm-step via ZoruAlertDialog.
 *
 * Server actions live in `@/app/actions/facebook.actions`. The rust client
 * may currently return "not implemented" — in that case the page renders
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
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success(res.message ?? 'Event created.');
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
        zoruSonnerToast.error(res.error ?? 'Could not cancel event.');
        return;
      }
      zoruSonnerToast.success('Event cancelled.');
      setConfirmDelete(null);
      if (activeEvent?.id === id) setActiveEvent(null);
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<CalendarDays />}
          title="No project selected"
          description="Pick a Facebook page / project to manage its events."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">Meta Suite</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Events</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Events</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Plan and track upcoming events on the connected Facebook Page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New event
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load events</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
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
          icon={<CalendarDays />}
          title="No upcoming events"
          description="Create your first event to gather RSVPs from your Page audience."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New event
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <li key={ev.id}>
              <Card className="flex h-full flex-col overflow-hidden">
                <button
                  type="button"
                  onClick={() => openDetails(ev)}
                  className="flex flex-1 flex-col text-left"
                >
                  <div className="h-32 w-full bg-[var(--st-bg-muted)]">
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
                        <CalendarDays className="h-3.5 w-3.5" />
                        {safeWhen(ev.start_time)}
                      </span>
                      {placeName(ev) ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {placeName(ev)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-auto flex items-center gap-2 pt-2">
                      <Badge variant="success">
                        <Users className="h-3 w-3" />
                        {ev.attending_count ?? 0} attending
                      </Badge>
                      {ev.is_online ? <Badge variant="info">Online</Badge> : null}
                    </div>
                  </div>
                </button>
                <div className="flex items-center justify-end border-t border-[var(--st-border)] p-2">
                  <DropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Event actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent align="end">
                      <ZoruDropdownMenuItem onSelect={() => openDetails(ev)}>
                        View details
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuItem
                        onSelect={() => setConfirmDelete(ev)}
                        className="text-[var(--st-danger)]"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Cancel event
                      </ZoruDropdownMenuItem>
                    </ZoruDropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* ── New event dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New event</ZoruDialogTitle>
            <ZoruDialogDescription>
              Publish a new event to the connected Facebook Page.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <form
            action={onCreate}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="event-name">Name</Label>
              <Input id="event-name" name="name" required maxLength={150} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-desc">Description</Label>
              <Textarea id="event-desc" name="description" rows={3} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-place">Place</Label>
                <Input id="event-place" name="place" placeholder="Venue or city" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-start">Starts at</Label>
                <Input
                  id="event-start"
                  name="start_time"
                  type="datetime-local"
                  required
                />
              </div>
            </div>
            <ZoruDialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create event'}
              </Button>
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </Dialog>

      {/* ── Details sheet ── */}
      <Sheet
        open={!!activeEvent}
        onOpenChange={(open) => !open && setActiveEvent(null)}
      >
        <ZoruSheetContent className="w-full sm:max-w-md">
          <ZoruSheetHeader>
            <ZoruSheetTitle>{activeEvent?.name ?? 'Event'}</ZoruSheetTitle>
            <ZoruSheetDescription>
              RSVP counts and attendee list for this event.
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {activeEvent ? (
            <div className="mt-4 space-y-4 text-sm">
              {activeEvent.cover?.source ? (
                <div className="h-32 w-full overflow-hidden rounded-md bg-[var(--st-bg-muted)]">
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
                    : '—'}
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
                <Card className="p-3">
                  <p className="text-xs text-[var(--st-text-secondary)]">Attending</p>
                  <p className="text-lg text-[var(--st-text)]">
                    {activeEvent.attending_count ?? 0}
                  </p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-[var(--st-text-secondary)]">Interested</p>
                  <p className="text-lg text-[var(--st-text)]">
                    {activeEvent.interested_count ?? 0}
                  </p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-[var(--st-text-secondary)]">Maybe</p>
                  <p className="text-lg text-[var(--st-text)]">
                    {activeEvent.maybe_count ?? 0}
                  </p>
                </Card>
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
                  onClick={() => setConfirmDelete(activeEvent)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Cancel event
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => setActiveEvent(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </ZoruSheetContent>
      </Sheet>

      {/* ── Cancel/delete confirmation ── */}
      <ZoruAlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Cancel this event?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This will cancel &quot;{confirmDelete?.name}&quot; on the Facebook
              Page. RSVPs will be notified.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>Keep event</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={onConfirmDelete} disabled={deleting}>
              {deleting ? 'Cancelling…' : 'Cancel event'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
