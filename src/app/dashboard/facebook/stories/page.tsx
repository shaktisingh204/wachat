"use client";

import { Alert, AlertDescription, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, Input, Label, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle, Skeleton, useToast } from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import {
  CircleDot,
  Hash,
  Image as ImageIcon,
  Plus,
  Upload,
  Link,
  Video,
} from "lucide-react";

import {
  getPageStories,
  publishPhotoStory,
  publishVideoStory,
} from "@/app/actions/facebook.actions";
import { uploadLibraryFile } from "@/app/actions/files.actions";
import { FileUploadCard, FileUploadItem } from '@/components/sabcrm/20ui';
import { RadioGroup, RadioCard } from '@/components/sabcrm/20ui';
import { useProject } from "@/context/project-context";

/**
 * /dashboard/facebook/stories — Meta Suite Stories manager, Ui20 rebuild.
 *
 * Same handlers + server actions as before (getPageStories, publishPhotoStory).
 * Visual layer: PageHeader + Breadcrumb, neutral elevated tiles,
 * Dialog for create-story.
 */

import * as React from "react";

import {
  ErrorState,
  NoProjectState,
} from "../_components/no-project-state";

type Story = {
  id: string;
  url?: string;
  media_type?: string;
  status?: string;
  created_time?: string;
};

function StoriesPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-3 w-52" />
      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-24" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
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
          <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
            {label}
          </p>
          <p className="mt-2 text-[26px] tracking-[-0.01em] text-[var(--st-text)] leading-none">
            {value}
          </p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)] [&_svg]:size-4">
          {icon}
        </span>
      </div>
    </Card>
  );
}

function StoryTile({ story }: { story: Story }) {
  const isPublished = story.status === "PUBLISHED";
  return (
    <Card variant="elevated" className="overflow-hidden">
      <div className="relative aspect-[9/16] max-h-72 overflow-hidden bg-[var(--st-bg-muted)]">
        {story.url ? (
          story.media_type === "video" || story.url.includes(".mp4") ? (
            <video
              src={story.url}
              className="h-full w-full object-cover"
              controls={false}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <Image
              src={story.url}
              alt="Story"
              fill
              unoptimized
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              className="object-cover"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--st-text-tertiary)]">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">{story.media_type ?? "photo"}</Badge>
          {story.status && (
            <Badge variant={isPublished ? "success" : "secondary"}>
              {story.status}
            </Badge>
          )}
        </div>
        {story.created_time && (
          <p className="text-[11.5px] text-[var(--st-text-secondary)]">
            {formatDistanceToNow(new Date(story.created_time), {
              addSuffix: true,
            })}
          </p>
        )}
      </div>
    </Card>
  );
}

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectIdReady, setProjectIdReady] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { toast } = useToast();

  const fetchStories = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const { stories: fetched, error: fetchError } = await getPageStories(
        projectId,
      );
      if (fetchError) {
        setError(fetchError);
        setStories([]);
      } else {
        setError(null);
        setStories((fetched as Story[]) ?? []);
      }
    });
  }, [projectId]);

  const { activeProjectId } = useProject();

  useEffect(() => {
    document.title = "Stories · Meta Suite · SabNode";
    if (activeProjectId !== undefined) {
      setProjectId(activeProjectId);
      setProjectIdReady(true);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (projectId) fetchStories();
  }, [projectId, fetchStories]);

  const handleSuccess = () => {
    setCreateOpen(false);
    fetchStories();
  };

  if (!projectIdReady || (isLoading && stories.length === 0 && !error)) {
    return <StoriesPageSkeleton />;
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
            <BreadcrumbPage>Stories</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <PageHeading>
          <PageEyebrow>Meta Suite</PageEyebrow>
          <PageTitle>Stories</PageTitle>
          <PageDescription>
            Review your active Page stories and publish a fresh photo story.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Badge variant="secondary">
            <CircleDot />
            {stories.length} active
          </Badge>
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={!projectId}
          >
            <Plus /> Create story
          </Button>
        </PageActions>
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
                label="Active stories"
                value={stories.length.toLocaleString()}
                icon={<Hash />}
              />
            </div>

            {stories.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {stories.map((story) => (
                  <StoryTile key={story.id} story={story} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<CircleDot />}
                title="No active stories"
                description="Stories disappear after 24 hours — publish a photo story to get started."
                action={
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus /> Create story
                  </Button>
                }
              />
            )}
          </>
        )}
      </div>

      {/* ── Create-story dialog ────────────────────────────────────── */}
      <CreateStoryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleSuccess}
        projectId={projectId}
      />
    </div>
  );
}

