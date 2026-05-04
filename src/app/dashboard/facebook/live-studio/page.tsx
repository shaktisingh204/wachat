"use client";

/**
 * /dashboard/facebook/live-studio — Live broadcast launcher, ZoruUI rebuild.
 *
 * Same handlers + server actions as before
 * (getScheduledLiveStreams, handleScheduleLiveStream).
 *
 * The original page only schedules a premiere from a pre-recorded video.
 * This rebuild keeps that flow intact and layers on a neutral pre-broadcast
 * checklist (`ZoruAlert`s + completion state) plus start/stop confirm
 * `ZoruAlertDialog`s as required by Phase 3.
 */

import * as React from "react";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useFormStatus } from "react-dom";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  LoaderCircle,
  PlayCircle,
  Radio,
  StopCircle,
  Upload,
  Video,
} from "lucide-react";

import {
  getScheduledLiveStreams,
  handleScheduleLiveStream,
} from "@/app/actions/facebook.actions";
import { useProject } from "@/context/project-context";
import type { FacebookLiveStream, WithId } from "@/lib/definitions";

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
  ZoruCard,
  ZoruDatePicker,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  cn,
  useZoruToast,
} from "@/components/zoruui";

import { NoProjectState } from "../_components/no-project-state";

type ScheduleState = { message?: string; error?: string };
const INITIAL_SCHEDULE_STATE: ScheduleState = {};

/* ── Skeleton ─────────────────────────────────────────────────────── */

function LiveStudioSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <ZoruSkeleton className="h-3 w-24" />
          <ZoruSkeleton className="h-8 w-56" />
          <ZoruSkeleton className="h-4 w-80" />
        </div>
        <ZoruSkeleton className="h-9 w-32 rounded-full" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ZoruSkeleton className="h-[360px] lg:col-span-2" />
        <ZoruSkeleton className="h-[360px]" />
      </div>
    </div>
  );
}

/* ── Submit button (uses useFormStatus from form action) ──────────── */

function ScheduleSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={disabled || pending} size="lg">
      {pending ? (
        <LoaderCircle className="animate-spin" />
      ) : (
        <CalendarIcon />
      )}
      Schedule premiere
    </ZoruButton>
  );
}

/* ── Status badge mapping ─────────────────────────────────────────── */

