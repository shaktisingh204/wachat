"use client";

/**
 * /dashboard/facebook/events — Lifecycle events (Pixel/CAPI) (ZoruUI rebuild).
 *
 * ZoruDataTable of Page events with per-event detail in a ZoruSheet.
 * Create-event uses the existing `handleCreateFacebookEvent` server-action
 * via a `useActionState` hook and `<form action={…}>`. Delete-event uses
 * `deleteFacebookEvent` with a ZoruAlertDialog confirm.
 */

import * as React from "react";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { format, formatDistanceToNow } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  CalendarDays,
  Download,
  Globe,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";

import {
  deleteFacebookEvent,
  getFacebookEvents,
  handleCreateFacebookEvent,
} from "@/app/actions/facebook.actions";
import type { FacebookEvent } from "@/lib/definitions";

import {
  ZoruAlert,
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
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCheckbox,
  ZoruDataTable,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSkeleton,
  ZoruStatCard,
  ZoruTextarea,
  useZoruToast,
} from "@/components/zoruui";

/* ── skeleton ─────────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-center justify-between">
        <ZoruSkeleton className="h-9 w-72" />
        <ZoruSkeleton className="h-9 w-32" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-24" />
        ))}
      </div>
      <ZoruSkeleton className="mt-6 h-72 w-full" />
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────── */

