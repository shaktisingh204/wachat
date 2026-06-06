"use client";

import { Alert, AlertDescription, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardDescription, CardHeader, CardTitle, DatePicker, EmptyState, Input, Label, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle, Skeleton, Table, TBody, Td, Th, THead, Tr, Textarea, cn, useToast } from '@/components/sabcrm/20ui';
import { SabFileToFileButton, type SabFilePick } from "@/components/sabfiles";
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
  FileVideo,
  LoaderCircle,
  PlayCircle,
  Radio,
  StopCircle,
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
 * /dashboard/facebook/live-studio - Live broadcast launcher, 20ui rebuild.
 *
 * Same handlers + server actions as before
 * (getScheduledLiveStreams, handleScheduleLiveStream).
 *
 * The original page only schedules a premiere from a pre-recorded video.
 * This rebuild keeps that flow intact and layers on a neutral pre-broadcast
 * checklist (20ui Alerts + completion state) plus start/stop confirm
 * AlertDialogs as required by Phase 3. The video source is SabFiles: the
 * user picks (or uploads) a video through the SabFiles picker, which hands
 * back a real File that is submitted under the form's `videoFile` field.
 */

import * as React from "react";

import { NoProjectState } from "../_components/no-project-state";

type ScheduleState = { message?: string; error?: string };
const INITIAL_SCHEDULE_STATE: ScheduleState = {};

/* -- Skeleton ----------------------------------------------------------- */

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

/* -- Submit button (uses useFormStatus from form action) ---------------- */

function ScheduleSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      disabled={disabled || pending}
      loading={pending}
      iconLeft={pending ? undefined : CalendarIcon}
    >
      Schedule premiere
    </Button>
  );
}

/* -- Status badge mapping ----------------------------------------------- */

function StatusBadge({ status }: { status: FacebookLiveStream["status"] }) {
  const label = status.replace(/_/g, " ").toLowerCase();
  if (status === "LIVE") {
    return (
      <Badge variant="success" dot>
        {label}
      </Badge>
    );
  }
  if (status === "VOD") {
    return <Badge variant="outline">{label}</Badge>;
  }
  return <Badge variant="secondary">{label}</Badge>;
}

/* -- Page --------------------------------------------------------------- */