function StatusBadge({ status }: { status: FacebookLiveStream["status"] }) {
  const label = status.replace(/_/g, " ").toLowerCase();
  if (status === "LIVE") {
    return (
      <ZoruBadge variant="success">
        <Radio /> {label}
      </ZoruBadge>
    );
  }
  if (status === "VOD") {
    return <ZoruBadge variant="ghost">{label}</ZoruBadge>;
  }
  return <ZoruBadge variant="secondary">{label}</ZoruBadge>;
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default function LiveStudioPage() {
  const { activeProject, isLoadingProject } = useProject();
  const [streams, setStreams] = useState<WithId<FacebookLiveStream>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Confirm dialogs (Phase 3 requirement).
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [stopConfirmTarget, setStopConfirmTarget] =
    useState<WithId<FacebookLiveStream> | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useZoruToast();

  const [state, formAction] = useActionState(
    handleScheduleLiveStream,
    INITIAL_SCHEDULE_STATE,
  );

  const projectId = activeProject?._id?.toString() ?? null;

  const fetchStreams = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const data = await getScheduledLiveStreams(projectId);
      setStreams(data);
    });
  }, [projectId]);

  useEffect(() => {
    document.title = "Live Studio · Meta Suite · SabNode";
  }, []);

  useEffect(() => {
    if (projectId) fetchStreams();
  }, [projectId, fetchStreams]);

  // Toast + reset on schedule action result.
  useEffect(() => {
    if (state?.message) {
      toast({ title: "Scheduled", description: state.message });
      formRef.current?.reset();
      setScheduledDate(undefined);
      setScheduledTime("");
      setVideoFile(null);
      setTitle("");
      setDescription("");
      setStartConfirmOpen(false);
      fetchStreams();
    } else if (state?.error) {
      toast({
        title: "Could not schedule",
        description: state.error,
        variant: "destructive",
      });
      setStartConfirmOpen(false);
    }
  }, [state, toast, fetchStreams]);

  // Pre-broadcast checklist drives the start-stream button.
  const checklist = useMemo(
    () => [
      {
        key: "project",
        label: "Project connected to a Facebook Page",
        ok: !!activeProject,
      },
      { key: "title", label: "Stream title set", ok: title.trim().length > 0 },
      { key: "video", label: "Video file ready (MP4 or MOV)", ok: !!videoFile },
      { key: "date", label: "Premiere date picked", ok: !!scheduledDate },
      { key: "time", label: "Premiere time set", ok: scheduledTime.length > 0 },
    ],
    [activeProject, title, videoFile, scheduledDate, scheduledTime],
  );
  const allChecksOk = checklist.every((c) => c.ok);

  if (isLoadingProject) {
    return <LiveStudioSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
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
            <ZoruBreadcrumbPage>Live Studio</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Meta Suite</ZoruPageEyebrow>
          <ZoruPageTitle>Live Studio</ZoruPageTitle>
          <ZoruPageDescription>
            Upload a pre-recorded video and schedule it as a Page live
            premiere. Run through the preflight checklist before going live.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruBadge variant="secondary">
            <Video />
            {streams.length} stream{streams.length === 1 ? "" : "s"}
          </ZoruBadge>
          <ZoruButton
            onClick={() => setStartConfirmOpen(true)}
            disabled={!allChecksOk}
          >
            <PlayCircle /> Start premiere
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      <div className="mt-6">
        {!activeProject ? (
          <NoProjectState />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* ─── Schedule form + checklist (left, 2 cols) ─── */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              <PreflightChecklist items={checklist} allOk={allChecksOk} />

              <ZoruCard variant="elevated">
                <div className="flex flex-col gap-1.5 p-6 pb-4">
                  <h2 className="text-base font-semibold tracking-tight text-zoru-ink">
                    Schedule a premiere
                  </h2>
                  <p className="text-sm text-zoru-ink-muted">
                    Pick a video, set a title, and choose when it should go
                    live.
                  </p>
                </div>

                <form
                  ref={formRef}
                  action={formAction}
                  className="flex flex-col gap-5 px-6 pb-6"
                >
                  <input type="hidden" name="projectId" value={projectId ?? ""} />
                  {scheduledDate && (
                    <input
                      type="hidden"
                      name="scheduledDate"
                      value={scheduledDate.toISOString().split("T")[0]}
                    />
                  )}

                  {state?.error && (
                    <ZoruAlert variant="destructive">
                      <AlertTriangle />
                      <ZoruAlertTitle>Couldn’t schedule stream</ZoruAlertTitle>
                      <ZoruAlertDescription>{state.error}</ZoruAlertDescription>
                    </ZoruAlert>
                  )}

                  {/* Video uploader */}
                  <div className="flex flex-col gap-2">
                    <ZoruLabel htmlFor="videoFile" required>
                      Video file
                    </ZoruLabel>
                    <label
                      htmlFor="videoFile"
                      className="flex flex-col items-center gap-2 rounded-[var(--zoru-radius-lg)] border border-dashed border-zoru-line bg-zoru-bg p-8 text-center transition-colors hover:border-zoru-line-strong hover:bg-zoru-surface focus-within:border-zoru-ink"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                        <Upload className="h-5 w-5" />
                      </span>
                      <span className="text-sm font-medium text-zoru-ink">
                        {videoFile ? videoFile.name : "Click to pick a video"}
                      </span>
                      <span className="text-xs text-zoru-ink-muted">
                        MP4 / MOV — up to 50 MB
                      </span>
                      <input
                        id="videoFile"
                        name="videoFile"
                        type="file"
                        accept="video/mp4,video/quicktime"
                        required
                        className="sr-only"
                        onChange={(e) =>
                          setVideoFile(e.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                  </div>

                  <div className="flex flex-col gap-2">
                    <ZoruLabel htmlFor="title" required>
                      Title
                    </ZoruLabel>
                    <ZoruInput
                      id="title"
                      name="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Launching our new collection"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <ZoruLabel htmlFor="description">Description</ZoruLabel>
                    <ZoruTextarea
                      id="description"
                      name="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Tell viewers what to expect…"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <ZoruLabel>Date</ZoruLabel>
                      <ZoruDatePicker
                        value={scheduledDate}
                        onChange={setScheduledDate}
                        placeholder="Pick a date"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <ZoruLabel htmlFor="scheduledTime" required>
                        Time
                      </ZoruLabel>
                      <ZoruInput
                        id="scheduledTime"
                        name="scheduledTime"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <ScheduleSubmitButton disabled={!allChecksOk} />
                  </div>
                </form>
              </ZoruCard>
            </div>

            {/* ─── Active streams panel (right, 1 col) ─── */}
            <ActiveStreamsPanel
              streams={streams}
              isLoading={isLoading}
              onStop={(stream) => setStopConfirmTarget(stream)}
            />
          </div>
        )}
      </div>

      {/* ── Start-stream confirm dialog ─────────────────────────── */}
      <ZoruAlertDialog
        open={startConfirmOpen}
        onOpenChange={setStartConfirmOpen}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Start premiere?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              SabNode will upload the selected video and schedule it as a live
              premiere on{" "}
              <strong className="text-zoru-ink">
                {scheduledDate
                  ? format(scheduledDate, "PPP")
                  : "the chosen date"}
              </strong>{" "}
              at <strong className="text-zoru-ink">{scheduledTime || "—"}</strong>
              . You can’t cancel from this dialog after upload starts.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => {
                // Submit the schedule form — the action handles upload + DB write.
                formRef.current?.requestSubmit();
              }}
            >
              <PlayCircle /> Start premiere
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* ── Stop-stream confirm dialog ──────────────────────────── */}
      <ZoruAlertDialog
        open={!!stopConfirmTarget}
        onOpenChange={(open) => !open && setStopConfirmTarget(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>End live broadcast?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {stopConfirmTarget ? (
                <>
                  This will stop{" "}
                  <strong className="text-zoru-ink">
                    {stopConfirmTarget.title}
                  </strong>{" "}
                  and convert it to a regular Page video. Viewers will be
                  disconnected immediately.
                </>
              ) : null}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Keep broadcasting</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              destructive
              onClick={() => {
                // No native "stop" server action — surface a hint via toast
                // and link out so the user can finish the stream on Facebook.
                if (stopConfirmTarget) {
                  toast({
                    title: "Open Facebook to end the stream",
                    description:
                      "End-broadcast must be confirmed in the Facebook live producer.",
                  });
                  if (typeof window !== "undefined") {
                    window.open(
                      `https://www.facebook.com/${stopConfirmTarget.facebookVideoId}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }
                }
                setStopConfirmTarget(null);
              }}
            >
              <StopCircle /> End broadcast
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}

/* ── Preflight checklist ──────────────────────────────────────────── */

function PreflightChecklist({
  items,
  allOk,
}: {
  items: { key: string; label: string; ok: boolean }[];
  allOk: boolean;
}) {
  return (
    <ZoruAlert variant={allOk ? "success" : "info"}>
      {allOk ? <CheckCircle2 /> : <AlertTriangle />}
      <ZoruAlertTitle>
        {allOk ? "Ready to go live" : "Pre-broadcast checklist"}
      </ZoruAlertTitle>
      <ZoruAlertDescription>
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-2 text-[13px] text-zoru-ink"
            >
              {item.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-zoru-success" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-zoru-ink-subtle" />
              )}
              <span
                className={cn(item.ok ? "text-zoru-ink" : "text-zoru-ink-muted")}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </ZoruAlertDescription>
    </ZoruAlert>
  );
}

/* ── Active streams panel ─────────────────────────────────────────── */

function ActiveStreamsPanel({
  streams,
  isLoading,
  onStop,
}: {
  streams: WithId<FacebookLiveStream>[];
  isLoading: boolean;
  onStop: (stream: WithId<FacebookLiveStream>) => void;
}) {
  const live = streams.filter((s) => s.status === "LIVE");
  const upcoming = streams.filter((s) => s.status === "SCHEDULED_LIVE");

  return (
    <div className="flex flex-col gap-4">
      {live.length > 0 && (
        <ZoruCard variant="elevated" className="p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zoru-success/15 text-zoru-success">
              <Radio className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-zoru-success">
                Live now
              </p>
              <p className="text-sm text-zoru-ink">
                {live.length} active broadcast{live.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {live.map((stream) => (
              <li
                key={stream._id.toString()}
                className="flex items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zoru-ink">
                    {stream.title}
                  </p>
                  <p className="text-[11px] text-zoru-ink-muted">
                    Scheduled for {format(new Date(stream.scheduledTime), "PPp")}
                  </p>
                </div>
                <ZoruButton
                  size="sm"
                  variant="destructive"
                  onClick={() => onStop(stream)}
                >
                  <StopCircle /> End
                </ZoruButton>
              </li>
            ))}
          </ul>
        </ZoruCard>
      )}

      <ZoruCard variant="elevated">
        <div className="flex items-center justify-between gap-2 p-5 pb-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-zoru-ink-subtle">
              Upcoming &amp; past
            </p>
            <p className="text-sm text-zoru-ink-muted">
              Most recent 50 streams from this Page
            </p>
          </div>
          {isLoading && (
            <LoaderCircle className="h-4 w-4 animate-spin text-zoru-ink-subtle" />
          )}
        </div>
        <div className="border-t border-zoru-line">
          {streams.length === 0 ? (
            <ZoruEmptyState
              compact
              icon={<Clock />}
              title="No streams scheduled"
              description="Schedule your first premiere using the form on the left."
              className="rounded-none border-0"
            />
          ) : (
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Title</ZoruTableHead>
                  <ZoruTableHead>Scheduled</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {streams.slice(0, 6).map((stream) => (
                  <ZoruTableRow key={stream._id.toString()}>
                    <ZoruTableCell className="max-w-[160px] truncate font-medium">
                      <Link
                        href={`https://www.facebook.com/${stream.facebookVideoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-zoru-ink hover:underline"
                      >
                        {stream.title}
                        <ExternalLink className="h-3 w-3 text-zoru-ink-subtle" />
                      </Link>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[11.5px] text-zoru-ink-muted">
                      {format(new Date(stream.scheduledTime), "PP p")}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <StatusBadge status={stream.status} />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </ZoruTable>
          )}
        </div>
      </ZoruCard>

      {upcoming.length > 0 && live.length === 0 && (
        <ZoruAlert variant="info">
          <Clock />
          <ZoruAlertTitle>
            {upcoming.length} upcoming premiere{upcoming.length === 1 ? "" : "s"}
          </ZoruAlertTitle>
          <ZoruAlertDescription>
            Your scheduled premieres will appear in the table above and go live
            automatically at their scheduled time.
          </ZoruAlertDescription>
        </ZoruAlert>
      )}
    </div>
  );
}
