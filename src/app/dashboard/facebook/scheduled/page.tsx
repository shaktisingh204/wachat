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
  ZoruDataTable,
  ZoruEmptyState,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  } from "react";
import Image from "next/image";
import Link from "next/link";
import { format,
  formatDistanceToNow } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CalendarClock,
  CalendarRange,
  Edit,
  Image as ImageIcon,
  Loader2,
  Newspaper,
  RefreshCw,
  Send,
  } from "lucide-react";

import {
  getScheduledPosts,
  publishScheduledPost,
  } from "@/app/actions/facebook.actions";
import type { FacebookPost } from "@/lib/definitions";

/**
 * /dashboard/facebook/scheduled — Scheduled posts queue, ZoruUI rebuild.
 *
 * Same handlers + server actions as before (`getScheduledPosts`,
 * `publishScheduledPost`, `handleUpdatePost`, `handleDeletePost`).
 * Visual layer: ZoruPageHeader + ZoruBreadcrumb, ZoruDataTable with
 * status/scheduled badges, EditScheduleSheet, CancelScheduleDialog.
 */

import * as React from "react";

import { CancelScheduleDialog } from "../_components/cancel-schedule-dialog";
import { EditScheduleSheet } from "../_components/edit-schedule-sheet";
import {
  ErrorState,
  NoProjectState,
} from "../_components/no-project-state";

/* ── helpers ─────────────────────────────────────────────────────── */

function ScheduleBadge({ post }: { post: FacebookPost }) {
  if (!post.scheduled_publish_time) {
    return <ZoruBadge variant="ghost">Draft</ZoruBadge>;
  }
  const at = new Date(post.scheduled_publish_time * 1000);
  const isPast = at.getTime() < Date.now();
  return (
    <ZoruBadge variant={isPast ? "danger" : "warning"}>
      <CalendarClock />
      {isPast ? "Overdue" : "Queued"}
    </ZoruBadge>
  );
}

/* ── skeleton ────────────────────────────────────────────────────── */

function ScheduledPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <ZoruSkeleton className="h-3 w-24" />
          <ZoruSkeleton className="h-8 w-56" />
          <ZoruSkeleton className="h-4 w-72" />
        </div>
        <ZoruSkeleton className="h-9 w-28" />
      </div>
      <div className="mt-6 flex flex-col gap-2">
        <ZoruSkeleton className="h-10 w-full" />
        <ZoruSkeleton className="h-12 w-full" />
        <ZoruSkeleton className="h-12 w-full" />
        <ZoruSkeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

/* ── row actions ─────────────────────────────────────────────────── */

