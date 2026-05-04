"use client";

/**
 * /dashboard/facebook/stories — Meta Suite Stories manager, ZoruUI rebuild.
 *
 * Same handlers + server actions as before (getPageStories, publishPhotoStory).
 * Visual layer: ZoruPageHeader + ZoruBreadcrumb, neutral elevated tiles,
 * ZoruDialog for create-story.
 */

import * as React from "react";
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
} from "lucide-react";

import {
  getPageStories,
  publishPhotoStory,
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
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  useZoruToast,
} from "@/components/zoruui";

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
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <ZoruSkeleton className="h-3 w-24" />
          <ZoruSkeleton className="h-8 w-48" />
          <ZoruSkeleton className="h-4 w-72" />
        </div>
        <ZoruSkeleton className="h-9 w-36 rounded-full" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ZoruSkeleton className="h-24" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-64" />
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

function StoryTile({ story }: { story: Story }) {
  const isPublished = story.status === "PUBLISHED";
  return (
    <ZoruCard variant="elevated" className="overflow-hidden">
      <div className="relative aspect-[9/16] max-h-72 overflow-hidden bg-zoru-surface-2">
        {story.url ? (
          <Image
            src={story.url}
            alt="Story"
            fill
            unoptimized
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zoru-ink-subtle">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <ZoruBadge variant="secondary">{story.media_type ?? "photo"}</ZoruBadge>
          {story.status && (
            <ZoruBadge variant={isPublished ? "success" : "ghost"}>
              {story.status}
            </ZoruBadge>
          )}
        </div>
        {story.created_time && (
          <p className="text-[11.5px] text-zoru-ink-muted">
            {formatDistanceToNow(new Date(story.created_time), {
              addSuffix: true,
            })}
          </p>
        )}
      </div>
    </ZoruCard>
  );
}

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [isPublishing, startPublishTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectIdReady, setProjectIdReady] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");

  const { toast } = useZoruToast();

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

  useEffect(() => {
    document.title = "Stories · Meta Suite · SabNode";
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("activeProjectId")
        : null;
    setProjectId(stored);
    setProjectIdReady(true);
  }, []);

  useEffect(() => {
    if (projectId) fetchStories();
  }, [projectId, fetchStories]);

  const handlePublish = () => {
    if (!projectId || !photoUrl.trim()) return;
    startPublishTransition(async () => {
      const result = await publishPhotoStory(projectId, photoUrl.trim());
      if (result.error) {
        toast({
          title: "Publish failed",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Story published",
          description: "Your photo story is live on the Page.",
        });
        setPhotoUrl("");
        setCreateOpen(false);
        fetchStories();
      }
    });
  };

  if (!projectIdReady || (isLoading && stories.length === 0 && !error)) {
    return <StoriesPageSkeleton />;
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
            <ZoruBreadcrumbPage>Stories</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Meta Suite</ZoruPageEyebrow>
          <ZoruPageTitle>Stories</ZoruPageTitle>
          <ZoruPageDescription>
            Review your active Page stories and publish a fresh photo story.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruBadge variant="secondary">
            <CircleDot />
            {stories.length} active
          </ZoruBadge>
          <ZoruButton
            onClick={() => setCreateOpen(true)}
            disabled={!projectId}
          >
            <Plus /> Create story
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
              <ZoruEmptyState
                icon={<CircleDot />}
                title="No active stories"
                description="Stories disappear after 24 hours — publish a photo story to get started."
                action={
                  <ZoruButton onClick={() => setCreateOpen(true)}>
                    <Plus /> Create story
                  </ZoruButton>
                }
              />
            )}
          </>
        )}
      </div>

      {/* ── Create-story dialog ────────────────────────────────────── */}
      <CreateStoryDialog
        open={createOpen}
        onOpenChange={(next) => {
          setCreateOpen(next);
          if (!next) setPhotoUrl("");
        }}
        photoUrl={photoUrl}
        onPhotoUrlChange={setPhotoUrl}
        onPublish={handlePublish}
        isPublishing={isPublishing}
        projectId={projectId}
      />
    </div>
  );
}

/* ── Local create-story dialog ────────────────────────────────────── */

function CreateStoryDialog({
  open,
  onOpenChange,
  photoUrl,
  onPhotoUrlChange,
  onPublish,
  isPublishing,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl: string;
  onPhotoUrlChange: (next: string) => void;
  onPublish: () => void;
  isPublishing: boolean;
  projectId: string | null;
}) {
  const trimmed = photoUrl.trim();
  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Create photo story</ZoruDialogTitle>
          <ZoruDialogDescription>
            Paste a publicly-accessible photo URL. SabNode will upload the
            photo and publish it as a Page story.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        {!projectId && (
          <ZoruAlert variant="warning">
            <ZoruAlertDescription>
              Pick a project before publishing.
            </ZoruAlertDescription>
          </ZoruAlert>
        )}

        <div className="flex flex-col gap-2">
          <ZoruLabel htmlFor="story-photo-url" required>
            Photo URL
          </ZoruLabel>
          <ZoruInput
            id="story-photo-url"
            type="url"
            value={photoUrl}
            onChange={(e) => onPhotoUrlChange(e.target.value)}
            placeholder="https://example.com/photo.jpg"
          />
          <p className="text-[11.5px] text-zoru-ink-muted">
            JPEG or PNG, hosted on a public HTTPS URL.
          </p>
        </div>

        <ZoruDialogFooter>
          <ZoruButton
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </ZoruButton>
          <ZoruButton
            type="button"
            onClick={onPublish}
            disabled={!projectId || !trimmed || isPublishing}
          >
            <Upload /> Publish story
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
