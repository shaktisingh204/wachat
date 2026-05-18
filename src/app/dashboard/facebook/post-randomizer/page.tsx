"use client";

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
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
  ZoruSwitch,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from "react";
import Image from "next/image";
import { Edit,
  Loader2,
  PlusCircle,
  Repeat,
  Save,
  Trash2 } from "lucide-react";

import { getProjectById } from "@/app/actions/project.actions";
import {
  deleteRandomizerPost,
  getRandomizerPosts,
  saveRandomizerSettings,
  } from "@/app/actions/facebook.actions";
import type {
  PostRandomizerSettings,
  RandomizerPost,
  WithId,
  } from "@/lib/definitions";
import { useProject } from "@/context/project-context";

/**
 * /dashboard/facebook/post-randomizer — Auto-rotate post pool, ZoruUI rebuild.
 *
 * Same handlers + server actions (`saveRandomizerSettings`,
 * `getRandomizerPosts`, `addRandomizerPost`, `deleteRandomizerPost`).
 * Uses `useProject` for project context and FeatureLock for plan gating.
 * Visual layer: ZoruPageHeader + ZoruBreadcrumb, two-column layout
 * (settings card + content pool list), CreateRandomizerPostDialog.
 */

import * as React from "react";

import { CreateRandomizerPostDialog } from "../_components/create-randomizer-post-dialog";
import { FeatureLock, FeatureLockOverlay } from "../_components/feature-lock";
import { NoProjectState } from "../_components/no-project-state";

/* ── skeleton ────────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex flex-col gap-2">
        <ZoruSkeleton className="h-3 w-24" />
        <ZoruSkeleton className="h-8 w-56" />
        <ZoruSkeleton className="h-4 w-72" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ZoruSkeleton className="h-64" />
        <div className="lg:col-span-2">
          <ZoruSkeleton className="h-72" />
        </div>
      </div>
    </div>
  );
}

/* ── pool item ───────────────────────────────────────────────────── */