function RowActions({
  post,
  projectId,
  onActionComplete,
}: {
  post: FacebookPost;
  projectId: string;
  onActionComplete: () => void;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPublishing, startPublishing] = useTransition();
  const { toast } = useZoruToast();

  const onPublishNow = () => {
    startPublishing(async () => {
      const result = await publishScheduledPost(post.id, projectId);
      if (result.success) {
        toast({
          title: "Publishing",
          description: "Post is being published now.",
        });
        onActionComplete();
      } else {
        toast({
          title: "Could not publish",
          description: result.error ?? "Try again in a moment.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <EditScheduleSheet
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        post={post}
        projectId={projectId}
        onPostUpdated={onActionComplete}
      />
      <ZoruButton
        variant="ghost"
        size="icon-sm"
        aria-label="Publish now"
        onClick={onPublishNow}
        disabled={isPublishing}
      >
        {isPublishing ? <Loader2 className="animate-spin" /> : <Send />}
      </ZoruButton>
      <ZoruButton
        variant="ghost"
        size="icon-sm"
        aria-label="Edit scheduled post"
        onClick={() => setIsEditOpen(true)}
      >
        <Edit />
      </ZoruButton>
      <CancelScheduleDialog
        postId={post.id}
        projectId={projectId}
        onCancelled={onActionComplete}
      />
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

export default function ScheduledPostsPage() {
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectIdReady, setProjectIdReady] = useState(false);
  const [actionCounter, setActionCounter] = useState(0);

  useEffect(() => {
    document.title = "Scheduled · Meta Suite · SabNode";
    setProjectId(localStorage.getItem("activeProjectId"));
    setProjectIdReady(true);
  }, []);

  const fetchPosts = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const { posts: fetched, error: fetchError } = await getScheduledPosts(
        projectId,
      );
      if (fetchError) {
        setError(fetchError);
        setPosts([]);
      } else if (fetched) {
        setError(null);
        setPosts(fetched);
      }
    });
  }, [projectId]);

  useEffect(() => {
    if (projectId) fetchPosts();
  }, [projectId, fetchPosts, actionCounter]);

  const handleActionComplete = useCallback(() => {
    setActionCounter((n) => n + 1);
  }, []);

  const columns = useMemo<ColumnDef<FacebookPost>[]>(
    () => [
      {
        id: "post",
        accessorFn: (row) => row.message ?? "",
        header: "Post",
        cell: ({ row }) => {
          const post = row.original;
          return (
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2">
                {post.full_picture ? (
                  <Image
                    src={post.full_picture}
                    alt=""
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-zoru-ink-muted">
                    {post.full_picture ? (
                      <ImageIcon className="h-4 w-4" />
                    ) : (
                      <Newspaper className="h-4 w-4" />
                    )}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zoru-ink">
                  {post.message || "Scheduled media post"}
                </p>
                <p className="text-[11px] text-zoru-ink-muted">
                  Created{" "}
                  {formatDistanceToNow(new Date(post.created_time), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        id: "scheduledFor",
        header: "Scheduled for",
        accessorFn: (row) => row.scheduled_publish_time ?? 0,
        cell: ({ row }) => {
          const t = row.original.scheduled_publish_time;
          if (!t) return <span className="text-zoru-ink-muted">—</span>;
          const at = new Date(t * 1000);
          return (
            <div className="flex flex-col">
              <span className="text-sm text-zoru-ink">
                {format(at, "PPP")}
              </span>
              <span className="text-[11px] text-zoru-ink-muted">
                {format(at, "p")} · {formatDistanceToNow(at, { addSuffix: true })}
              </span>
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <ScheduleBadge post={row.original} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <RowActions
            post={row.original}
            projectId={projectId ?? ""}
            onActionComplete={handleActionComplete}
          />
        ),
      },
    ],
    [projectId, handleActionComplete],
  );

  if (!projectIdReady || (isLoading && posts.length === 0 && !error)) {
    return <ScheduledPageSkeleton />;
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
            <ZoruBreadcrumbPage>Scheduled</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader bordered={false} className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Meta Suite</ZoruPageEyebrow>
          <ZoruPageTitle>Scheduled posts</ZoruPageTitle>
          <ZoruPageDescription>
            Manage posts queued for future publication on your connected
            Facebook Page.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruBadge variant="secondary">
            <CalendarRange />
            {posts.length} queued
          </ZoruBadge>
          <ZoruButton variant="outline" size="sm" onClick={fetchPosts}>
            <RefreshCw /> Refresh
          </ZoruButton>
          <ZoruButton size="sm" asChild>
            <Link href="/dashboard/facebook/create-post">
              <Send /> New post
            </Link>
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      <div className="mt-6">
        {!projectId ? (
          <NoProjectState />
        ) : error ? (
          <ErrorState message={error} />
        ) : posts.length === 0 ? (
          <ZoruEmptyState
            icon={<CalendarClock />}
            title="No scheduled posts"
            description="You have no posts queued for the future. Create one to start filling your content calendar."
            action={
              <ZoruButton asChild>
                <Link href="/dashboard/facebook/create-post">
                  <Send /> Create post
                </Link>
              </ZoruButton>
            }
          />
        ) : (
          <ZoruDataTable
            columns={columns}
            data={posts}
            filterColumn="post"
            filterPlaceholder="Search scheduled posts…"
            pageSize={10}
          />
        )}
      </div>
    </div>
  );
}
