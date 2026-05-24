"use client";

import {
  Alert,
  ZoruAlertDescription,
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
  EmptyState,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  Textarea,
  useZoruToast,
  ZoruFileUploadCard,
  type ZoruFileUploadItem,
  RadioGroup,
  ZoruRadioGroupItem,
  Input,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import {
  Clock,
  ExternalLink,
  Eye,
  Film,
  Hash,
  Upload,
  MessageCircle,
  ThumbsUp,
  PlayCircle,
  Loader2,
  } from "lucide-react";

import {
  getPageReels,
  publishPageReel,
  } from "@/app/actions/facebook.actions";
import {
  presignUpload,
  confirmUpload,
  } from "@/app/actions/sabfiles.actions";

/**
 * /dashboard/facebook/reels — Meta Suite Reels manager, ZoruUI rebuild.
 *
 * Visual layer: PageHeader + Breadcrumb, neutral elevated cards
 * for the grid tiles, Dialog (built on ZoruFileUploadCard) for upload.
 */

import * as React from "react";

import {
  ErrorState,
  NoProjectState,
} from "../_components/no-project-state";

type Reel = {
  id: string;
  description?: string;
  created_time?: string;
  length?: number;
  permalink_url?: string;
  picture?: string;
  views?: number;
  likes?: { summary?: { total_count: number } } | number;
  comments?: { summary?: { total_count: number } } | number;
  video_insights?: {
    data?: Array<{ name: string; values: Array<{ value: number }> }>;
  };
};

function ReelsPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-3 w-52" />
      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <Card variant="elevated" className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-zoru-ink-subtle">
            {label}
          </p>
          <p className="mt-2 text-[26px] tracking-[-0.01em] text-zoru-ink leading-none">
            {value}
          </p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-4">
          {icon}
        </span>
      </div>
    </Card>
  );
}

