"use client";

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, DataTable, EmptyState, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle, Skeleton, useToast } from '@/components/sabcrm/20ui';
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
  CalendarDays,
  LayoutList
  } from "lucide-react";

import {
  getScheduledPosts,
  publishScheduledPost,
} from "@/app/actions/facebook.actions";
import type { FacebookPost } from "@/lib/definitions";
import { useProject } from "@/context/project-context";

/**
 * /dashboard/facebook/scheduled — Scheduled posts queue, ZoruUI rebuild.
 *
 * Same handlers + server actions as before (`getScheduledPosts`,
 * `publishScheduledPost`, `handleUpdatePost`, `handleDeletePost`).
 * Visual layer: PageHeader + Breadcrumb, DataTable with
 * status/scheduled badges, EditScheduleSheet, CancelScheduleDialog.
 */

import * as React from "react";

import { CancelScheduleDialog } from "../_components/cancel-schedule-dialog";
import { EditScheduleSheet } from "../_components/edit-schedule-sheet";
import { ScheduledCalendar } from "../_components/scheduled-calendar";
import {
  ErrorState,
  NoProjectState,
} from "../_components/no-project-state";

/* ── helpers ─────────────────────────────────────────────────────── */

function ScheduleBadge({ post }: { post: FacebookPost }) {
  if (!post.scheduled_publish_time) {
    return <Badge variant="ghost">Draft</Badge>;
  }
  const at = new Date(post.scheduled_publish_time * 1000);
  const isPast = at.getTime() < Date.now();
  return (
    <Badge variant={isPast ? "danger" : "warning"}>
      <CalendarClock />
      {isPast ? "Overdue" : "Queued"}
    </Badge>
  );
}

/* ── skeleton ────────────────────────────────────────────────────── */

function ScheduledPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-3 w-52" />
      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="mt-6 flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
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
  const { toast } = useToast();

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
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Publish now"
        onClick={onPublishNow}
        disabled={isPublishing}
      >
        {isPublishing ? <Loader2 className="animate-spin" /> : <Send />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Edit scheduled post"
        onClick={() => setIsEditOpen(true)}
      >
        <Edit />
      </Button>
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
  const [view, setView] = useState<"table" | "calendar">("table");

  const { activeProjectId } = useProject();

  useEffect(() => {
    document.title = "Scheduled · Meta Suite · SabNode";
    if (activeProjectId !== undefined) {
      setProjectId(activeProjectId);
      setProjectIdReady(true);
    }
  }, [activeProjectId]);

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
  }, [projectId, fetchPosts]);

  const handleActionComplete = useCallback(() => {
    fetchPosts();
  }, [fetchPosts]);

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
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)]">
                {post.full_picture ? (
                  <Image
                    src={post.full_picture}
                    alt=""
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[var(--st-text-secondary)]">
                    {post.full_picture ? (
                      <ImageIcon className="h-4 w-4" />
                    ) : (
                      <Newspaper className="h-4 w-4" />
                    )}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--st-text)]">
                  {post.message || "Scheduled media post"}
                </p>
                <p className="text-[11px] text-[var(--st-text-secondary)]">
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
          if (!t) return <span className="text-[var(--st-text-secondary)]">—</span>;
          const at = new Date(t * 1000);
          return (
            <div className="flex flex-col">
              <span className="text-sm text-[var(--st-text)]">
                {format(at, "PPP")}
              </span>
              <span className="text-[11px] text-[var(--st-text-secondary)]">
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
            <BreadcrumbPage>Scheduled</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader bordered={false} className="mt-5">
        <PageHeading>
          <PageEyebrow>Meta Suite</PageEyebrow>
          <PageTitle>Scheduled posts</PageTitle>
          <PageDescription>
            Manage posts queued for future publication on your connected
            Facebook Page.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <div className="flex items-center gap-1 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] p-1 bg-[var(--st-bg-secondary)]">
            <Button
              variant={view === "table" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView("table")}
              title="Table View"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "calendar" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView("calendar")}
              title="Calendar View"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
          </div>
          <Badge variant="secondary">
            <CalendarRange />
            {posts.length} queued
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchPosts}>
            <RefreshCw /> Refresh
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/facebook/create-post">
              <Send /> New post
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <div className="mt-6">
        {!projectId ? (
          <NoProjectState />
        ) : error ? (
          <ErrorState message={error} />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<CalendarClock />}
            title="No scheduled posts"
            description="You have no posts queued for the future. Create one to start filling your content calendar."
            action={
              <Button asChild>
                <Link href="/dashboard/facebook/create-post">
                  <Send /> Create post
                </Link>
              </Button>
            }
          />
        ) : view === "calendar" ? (
          <ScheduledCalendar 
            posts={posts} 
            projectId={projectId} 
            onActionComplete={handleActionComplete} 
          />
        ) : (
          <DataTable
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