function RandomizerPostCard({
  post,
  onDelete,
  isDeleting,
}: {
  post: WithId<RandomizerPost>;
  onDelete: (postId: string) => void;
  isDeleting: boolean;
}) {
  return (
    <ZoruCard className="overflow-hidden">
      <ZoruCardContent className="flex gap-4 p-4">
        {post.imageUrl && (
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2">
            <Image
              src={post.imageUrl}
              alt="Pool post image"
              fill
              sizes="96px"
              unoptimized
              className="object-cover"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-4 text-sm text-zoru-ink-muted">
            {post.message}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <ZoruButton
            variant="ghost"
            size="icon-sm"
            disabled
            aria-label="Edit pool post"
          >
            <Edit />
          </ZoruButton>
          <ZoruButton
            variant="ghost"
            size="icon-sm"
            aria-label="Remove from pool"
            onClick={() => onDelete(post._id.toString())}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </ZoruButton>
        </div>
      </ZoruCardContent>
    </ZoruCard>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

export default function PostRandomizerPage() {
  const { activeProject, isLoadingProject, sessionUser } = useProject();

  const [posts, setPosts] = useState<WithId<RandomizerPost>[]>([]);
  const [settings, setSettings] = useState<PostRandomizerSettings>({
    enabled: false,
    frequencyHours: 24,
  });
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useZoruToast();

  const isAllowed = sessionUser?.plan?.features?.liveChat ?? false;

  useEffect(() => {
    document.title = "Post randomizer · Meta Suite · SabNode";
  }, []);

  const fetchData = useCallback(() => {
    if (!activeProject) return;
    startLoading(async () => {
      const [projectData, postsData] = await Promise.all([
        getProjectById(activeProject._id.toString()),
        getRandomizerPosts(activeProject._id.toString()),
      ]);
      if (projectData?.postRandomizer) {
        setSettings(projectData.postRandomizer);
      }
      setPosts(postsData);
    });
  }, [activeProject]);

  useEffect(() => {
    if (activeProject) fetchData();
  }, [activeProject, fetchData]);

  const handleSettingsChange = <K extends keyof PostRandomizerSettings>(
    field: K,
    value: PostRandomizerSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveSettings = () => {
    if (!activeProject) return;

    const formData = new FormData();
    formData.append("projectId", activeProject._id.toString());
    formData.append("enabled", settings.enabled ? "on" : "off");
    formData.append("frequencyHours", String(settings.frequencyHours));

    startSaving(async () => {
      const result = await saveRandomizerSettings(null, formData);
      if (result.error) {
        toast({
          title: "Could not save settings",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Settings saved",
          description: "Randomizer schedule updated.",
        });
        fetchData();
      }
    });
  };

  const handleDeletePost = (postId: string) => {
    if (!activeProject) return;
    setDeletingId(postId);
    startDeleting(async () => {
      const result = await deleteRandomizerPost(
        postId,
        activeProject._id.toString(),
      );
      if (result.success) {
        toast({
          title: "Removed from pool",
          description: "The post has been removed.",
        });
        fetchData();
      } else {
        toast({
          title: "Could not remove post",
          description: result.error ?? "Try again in a moment.",
          variant: "destructive",
        });
      }
      setDeletingId(null);
    });
  };

  if (isLoadingProject) return <PageSkeleton />;

  if (!activeProject) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <NoProjectState />
      </div>
    );
  }

  return (
    <>
      {activeProject && (
        <CreateRandomizerPostDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          project={activeProject}
          onPostAdded={fetchData}
        />
      )}

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
              <ZoruBreadcrumbPage>Post randomizer</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </ZoruBreadcrumb>

        <ZoruPageHeader bordered={false} className="mt-5">
          <ZoruPageHeading>
            <ZoruPageEyebrow>Meta Suite</ZoruPageEyebrow>
            <ZoruPageTitle>Post randomizer</ZoruPageTitle>
            <ZoruPageDescription>
              Automatically publish a random post from your content pool at a
              set interval.
            </ZoruPageDescription>
          </ZoruPageHeading>
          <ZoruPageActions>
            <ZoruBadge variant={settings.enabled ? "success" : "ghost"}>
              <Repeat />
              {settings.enabled ? "Active" : "Paused"}
            </ZoruBadge>
            <ZoruButton onClick={() => setIsDialogOpen(true)} disabled={!isAllowed}>
              <PlusCircle /> Add to pool
            </ZoruButton>
          </ZoruPageActions>
        </ZoruPageHeader>

        <div className="relative mt-6">
          <FeatureLockOverlay
            isAllowed={isAllowed}
            featureName="Post Randomizer"
          />
          <FeatureLock isAllowed={isAllowed}>
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
              {/* ── Settings ──────────────────────────────────────── */}
              <ZoruCard className="lg:col-span-1">
                <ZoruCardHeader>
                  <ZoruCardTitle>Settings</ZoruCardTitle>
                  <ZoruCardDescription>
                    Configure the randomizer schedule.
                  </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface px-4 py-3">
                    <div className="flex flex-col">
                      <ZoruLabel
                        htmlFor="enabled-switch"
                        className="font-semibold"
                      >
                        Enable randomizer
                      </ZoruLabel>
                      <span className="text-[12px] text-zoru-ink-muted">
                        Turn on automatic posting.
                      </span>
                    </div>
                    <ZoruSwitch
                      id="enabled-switch"
                      checked={settings.enabled}
                      onCheckedChange={(checked) =>
                        handleSettingsChange("enabled", checked)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <ZoruLabel htmlFor="frequency">
                      Post every (hours)
                    </ZoruLabel>
                    <ZoruInput
                      id="frequency"
                      type="number"
                      min={1}
                      value={settings.frequencyHours}
                      onChange={(e) =>
                        handleSettingsChange(
                          "frequencyHours",
                          Number.parseInt(e.target.value, 10) || 1,
                        )
                      }
                    />
                    <p className="text-[11px] text-zoru-ink-subtle">
                      Minimum 1 hour. Posts are picked at random from the pool.
                    </p>
                  </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                  <ZoruButton
                    className="w-full"
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                    Save settings
                  </ZoruButton>
                </ZoruCardFooter>
              </ZoruCard>

              {/* ── Content pool ──────────────────────────────────── */}
              <ZoruCard className="lg:col-span-2">
                <ZoruCardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <ZoruCardTitle>Content pool</ZoruCardTitle>
                      <ZoruCardDescription>
                        Posts that will be randomly selected for publishing.
                      </ZoruCardDescription>
                    </div>
                    <ZoruButton
                      size="sm"
                      onClick={() => setIsDialogOpen(true)}
                    >
                      <PlusCircle /> Add post
                    </ZoruButton>
                  </div>
                </ZoruCardHeader>
                <ZoruCardContent>
                  {isLoading ? (
                    <div className="flex flex-col gap-3">
                      <ZoruSkeleton className="h-24 w-full" />
                      <ZoruSkeleton className="h-24 w-full" />
                      <ZoruSkeleton className="h-24 w-full" />
                    </div>
                  ) : posts.length > 0 ? (
                    <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
                      {posts.map((post) => (
                        <RandomizerPostCard
                          key={post._id.toString()}
                          post={post}
                          onDelete={handleDeletePost}
                          isDeleting={
                            isDeleting && deletingId === post._id.toString()
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <ZoruEmptyState
                      icon={<Repeat />}
                      title="Your content pool is empty"
                      description="Add some posts to start rotating them automatically."
                      action={
                        <ZoruButton onClick={() => setIsDialogOpen(true)}>
                          <PlusCircle /> Add post
                        </ZoruButton>
                      }
                    />
                  )}
                </ZoruCardContent>
              </ZoruCard>
            </div>
          </FeatureLock>
        </div>
      </div>
    </>
  );
}