function ReelTile({ reel }: { reel: Reel }) {
  const likesCount =
    typeof reel.likes === "number"
      ? reel.likes
      : reel.likes?.summary?.total_count;

  const commentsCount =
    typeof reel.comments === "number"
      ? reel.comments
      : reel.comments?.summary?.total_count;

  const watchTimeEntry = reel.video_insights?.data?.find(
    (d) => d.name === "total_video_avg_time_watched"
  );
  const avgWatchTimeSeconds =
    watchTimeEntry && watchTimeEntry.values?.[0]?.value !== undefined
      ? watchTimeEntry.values[0].value / 1000
      : undefined;

  return (
    <Card variant="elevated" className="flex flex-col overflow-hidden">
      <div className="relative aspect-[9/16] max-h-72 overflow-hidden bg-zoru-surface-2">
        {reel.picture ? (
          <Image
            src={reel.picture}
            alt={reel.description ?? "Reel thumbnail"}
            fill
            unoptimized
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zoru-ink-subtle">
            <Film className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {reel.description ? (
          <p className="line-clamp-2 text-sm text-zoru-ink">
            {reel.description}
          </p>
        ) : (
          <p className="text-sm text-zoru-ink-muted">Untitled reel</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-zoru-ink-muted">
          {reel.created_time && (
            <span>
              {formatDistanceToNow(new Date(reel.created_time), {
                addSuffix: true,
              })}
            </span>
          )}
          {typeof reel.length === "number" && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {Math.round(reel.length)}s
            </span>
          )}
          {likesCount !== undefined && (
            <span className="inline-flex items-center gap-1" title="Likes">
              <ThumbsUp className="h-3 w-3" />
              {likesCount}
            </span>
          )}
          {commentsCount !== undefined && (
            <span className="inline-flex items-center gap-1" title="Comments">
              <MessageCircle className="h-3 w-3" />
              {commentsCount}
            </span>
          )}
          {avgWatchTimeSeconds !== undefined && (
            <span className="inline-flex items-center gap-1" title="Avg Watch Time">
              <PlayCircle className="h-3 w-3" />
              {avgWatchTimeSeconds.toFixed(1)}s
            </span>
          )}
        </div>
        {reel.permalink_url && (
          <a
            href={reel.permalink_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[12px] text-zoru-ink underline-offset-4 hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> View on Facebook
          </a>
        )}
      </div>
    </Card>
  );
}

export default function ReelsPage() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectIdReady, setProjectIdReady] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const fetchReels = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const { reels: fetched, error: fetchError } = await getPageReels(
        projectId,
      );
      if (fetchError) {
        setError(fetchError);
        setReels([]);
      } else {
        setError(null);
        setReels((fetched as Reel[]) ?? []);
      }
    });
  }, [projectId]);

  useEffect(() => {
    document.title = "Reels · Meta Suite · SabNode";
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("activeProjectId")
        : null;
    setProjectId(stored);
    setProjectIdReady(true);
  }, []);

  useEffect(() => {
    if (projectId) fetchReels();
  }, [projectId, fetchReels]);

  if (!projectIdReady || (isLoading && reels.length === 0 && !error)) {
    return <ReelsPageSkeleton />;
  }

  const totalViews = reels.reduce((sum, r) => sum + (r.views ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
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
            <ZoruBreadcrumbPage>Reels</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Meta Suite</ZoruPageEyebrow>
          <ZoruPageTitle>Reels</ZoruPageTitle>
          <ZoruPageDescription>
            Browse Reels published from this Page and upload new clips.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Badge variant="secondary">
            <Film />
            {reels.length} reel{reels.length === 1 ? "" : "s"}
          </Badge>
          <Button
            onClick={() => setUploadOpen(true)}
            disabled={!projectId}
          >
            <Upload /> Upload Reel
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="mt-6 flex flex-col gap-6">
        {!projectId ? (
          <NoProjectState />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MetricTile
                label="Total reels"
                value={reels.length.toLocaleString()}
                icon={<Hash />}
              />
              <MetricTile
                label="Total views"
                value={totalViews.toLocaleString()}
                icon={<Eye />}
              />
            </div>

            {reels.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {reels.map((reel) => (
                  <ReelTile key={reel.id} reel={reel} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Film />}
                title="No reels yet"
                description="Upload your first reel to start growing your Page audience."
                action={
                  <Button onClick={() => setUploadOpen(true)}>
                    <Upload /> Upload Reel
                  </Button>
                }
              />
            )}
          </>
        )}
      </div>

      <UploadReelDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        projectId={projectId}
        onSuccess={fetchReels}
      />
    </div>
  );
}

/* ── Local upload-reel dialog ─────────────────────────────────────── */

function UploadReelDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  onSuccess: () => void;
}) {
  const [items, setItems] = useState<ZoruFileUploadItem[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [publishMode, setPublishMode] = useState<"publish" | "schedule" | "draft">("publish");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { toast } = useZoruToast();

  useEffect(() => {
    if (open) {
      setItems([]);
      setVideoUrl(null);
      setDescription("");
      setPublishMode("publish");
      setScheduleTime("");
      setFormError(null);
    }
  }, [open]);

  const handleFilesSelected = async (files: File[]) => {
    const file = files[0];
    if (!file || !projectId) return;

    const id = Math.random().toString(36).substring(7);
    setItems([{ id, file, progress: 0, status: "uploading" }]);
    setVideoUrl(null);
    setFormError(null);

    try {
      const presign = await presignUpload({
        name: file.name,
        size: file.size,
        mime: file.type,
        parent_id: projectId,
        module_id: "facebook",
      });

      if ("error" in presign) throw new Error(presign.error as string);

      const xhr = new XMLHttpRequest();
      xhr.open(presign.method, presign.upload_url);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, progress: (e.loaded / e.total) * 100 }
                : item
            )
          );
        }
      };

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error("Upload failed"));
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(file);
      });

      const confirm = await confirmUpload({
        key: presign.key,
        name: file.name,
        size: file.size,
        mime: file.type,
        parent_id: projectId,
        module_id: "facebook",
      });

      if ("error" in confirm) throw new Error(confirm.error as string);

      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, progress: 100, status: "done" } : item
        )
      );
      setVideoUrl(confirm.node?.url ?? null);
    } catch (e: any) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: "error", errorMessage: e.message }
            : item
        )
      );
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !videoUrl) return;

    setIsSubmitting(true);
    setFormError(null);

    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("videoUrl", videoUrl);
    fd.set("description", description);
    fd.set("phase", "finish");

    if (publishMode === "draft") {
      fd.set("published", "false");
    } else if (publishMode === "schedule") {
      if (!scheduleTime) {
        setFormError("Please select a schedule time.");
        setIsSubmitting(false);
        return;
      }
      const ts = Math.floor(new Date(scheduleTime).getTime() / 1000);
      fd.set("scheduledPublishTime", String(ts));
      fd.set("published", "false");
    }

    try {
      const result = await publishPageReel({}, fd);
      if (result.error) {
        setFormError(result.error);
      } else {
        toast({ title: "Reel saved", description: result.message });
        onOpenChange(false);
        onSuccess();
      }
    } catch (e: any) {
      setFormError(e.message ?? "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasUploading = items.some((i) => i.status === "uploading");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-xl">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Upload reel</ZoruDialogTitle>
          <ZoruDialogDescription>
            Pick a vertical video and add an optional caption. You can publish
            it now, schedule it, or save it as a draft.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <form onSubmit={handlePublish} className="flex flex-col gap-4">
          {formError && (
            <Alert variant="destructive">
              <ZoruAlertDescription>{formError}</ZoruAlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="reel-description">Caption</Label>
            <Textarea
              id="reel-description"
              name="description"
              rows={3}
              placeholder="Write a caption for this reel…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label required>Video file</Label>
            <ZoruFileUploadCard
              accept="video/*"
              multiple={false}
              items={items}
              onFilesSelected={handleFilesSelected}
              onRemove={(id) => {
                setItems((prev) => prev.filter((i) => i.id !== id));
                setVideoUrl(null);
              }}
              disabled={isSubmitting || hasUploading}
              hint="MP4 / MOV — vertical 9:16 recommended"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Publishing options</Label>
            <RadioGroup
              value={publishMode}
              onValueChange={(val: any) => setPublishMode(val)}
              disabled={isSubmitting}
            >
              <div className="flex items-center space-x-2">
                <ZoruRadioGroupItem value="publish" id="r-publish" />
                <Label htmlFor="r-publish" className="font-normal cursor-pointer">
                  Publish now
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <ZoruRadioGroupItem value="schedule" id="r-schedule" />
                <Label htmlFor="r-schedule" className="font-normal cursor-pointer">
                  Schedule
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <ZoruRadioGroupItem value="draft" id="r-draft" />
                <Label htmlFor="r-draft" className="font-normal cursor-pointer">
                  Save as draft
                </Label>
              </div>
            </RadioGroup>
          </div>

          {publishMode === "schedule" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="schedule-time" required>Schedule Time</Label>
              <Input
                id="schedule-time"
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          )}

          <ZoruDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!projectId || !videoUrl || hasUploading || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Upload /> {publishMode === "publish" ? "Publish reel" : "Save reel"}
                </>
              )}
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
