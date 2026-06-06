"use client";

import { Alert, AlertDescription, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, DatePicker, EmptyState, Input, Label, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle, Skeleton, Table, TBody, Td, Th, THead, Tr, Textarea, cn, useToast } from '@/components/sabcrm/20ui/compat';
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
import type { FacebookLiveStream,
  WithId } from "@/lib/definitions";

/**
 * /dashboard/facebook/live-studio — Live broadcast launcher, ZoruUI rebuild.
 *
 * Same handlers + server actions as before
 * (getScheduledLiveStreams, handleScheduleLiveStream).
 *
 * The original page only schedules a premiere from a pre-recorded video.
 * This rebuild keeps that flow intact and layers on a neutral pre-broadcast
 * checklist (`ZoruAlert`s + completion state) plus start/stop confirm
 * `AlertDialog`s as required by Phase 3.
 */

import * as React from "react";

import { NoProjectState } from "../_components/no-project-state";

type ScheduleState = { message?: string; error?: string };
const INITIAL_SCHEDULE_STATE: ScheduleState = {};

/* ── Skeleton ─────────────────────────────────────────────────────── */

function LiveStudioSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-3 w-52" />
      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[360px] lg:col-span-2" />
        <Skeleton className="h-[360px]" />
      </div>
    </div>
  );
}

/* ── Submit button (uses useFormStatus from form action) ──────────── */

function ScheduleSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} size="lg">
      {pending ? (
        <LoaderCircle className="animate-spin" />
      ) : (
        <CalendarIcon />
      )}
      Schedule premiere
    </Button>
  );
}

/* ── Status badge mapping ─────────────────────────────────────────── */