export default function FacebookEventsPage() {
  const { toast } = useZoruToast();
  const [events, setEvents] = useState<FacebookEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<FacebookEvent | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const [createState, createAction, isCreating] = useActionState(
    handleCreateFacebookEvent,
    {} as { message?: string; error?: string },
  );

  useEffect(() => {
    setProjectId(localStorage.getItem("activeProjectId"));
  }, []);

  const fetchEvents = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const { events: fetched, error: fetchError } =
        await getFacebookEvents(projectId);
      if (fetchError) {
        setError(fetchError);
      } else if (fetched) {
        setError(null);
        setEvents(fetched);
      }
    });
  }, [projectId]);

  useEffect(() => {
    fetchEvents();
  }, [projectId, fetchEvents]);

  // Close create dialog & refresh when the create action succeeds.
  useEffect(() => {
    if (createState?.message) {
      toast({ title: "Event created", description: createState.message });
      setCreateOpen(false);
      fetchEvents();
    }
  }, [createState, fetchEvents, toast]);

  const handleConfirmDelete = () => {
    if (!projectId || !pendingDeleteId) return;
    const id = pendingDeleteId;
    setIsDeletingId(id);
    startTransition(async () => {
      const result = await deleteFacebookEvent(id, projectId);
      setIsDeletingId(null);
      setPendingDeleteId(null);
      if (result.success) {
        toast({ title: "Event deleted" });
        fetchEvents();
      } else {
        toast({
          title: "Could not delete",
          description: result.error,
          variant: "destructive",
        });
      }
    });
  };

  const handleExport = () => {
    if (!events.length) {
      toast({
        title: "Nothing to export",
        description: "No events loaded yet.",
        variant: "destructive",
      });
      return;
    }
    const header = [
      "id",
      "name",
      "start_time",
      "end_time",
      "place",
      "is_online",
      "attending_count",
      "interested_count",
    ];
    const lines = events.map((e) =>
      [
        e.id,
        JSON.stringify(e.name ?? ""),
        e.start_time ?? "",
        e.end_time ?? "",
        JSON.stringify(e.place?.name ?? ""),
        e.is_online ? "true" : "false",
        e.attending_count ?? 0,
        e.interested_count ?? 0,
      ].join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `facebook-events-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${events.length} events` });
  };

  /* ── stats ── */
  const stats = useMemo(() => {
    const upcoming = events.filter(
      (e) => e.start_time && new Date(e.start_time).getTime() > Date.now(),
    ).length;
    const totalAttending = events.reduce(
      (sum, e) => sum + (e.attending_count || 0),
      0,
    );
    return {
      total: events.length,
      upcoming,
      totalAttending,
    };
  }, [events]);

  /* ── table columns ── */
  const columns = useMemo<ColumnDef<FacebookEvent>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Event",
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="line-clamp-1 text-[13px] text-zoru-ink">
              {row.original.name}
            </span>
            {row.original.place?.name ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-zoru-ink-muted">
                <MapPin className="h-3 w-3" />
                {row.original.place.name}
              </span>
            ) : row.original.is_online ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-zoru-ink-muted">
                <Globe className="h-3 w-3" /> Online event
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "start_time",
        header: "Starts",
        cell: ({ row }) => {
          const t = row.original.start_time;
          if (!t)
            return <span className="text-[12px] text-zoru-ink-subtle">—</span>;
          const d = new Date(t);
          return (
            <div className="flex flex-col">
              <span className="text-[12px] text-zoru-ink">
                {format(d, "MMM d, yyyy · HH:mm")}
              </span>
              <span className="text-[11px] text-zoru-ink-muted">
                {formatDistanceToNow(d, { addSuffix: true })}
              </span>
            </div>
          );
        },
      },
      {
        id: "audience",
        header: "Audience",
        cell: ({ row }) => (
          <div className="flex items-center gap-3 text-[12px] text-zoru-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {row.original.attending_count || 0}
            </span>
            <span>·</span>
            <span>{row.original.interested_count || 0} interested</span>
          </div>
        ),
      },
      {
        id: "category",
        header: "Type",
        cell: ({ row }) =>
          row.original.is_online ? (
            <ZoruBadge variant="info">Online</ZoruBadge>
          ) : (
            <ZoruBadge variant="secondary">In person</ZoruBadge>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => setActiveEvent(row.original)}
            >
              View
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="sm"
              disabled={isDeletingId === row.original.id}
              onClick={() => setPendingDeleteId(row.original.id)}
            >
              <Trash2 />
            </ZoruButton>
          </div>
        ),
      },
    ],
    [isDeletingId],
  );

  if (isLoading && events.length === 0) {
    return <PageSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      {/* ── Breadcrumb ── */}
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Events</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      {/* ── Page header ── */}
      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Lifecycle</ZoruPageEyebrow>
          <ZoruPageTitle>Events</ZoruPageTitle>
          <ZoruPageDescription>
            Browse Facebook Page events. Inspect each event's audience and
            timing or schedule a new event in seconds.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton variant="outline" size="sm" onClick={fetchEvents}>
            <RefreshCw /> Refresh
          </ZoruButton>
          <ZoruButton variant="outline" size="sm" onClick={handleExport}>
            <Download /> Export CSV
          </ZoruButton>
          <ZoruButton size="sm" onClick={() => setCreateOpen(true)}>
            <Plus /> Create event
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {!projectId ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Pick a project from the main dashboard to view events.
          </ZoruAlertDescription>
        </ZoruAlert>
      ) : error ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Could not fetch events</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      ) : (
        <>
          {/* ── Stat strip ── */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ZoruStatCard
              label="Total events"
              value={stats.total}
              icon={<CalendarDays />}
            />
            <ZoruStatCard
              label="Upcoming"
              value={stats.upcoming}
              icon={<CalendarDays />}
              period="From today"
            />
            <ZoruStatCard
              label="Total attending"
              value={stats.totalAttending.toLocaleString()}
              icon={<Users />}
              period="Across all events"
            />
          </div>

          {/* ── Events table ── */}
          <div className="mt-6">
            {events.length === 0 ? (
              <ZoruEmptyState
                icon={<CalendarDays />}
                title="No events yet"
                description="Schedule your first Facebook Page event to start tracking attendance."
                action={
                  <ZoruButton size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus /> Create event
                  </ZoruButton>
                }
              />
            ) : (
              <ZoruDataTable
                columns={columns}
                data={events}
                showColumnMenu={false}
              />
            )}
          </div>
        </>
      )}

      {/* ── Create event dialog ── */}
      <ZoruDialog open={createOpen} onOpenChange={setCreateOpen}>
        <ZoruDialogContent className="sm:max-w-2xl">
          <form action={createAction} className="flex flex-col gap-4">
            <input type="hidden" name="projectId" value={projectId ?? ""} />
            <ZoruDialogHeader>
              <ZoruDialogTitle>Create event</ZoruDialogTitle>
              <ZoruDialogDescription>
                Schedule a new Facebook Page event. Only the name and start
                time are required.
              </ZoruDialogDescription>
            </ZoruDialogHeader>

            {createState?.error ? (
              <ZoruAlert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <ZoruAlertDescription>{createState.error}</ZoruAlertDescription>
              </ZoruAlert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <ZoruLabel htmlFor="name">Event name *</ZoruLabel>
                <ZoruInput id="name" name="name" required placeholder="My event" />
              </div>
              <div className="flex flex-col gap-2">
                <ZoruLabel htmlFor="placeName">Place name</ZoruLabel>
                <ZoruInput
                  id="placeName"
                  name="placeName"
                  placeholder="Venue name"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <ZoruLabel htmlFor="description">Description</ZoruLabel>
              <ZoruTextarea
                id="description"
                name="description"
                rows={3}
                placeholder="Event description…"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex flex-col gap-2">
                <ZoruLabel htmlFor="startDate">Start date *</ZoruLabel>
                <ZoruInput
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <ZoruLabel htmlFor="startTime">Start time *</ZoruLabel>
                <ZoruInput
                  id="startTime"
                  name="startTime"
                  type="time"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <ZoruLabel htmlFor="endDate">End date</ZoruLabel>
                <ZoruInput id="endDate" name="endDate" type="date" />
              </div>
              <div className="flex flex-col gap-2">
                <ZoruLabel htmlFor="endTime">End time</ZoruLabel>
                <ZoruInput id="endTime" name="endTime" type="time" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ZoruCheckbox id="isOnline" name="isOnline" />
              <ZoruLabel htmlFor="isOnline" className="cursor-pointer">
                Online event
              </ZoruLabel>
            </div>

            <ZoruDialogFooter>
              <ZoruButton
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </ZoruButton>
              <ZoruButton type="submit" disabled={isCreating}>
                <Plus /> {isCreating ? "Creating…" : "Create event"}
              </ZoruButton>
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* ── View-event detail sheet ── */}
      <ZoruSheet
        open={activeEvent !== null}
        onOpenChange={(o) => {
          if (!o) setActiveEvent(null);
        }}
      >
        <ZoruSheetContent className="sm:max-w-md flex flex-col gap-5">
          <ZoruSheetHeader>
            <ZoruSheetTitle>{activeEvent?.name ?? "Event"}</ZoruSheetTitle>
            <ZoruSheetDescription>
              {activeEvent?.start_time
                ? `Starts ${formatDistanceToNow(
                    new Date(activeEvent.start_time),
                    { addSuffix: true },
                  )}`
                : "Event details"}
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {activeEvent ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2">
                <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-subtle">
                  Event ID
                </p>
                <p className="font-mono text-[12px] text-zoru-ink">
                  {activeEvent.id}
                </p>
              </div>
              <div className="flex flex-col divide-y divide-zoru-line rounded-[var(--zoru-radius)] border border-zoru-line">
                {activeEvent.start_time ? (
                  <DetailRow
                    label="Start"
                    value={new Date(activeEvent.start_time).toLocaleString()}
                  />
                ) : null}
                {activeEvent.end_time ? (
                  <DetailRow
                    label="End"
                    value={new Date(activeEvent.end_time).toLocaleString()}
                  />
                ) : null}
                {activeEvent.place?.name ? (
                  <DetailRow label="Place" value={activeEvent.place.name} />
                ) : null}
                {activeEvent.is_online ? (
                  <DetailRow label="Type" value="Online event" />
                ) : null}
                {activeEvent.category ? (
                  <DetailRow label="Category" value={activeEvent.category} />
                ) : null}
                <DetailRow
                  label="Attending"
                  value={(activeEvent.attending_count ?? 0).toLocaleString()}
                />
                <DetailRow
                  label="Interested"
                  value={(activeEvent.interested_count ?? 0).toLocaleString()}
                />
                {activeEvent.description ? (
                  <DetailRow
                    label="Description"
                    value={activeEvent.description}
                  />
                ) : null}
              </div>
              <div className="flex justify-end">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveEvent(null);
                    setPendingDeleteId(activeEvent.id);
                  }}
                >
                  <Trash2 /> Delete event
                </ZoruButton>
              </div>
            </div>
          ) : null}
        </ZoruSheetContent>
      </ZoruSheet>

      {/* ── Delete-event confirm ── */}
      <ZoruAlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDeleteId(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete this event?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              The event will be removed from your Facebook Page. This cannot be
              undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleConfirmDelete}>
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2">
      <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-subtle">
        {label}
      </p>
      <p className="text-[13px] text-zoru-ink">{value}</p>
    </div>
  );
}
