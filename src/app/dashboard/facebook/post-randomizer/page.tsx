"use client";

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  EmptyState,
  Input,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  Switch,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
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
 * Visual layer: PageHeader + Breadcrumb, two-column layout
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
      <Skeleton className="h-3 w-52" />
      <div className="mt-5 flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-64" />
        <div className="lg:col-span-2">
          <Skeleton className="h-72" />
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
    <Card className="overflow-hidden">
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
          <Button
            variant="ghost"
            size="icon-sm"
            disabled
            aria-label="Edit pool post"
          >
            <Edit />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remove from pool"
            onClick={() => onDelete(post._id.toString())}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        </div>
      </ZoruCardContent>
    </Card>
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

  const isAllowed = sessionUser?.plan?.features?.postRandomizer ?? false;

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
    if (settings.blackoutStart) {
      formData.append("blackoutStart", settings.blackoutStart);
    }
    if (settings.blackoutEnd) {
      formData.append("blackoutEnd", settings.blackoutEnd);
    }

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

  const getNextScheduledTime = () => {
    if (!settings.enabled) return null;
    let baseTime = settings.lastPostedAt ? new Date(settings.lastPostedAt) : new Date();
    if (settings.lastPostedAt) {
      baseTime.setHours(baseTime.getHours() + settings.frequencyHours);
    }
    // We don't do complex blackout calculation on frontend, just show baseTime
    return baseTime;
  };

  const nextScheduled = getNextScheduledTime();

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
              <ZoruBreadcrumbPage>Post randomizer</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </Breadcrumb>

        <PageHeader bordered={false} className="mt-5">
          <ZoruPageHeading>
            <ZoruPageEyebrow>Meta Suite</ZoruPageEyebrow>
            <ZoruPageTitle>Post randomizer</ZoruPageTitle>
            <ZoruPageDescription>
              Automatically publish a random post from your content pool at a
              set interval.
            </ZoruPageDescription>
          </ZoruPageHeading>
          <ZoruPageActions>
            <Badge variant={settings.enabled ? "success" : "ghost"}>
              <Repeat />
              {settings.enabled ? "Active" : "Paused"}
            </Badge>
            <Button onClick={() => setIsDialogOpen(true)} disabled={!isAllowed}>
              <PlusCircle /> Add to pool
            </Button>
          </ZoruPageActions>
        </PageHeader>

        <div className="relative mt-6">
          <FeatureLockOverlay
            isAllowed={isAllowed}
            featureName="Post Randomizer"
          />
          <FeatureLock isAllowed={isAllowed}>
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
              {/* ── Settings ──────────────────────────────────────── */}
              <Card className="lg:col-span-1">
                <ZoruCardHeader>
                  <ZoruCardTitle>Settings</ZoruCardTitle>
                  <ZoruCardDescription>
                    Configure the randomizer schedule.
                  </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface px-4 py-3">
                    <div className="flex flex-col">
                      <Label
                        htmlFor="enabled-switch"
                        className="font-semibold"
                      >
                        Enable randomizer
                      </Label>
                      <span className="text-[12px] text-zoru-ink-muted">
                        Turn on automatic posting.
                      </span>
                    </div>
                    <Switch
                      id="enabled-switch"
                      checked={settings.enabled}
                      onCheckedChange={(checked) =>
                        handleSettingsChange("enabled", checked)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="frequency">
                      Post every (hours)
                    </Label>
                    <Input
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
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="blackoutStart">
                      Blackout Start (HH:MM)
                    </Label>
                    <Input
                      id="blackoutStart"
                      type="time"
                      value={settings.blackoutStart || ""}
                      onChange={(e) =>
                        handleSettingsChange("blackoutStart", e.target.value)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="blackoutEnd">
                      Blackout End (HH:MM)
                    </Label>
                    <Input
                      id="blackoutEnd"
                      type="time"
                      value={settings.blackoutEnd || ""}
                      onChange={(e) =>
                        handleSettingsChange("blackoutEnd", e.target.value)
                      }
                    />
                    <p className="text-[11px] text-zoru-ink-subtle">
                      Randomizer will pause posting during this time window.
                    </p>
                  </div>
                  {settings.enabled && nextScheduled && (
                    <div className="mt-2 rounded-md bg-zoru-surface-2 p-3 text-sm">
                      <p className="font-semibold text-zoru-ink">Next scheduled post:</p>
                      <p className="text-zoru-ink-muted">
                        ~{nextScheduled.toLocaleString()}
                        {(settings.blackoutStart || settings.blackoutEnd) && " (may be delayed by blackout hours)"}
                      </p>
                    </div>
                  )}
                </ZoruCardContent>
                <ZoruCardFooter>
                  <Button
                    className="w-full"
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                    Save settings
                  </Button>
                </ZoruCardFooter>
              </Card>

              {/* ── Right Column ──────────────────────────────────── */}
              <div className="flex flex-col gap-6 lg:col-span-2">
                {/* ── Content pool ──────────────────────────────────── */}
                <Card>
                <ZoruCardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <ZoruCardTitle>Content pool</ZoruCardTitle>
                      <ZoruCardDescription>
                        Posts that will be randomly selected for publishing.
                      </ZoruCardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setIsDialogOpen(true)}
                    >
                      <PlusCircle /> Add post
                    </Button>
                  </div>
                </ZoruCardHeader>
                <ZoruCardContent>
                  {isLoading ? (
                    <div className="flex flex-col gap-3">
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
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
                    <EmptyState
                      icon={<Repeat />}
                      title="Your content pool is empty"
                      description="Add some posts to start rotating them automatically."
                      action={
                        <Button onClick={() => setIsDialogOpen(true)}>
                          <PlusCircle /> Add post
                        </Button>
                      }
                    />
                  )}
                </ZoruCardContent>
                </Card>

                {/* ── History ──────────────────────────────────────── */}
                <Card>
                  <ZoruCardHeader>
                    <ZoruCardTitle>Publishing History</ZoruCardTitle>
                    <ZoruCardDescription>
                      Recently published posts by the randomizer.
                    </ZoruCardDescription>
                  </ZoruCardHeader>
                  <ZoruCardContent>
                    {!settings.history || settings.history.length === 0 ? (
                      <EmptyState
                        icon={<Repeat />}
                        title="No history yet"
                        description="Once the randomizer starts publishing, history will appear here."
                      />
                    ) : (
                      <div className="flex max-h-[40vh] flex-col gap-3 overflow-y-auto pr-1">
                        {settings.history.map((h, i) => (
                          <div key={i} className="flex gap-4 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface px-4 py-3">
                            {h.imageUrl && (
                              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-zoru-surface-2">
                                <Image
                                  src={h.imageUrl}
                                  alt="History post image"
                                  fill
                                  sizes="64px"
                                  unoptimized
                                  className="object-cover"
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                              <p className="line-clamp-2 text-sm text-zoru-ink">{h.message}</p>
                              <p className="text-xs text-zoru-ink-muted mt-1">{new Date(h.postedAt).toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ZoruCardContent>
                </Card>
              </div>
            </div>
          </FeatureLock>
        </div>
      </div>
    </>
  );
}