/* ── Local create-story dialog ────────────────────────────────────── */

function CreateStoryDialog({
  open,
  onOpenChange,
  onSuccess,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  projectId: string | null;
}) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [url, setUrl] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploadedMime, setUploadedMime] = useState("");
  const [items, setItems] = useState<FileUploadItem[]>([]);
  const [isPublishing, startPublishTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setMode("upload");
      setUrl("");
      setUploadedUrl("");
      setUploadedMime("");
      setItems([]);
    }
  }, [open]);

  const handleFilesSelected = (files: File[]) => {
    const file = files[0];
    if (!file) return;

    const id = Math.random().toString(36).slice(2);
    setItems([{ id, file, progress: 50, status: "uploading" }]);
    setUploadedUrl("");
    setUploadedMime("");

    const fd = new FormData();
    fd.append("file", file);

    uploadLibraryFile(fd)
      .then((res) => {
        setItems((prev) =>
          prev.map((i) =>
            i.id === id ? { ...i, progress: 100, status: "done" } : i
          )
        );
        setUploadedUrl(res.url);
        setUploadedMime(res.mimeType);
      })
      .catch((err) => {
        setItems((prev) =>
          prev.map((i) =>
            i.id === id
              ? { ...i, status: "error", errorMessage: err.message }
              : i
          )
        );
      });
  };

  const handlePublish = () => {
    if (!projectId) return;

    const targetUrl = mode === "url" ? url.trim() : uploadedUrl;
    if (!targetUrl) return;

    startPublishTransition(async () => {
      let isVideo = false;
      if (mode === "upload") {
        isVideo = uploadedMime.startsWith("video/");
      } else {
        isVideo = targetUrl.match(/\.(mp4|mov|webm)$/i) !== null;
      }

      const result = isVideo
        ? await publishVideoStory(projectId, targetUrl)
        : await publishPhotoStory(projectId, targetUrl);

      if (result.error) {
        toast({
          title: "Publish failed",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Story published",
          description: `Your ${isVideo ? "video" : "photo"} story is live on the Page.`,
        });
        onSuccess();
      }
    });
  };

  const isReady =
    mode === "url" ? url.trim().length > 0 : uploadedUrl.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create story</DialogTitle>
          <DialogDescription>
            Upload a photo or video, or paste a publicly-accessible URL.
            SabNode will publish it as a Page story.
          </DialogDescription>
        </DialogHeader>

        {!projectId && (
          <Alert variant="warning">
            <AlertDescription>
              Pick a project before publishing.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4 py-2">
          <RadioGroup
            value={mode}
            onValueChange={(val) => setMode(val as "upload" | "url")}
            className="grid grid-cols-2"
          >
            <RadioCard
              value="upload"
              label="Upload file"
              icon={<Upload className="h-4 w-4" />}
            />
            <RadioCard
              value="url"
              label="Paste URL"
              icon={<Link className="h-4 w-4" />}
            />
          </RadioGroup>

          {mode === "upload" ? (
            <div className="flex flex-col gap-2">
              <FileUploadCard
                accept="image/jpeg, image/png, video/mp4"
                multiple={false}
                maxSize={50 * 1024 * 1024}
                hint="JPEG, PNG, or MP4 up to 50MB"
                items={items}
                onFilesSelected={handleFilesSelected}
                onRemove={() => {
                  setItems([]);
                  setUploadedUrl("");
                  setUploadedMime("");
                }}
                disabled={isPublishing}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="story-url" required>
                Media URL
              </Label>
              <Input
                id="story-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/media.jpg"
                disabled={isPublishing}
              />
              <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                JPEG, PNG, or MP4 hosted on a public HTTPS URL.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPublishing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handlePublish}
            disabled={!projectId || !isReady || isPublishing}
          >
            <Upload /> Publish story
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