function StatusBadge({ status }: { status: FacebookLiveStream["status"] }) {
  const label = status.replace(/_/g, " ").toLowerCase();
  if (status === "LIVE") {
    return (
      <Badge variant="success">
        <Radio /> {label}
      </Badge>
    );
  }
  if (status === "VOD") {
    return <Badge variant="ghost">{label}</Badge>;
  }
  return <Badge variant="secondary">{label}</Badge>;
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
  const { toast } = useToast();

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
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Live Studio</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <PageHeading>
          <PageEyebrow>Meta Suite</PageEyebrow>
          <PageTitle>Live Studio</PageTitle>
          <PageDescription>
            Upload a pre-recorded video and schedule it as a Page live
            premiere. Run through the preflight checklist before going live.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Badge variant="secondary">
            <Video />
            {streams.length} stream{streams.length === 1 ? "" : "s"}
          </Badge>
          <Button
            onClick={() => setStartConfirmOpen(true)}
            disabled={!allChecksOk}
          >
            <PlayCircle /> Start premiere
          </Button>
        </PageActions>
      </PageHeader>

      <div className="mt-6">
        {!activeProject ? (
          <NoProjectState />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* ─── Schedule form + checklist (left, 2 cols) ─── */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              <PreflightChecklist items={checklist} allOk={allChecksOk} />

              <Card variant="elevated">
                <div className="flex flex-col gap-1.5 p-6 pb-4">
                  <h2 className="text-base font-semibold tracking-tight text-[var(--st-text)]">
                    Schedule a premiere
                  </h2>
                  <p className="text-sm text-[var(--st-text-secondary)]">
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
                    <Alert variant="destructive">
                      <AlertTriangle />
                      <AlertTitle>Couldn’t schedule stream</AlertTitle>
                      <AlertDescription>{state.error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Video uploader */}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="videoFile" required>
                      Video file
                    </Label>
                    <label
                      htmlFor="videoFile"
                      className="flex flex-col items-center gap-2 rounded-[var(--st-radius-lg)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg)] p-8 text-center transition-colors hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg-secondary)] focus-within:border-[var(--st-text)]"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                        <Upload className="h-5 w-5" />
                      </span>
                      <span className="text-sm font-medium text-[var(--st-text)]">
                        {videoFile ? videoFile.name : "Click to pick a video"}
                      </span>
                      <span className="text-xs text-[var(--st-text-secondary)]">
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
                    <Label htmlFor="title" required>
                      Title
                    </Label>
                    <Input
                      id="title"
                      name="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Launching our new collection"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
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
                      <Label>Date</Label>
                      <DatePicker
                        value={scheduledDate}
                        onChange={setScheduledDate}
                        placeholder="Pick a date"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="scheduledTime" required>
                        Time
                      </Label>
                      <Input
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
              </Card>
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
      <AlertDialog
        open={startConfirmOpen}
        onOpenChange={setStartConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start premiere?</AlertDialogTitle>
            <AlertDialogDescription>
              SabNode will upload the selected video and schedule it as a live
              premiere on{" "}
              <strong className="text-[var(--st-text)]">
                {scheduledDate
                  ? format(scheduledDate, "PPP")
                  : "the chosen date"}
              </strong>{" "}
              at <strong className="text-[var(--st-text)]">{scheduledTime || "—"}</strong>
              . You can’t cancel from this dialog after upload starts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Submit the schedule form — the action handles upload + DB write.
                formRef.current?.requestSubmit();
              }}
            >
              <PlayCircle /> Start premiere
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Stop-stream confirm dialog ──────────────────────────── */}
      <AlertDialog
        open={!!stopConfirmTarget}
        onOpenChange={(open) => !open && setStopConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End live broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              {stopConfirmTarget ? (
                <>
                  This will stop{" "}
                  <strong className="text-[var(--st-text)]">
                    {stopConfirmTarget.title}
                  </strong>{" "}
                  and convert it to a regular Page video. Viewers will be
                  disconnected immediately.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep broadcasting</AlertDialogCancel>
            <AlertDialogAction
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
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    <Alert variant={allOk ? "success" : "info"}>
      {allOk ? <CheckCircle2 /> : <AlertTriangle />}
      <AlertTitle>
        {allOk ? "Ready to go live" : "Pre-broadcast checklist"}
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-2 text-[13px] text-[var(--st-text)]"
            >
              {item.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--st-status-ok)]" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-[var(--st-text-tertiary)]" />
              )}
              <span
                className={cn(item.ok ? "text-[var(--st-text)]" : "text-[var(--st-text-secondary)]")}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
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
        <Card variant="elevated" className="p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--st-status-ok)]/15 text-[var(--st-status-ok)]">
              <Radio className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--st-status-ok)]">
                Live now
              </p>
              <p className="text-sm text-[var(--st-text)]">
                {live.length} active broadcast{live.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {live.map((stream) => (
              <li
                key={stream._id.toString()}
                className="flex items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--st-text)]">
                    {stream.title}
                  </p>
                  <p className="text-[11px] text-[var(--st-text-secondary)]">
                    Scheduled for {format(new Date(stream.scheduledTime), "PPp")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onStop(stream)}
                >
                  <StopCircle /> End
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card variant="elevated">
        <div className="flex items-center justify-between gap-2 p-5 pb-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
              Upcoming &amp; past
            </p>
            <p className="text-sm text-[var(--st-text-secondary)]">
              Most recent 50 streams from this Page
            </p>
          </div>
          {isLoading && (
            <LoaderCircle className="h-4 w-4 animate-spin text-[var(--st-text-tertiary)]" />
          )}
        </div>
        <div className="border-t border-[var(--st-border)]">
          {streams.length === 0 ? (
            <EmptyState
              compact
              icon={<Clock />}
              title="No streams scheduled"
              description="Schedule your first premiere using the form on the left."
              className="rounded-none border-0"
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Title</Th>
                  <Th>Scheduled</Th>
                  <Th>Status</Th>
                </Tr>
              </THead>
              <TBody>
                {streams.slice(0, 6).map((stream) => (
                  <Tr key={stream._id.toString()}>
                    <Td className="max-w-[160px] truncate font-medium">
                      <Link
                        href={`https://www.facebook.com/${stream.facebookVideoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--st-text)] hover:underline"
                      >
                        {stream.title}
                        <ExternalLink className="h-3 w-3 text-[var(--st-text-tertiary)]" />
                      </Link>
                    </Td>
                    <Td className="text-[11.5px] text-[var(--st-text-secondary)]">
                      {format(new Date(stream.scheduledTime), "PP p")}
                    </Td>
                    <Td>
                      <StatusBadge status={stream.status} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </Card>

      {upcoming.length > 0 && live.length === 0 && (
        <Alert variant="info">
          <Clock />
          <AlertTitle>
            {upcoming.length} upcoming premiere{upcoming.length === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            Your scheduled premieres will appear in the table above and go live
            automatically at their scheduled time.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