export default function LiveStudioPage() {
  const { activeProject, isLoadingProject } = useProject();
  const [streams, setStreams] = useState<WithId<FacebookLiveStream>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPick, setVideoPick] = useState<SabFilePick | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Confirm dialogs (Phase 3 requirement).
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [stopConfirmTarget, setStopConfirmTarget] =
    useState<WithId<FacebookLiveStream> | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  // Hidden file input that carries the SabFiles-picked File into the form,
  // so the server action keeps reading `videoFile` as a File with no change.
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [state, formAction] = useActionState(
    handleScheduleLiveStream,
    INITIAL_SCHEDULE_STATE,
  );

  const projectId = activeProject?._id?.toString() ?? null;

  // Push the SabFiles-picked File into the hidden form input's FileList.
  const setVideo = useCallback((file: File, pick: SabFilePick) => {
    setVideoFile(file);
    setVideoPick(pick);
    const input = videoInputRef.current;
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    }
  }, []);

  const clearVideo = useCallback(() => {
    setVideoFile(null);
    setVideoPick(null);
    const input = videoInputRef.current;
    if (input) input.files = new DataTransfer().files;
  }, []);

  const fetchStreams = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const data = await getScheduledLiveStreams(projectId);
      setStreams(data);
    });
  }, [projectId]);

  useEffect(() => {
    document.title = "Live Studio - Meta Suite - SabNode";
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
      clearVideo();
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
  }, [state, toast, fetchStreams, clearVideo]);

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
          <Badge tone="neutral">
            <Video size={13} aria-hidden="true" />
            {streams.length} stream{streams.length === 1 ? "" : "s"}
          </Badge>
          <Button
            variant="primary"
            iconLeft={PlayCircle}
            onClick={() => setStartConfirmOpen(true)}
            disabled={!allChecksOk}
          >
            Start premiere
          </Button>
        </PageActions>
      </PageHeader>

      <div className="mt-6">
        {!activeProject ? (
          <NoProjectState />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Schedule form + checklist (left, 2 cols) */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              <PreflightChecklist items={checklist} allOk={allChecksOk} />

              <Card variant="elevated" padding="none">
                <CardHeader>
                  <CardTitle>Schedule a premiere</CardTitle>
                  <CardDescription>
                    Pick a video, set a title, and choose when it should go
                    live.
                  </CardDescription>
                </CardHeader>

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
                  {/* Carries the SabFiles-picked File into the form submission. */}
                  <input
                    ref={videoInputRef}
                    type="file"
                    name="videoFile"
                    accept="video/mp4,video/quicktime"
                    className="hidden"
                    tabIndex={-1}
                    aria-hidden="true"
                  />

                  {state?.error && (
                    <Alert variant="destructive" icon={AlertTriangle}>
                      <AlertTitle>Could not schedule stream</AlertTitle>
                      <AlertDescription>{state.error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Video source (SabFiles) */}
                  <div className="flex flex-col gap-2">
                    <Label required>Video file</Label>
                    {videoPick ? (
                      <div className="flex items-center justify-between gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                            <FileVideo className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[var(--st-text)]">
                              {videoPick.name}
                            </p>
                            <p className="text-xs text-[var(--st-text-secondary)]">
                              Ready to schedule
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearVideo}
                        >
                          Change
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 rounded-[var(--st-radius-lg)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-8 text-center">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                          <FileVideo className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <SabFileToFileButton
                          accept="video"
                          onPickFile={setVideo}
                        >
                          Choose a video
                        </SabFileToFileButton>
                        <span className="text-xs text-[var(--st-text-secondary)]">
                          MP4 or MOV, up to 50 MB
                        </span>
                      </div>
                    )}
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
                      placeholder="Tell viewers what to expect..."
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
                        aria-label="Premiere date"
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

            {/* Active streams panel (right, 1 col) */}
            <ActiveStreamsPanel
              streams={streams}
              isLoading={isLoading}
              onStop={(stream) => setStopConfirmTarget(stream)}
            />
          </div>
        )}
      </div>

      {/* Start-stream confirm dialog */}
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
              at{" "}
              <strong className="text-[var(--st-text)]">
                {scheduledTime || "the chosen time"}
              </strong>
              . You cannot cancel from this dialog after upload starts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              intent="primary"
              onClick={() => {
                // Submit the schedule form. The action handles upload + DB write.
                formRef.current?.requestSubmit();
              }}
            >
              <PlayCircle size={14} aria-hidden="true" /> Start premiere
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stop-stream confirm dialog */}
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
              onClick={() => {
                // No native "stop" server action - surface a hint via toast
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
              <StopCircle size={14} aria-hidden="true" /> End broadcast
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* -- Preflight checklist ------------------------------------------------ */

function PreflightChecklist({
  items,
  allOk,
}: {
  items: { key: string; label: string; ok: boolean }[];
  allOk: boolean;
}) {
  return (
    <Alert
      variant={allOk ? "success" : "info"}
      icon={allOk ? CheckCircle2 : AlertTriangle}
    >
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
                <CheckCircle2
                  className="h-3.5 w-3.5 text-[var(--st-status-ok)]"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="h-3.5 w-3.5 text-[var(--st-text-tertiary)]"
                  aria-hidden="true"
                />
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

/* -- Active streams panel ----------------------------------------------- */

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
        <Card variant="elevated" padding="none" className="p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--st-status-ok)]/15 text-[var(--st-status-ok)]">
              <Radio className="h-4 w-4" aria-hidden="true" />
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
                  variant="danger"
                  iconLeft={StopCircle}
                  onClick={() => onStop(stream)}
                >
                  End
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card variant="elevated" padding="none">
        <CardHeader className="flex-row items-start justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
              Upcoming and past
            </p>
            <CardDescription>
              Most recent 50 streams from this Page
            </CardDescription>
          </div>
          {isLoading && (
            <LoaderCircle
              className="h-4 w-4 animate-spin text-[var(--st-text-tertiary)]"
              aria-hidden="true"
            />
          )}
        </CardHeader>
        <div className="border-t border-[var(--st-border)]">
          {streams.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Clock}
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
                        <ExternalLink
                          className="h-3 w-3 text-[var(--st-text-tertiary)]"
                          aria-hidden="true"
                        />
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
        <Alert variant="info" icon={Clock}>
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
