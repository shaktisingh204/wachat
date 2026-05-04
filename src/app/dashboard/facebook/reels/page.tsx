"use client";

/**
 * /dashboard/facebook/reels — Meta Suite Reels manager, ZoruUI rebuild.
 *
 * Same handlers + server actions as before (getPageReels, publishPageReel).
 * Visual layer: ZoruPageHeader + ZoruBreadcrumb, neutral elevated cards
 * for the grid tiles, ZoruDialog (built on ZoruFileUploadCard) for upload.
 */

import * as React from "react";
import {
  useActionState,
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
} from "lucide-react";

import {
  getPageReels,
  publishPageReel,
} from "@/app/actions/facebook.actions";

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  ZoruTextarea,
  useZoruToast,
} from "@/components/zoruui";

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
};

type UploadState = { message?: string; error?: string };
const INITIAL_UPLOAD_STATE: UploadState = {};

function ReelsPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <ZoruSkeleton className="h-3 w-24" />
          <ZoruSkeleton className="h-8 w-48" />
          <ZoruSkeleton className="h-4 w-72" />
        </div>
        <ZoruSkeleton className="h-9 w-32 rounded-full" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ZoruSkeleton className="h-24" />
        <ZoruSkeleton className="h-24" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-72" />
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
    <ZoruCard variant="elevated" className="p-5">
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
    </ZoruCard>
  );
}

function ReelTile({ reel }: { reel: Reel }) {
  return (
    <ZoruCard variant="elevated" className="flex flex-col overflow-hidden">
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
    </ZoruCard>
  );
}

export default function ReelsPage() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectIdReady, setProjectIdReady] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const [uploadState, uploadAction] = useActionState(
    publishPageReel,
    INITIAL_UPLOAD_STATE,
  );
  const { toast } = useZoruToast();

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

  // Surface upload server action result via toast + close dialog on success.
  useEffect(() => {
    if (uploadState?.message) {
      toast({ title: "Reel published", description: uploadState.message });
      setUploadOpen(false);
      fetchReels();
    } else if (uploadState?.error) {
      toast({
        title: "Upload failed",
        description: uploadState.error,
        variant: "destructive",
      });
    }
  }, [uploadState, toast, fetchReels]);

  if (!projectIdReady || (isLoading && reels.length === 0 && !error)) {
    return <ReelsPageSkeleton />;
  }

  const totalViews = reels.reduce((sum, r) => sum + (r.views ?? 0), 0);

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
            <ZoruBreadcrumbPage>Reels</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Meta Suite</ZoruPageEyebrow>
          <ZoruPageTitle>Reels</ZoruPageTitle>
          <ZoruPageDescription>
            Browse Reels published from this Page and upload new clips.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruBadge variant="secondary">
            <Film />
            {reels.length} reel{reels.length === 1 ? "" : "s"}
          </ZoruBadge>
          <ZoruButton
            onClick={() => setUploadOpen(true)}
            disabled={!projectId}
          >
            <Upload /> Upload Reel
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

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
              <ZoruEmptyState
                icon={<Film />}
                title="No reels yet"
                description="Upload your first reel to start growing your Page audience."
                action={
                  <ZoruButton onClick={() => setUploadOpen(true)}>
                    <Upload /> Upload Reel
                  </ZoruButton>
                }
              />
            )}
          </>
        )}
      </div>

      {/* ── Upload reel dialog ─────────────────────────────────────── */}
      <UploadReelDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        projectId={projectId}
        action={uploadAction}
        state={uploadState}
      />
    </div>
  );
}

/* ── Local upload-reel dialog (form posts to server action) ───────── */

function UploadReelDialog({
  open,
  onOpenChange,
  projectId,
  action,
  state,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  action: (payload: FormData) => void;
  state: UploadState;
}) {
  const [file, setFile] = useState<File | null>(null);

  // Reset selected file whenever the dialog closes.
  useEffect(() => {
    if (!open) setFile(null);
  }, [open]);

  // Clear file once a successful upload comes back.
  useEffect(() => {
    if (state?.message) setFile(null);
  }, [state?.message]);

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-xl">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Upload reel</ZoruDialogTitle>
          <ZoruDialogDescription>
            Pick a vertical video and add an optional caption — it will be
            published immediately to your Page.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="projectId" value={projectId ?? ""} />

          {state?.error && (
            <ZoruAlert variant="destructive">
              <ZoruAlertDescription>{state.error}</ZoruAlertDescription>
            </ZoruAlert>
          )}

          <div className="flex flex-col gap-2">
            <ZoruLabel htmlFor="reel-description">Caption</ZoruLabel>
            <ZoruTextarea
              id="reel-description"
              name="description"
              rows={3}
              placeholder="Write a caption for this reel…"
            />
          </div>

          <div className="flex flex-col gap-2">
            <ZoruLabel htmlFor="reel-video" required>
              Video file
            </ZoruLabel>
            <label
              htmlFor="reel-video"
              className="flex flex-col items-center gap-2 rounded-[var(--zoru-radius-lg)] border border-dashed border-zoru-line bg-zoru-bg p-8 text-center transition-colors hover:border-zoru-line-strong hover:bg-zoru-surface focus-within:border-zoru-ink"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                <Upload className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium text-zoru-ink">
                {file ? file.name : "Click to pick a video"}
              </span>
              <span className="text-xs text-zoru-ink-muted">
                MP4 / MOV — vertical 9:16 recommended
              </span>
              <input
                id="reel-video"
                name="videoFile"
                type="file"
                accept="video/*"
                required
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <ZoruButton type="submit" disabled={!projectId || !file}>
              <Upload /> Publish reel
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
