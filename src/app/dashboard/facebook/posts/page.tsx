"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  DataTable,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  EmptyState,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  Edit,
  ExternalLink,
  Image as ImageIcon,
  MessageCircle,
  Newspaper,
  RefreshCw,
  Share2,
  ThumbsUp,
  Video,
  } from "lucide-react";

import {
  getFacebookPosts,
  handleLikeObject,
  } from "@/app/actions/facebook.actions";
import type { FacebookPost } from "@/lib/definitions";

/**
 * /dashboard/facebook/posts — Master Facebook post list.
 *
 * ZoruUI rebuild: page header + breadcrumb, DataTable with status
 * badges, edit/delete actions per row. Same data (`getFacebookPosts`,
 * `handleLikeObject`) and same handlers as before. Neutral palette only.
 */

import * as React from "react";

import { DeletePostButton } from "../_components/delete-post-button";
import { UpdatePostDialog } from "../_components/update-post-dialog";

/* ── helpers ─────────────────────────────────────────────────────── */

type PostType = "text" | "photo" | "video";

function detectType(post: FacebookPost): PostType {
  if (post.permalink_url?.includes("/videos/")) return "video";
  if (post.full_picture) return "photo";
  return "text";
}

const TYPE_LABEL: Record<PostType, string> = {
  text: "Text",
  photo: "Photo",
  video: "Video",
};

function PostStatusBadge({ post }: { post: FacebookPost }) {
  if (post.is_published === false || post.scheduled_publish_time) {
    return <Badge variant="warning">Scheduled</Badge>;
  }
  return <Badge variant="success">Published</Badge>;
}

function TypeBadge({ type }: { type: PostType }) {
  const icon =
    type === "video" ? (
      <Video />
    ) : type === "photo" ? (
      <ImageIcon />
    ) : (
      <Newspaper />
    );
  return (
    <Badge variant="ghost">
      {icon}
      {TYPE_LABEL[type]}
    </Badge>
  );
}

/* ── skeleton ────────────────────────────────────────────────────── */

function PostsPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-3 w-52" />
      <div className="mt-5 flex items-end justify-between">
        <div className="flex flex-col gap-2">
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
  const [isUpdateOpen, setIsUpdateOpen] = React.useState(false);
  const [isLiking, startLiking] = useTransition();
  const { toast } = useZoruToast();

  const onLike = () => {
    startLiking(async () => {
      const result = await handleLikeObject(post.id, projectId);
      if (!result.success) {
        toast({
          title: "Could not like",
          description: "Please try again.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Liked", description: "You liked this post." });
        onActionComplete();
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <UpdatePostDialog
        isOpen={isUpdateOpen}
        onOpenChange={setIsUpdateOpen}
        post={post}
        projectId={projectId}
        onPostUpdated={onActionComplete}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Like"
        onClick={onLike}
        disabled={isLiking}
      >
        <ThumbsUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Edit"
        onClick={() => setIsUpdateOpen(true)}
      >
        <Edit />
      </Button>
      {post.permalink_url && (
        <Button variant="ghost" size="icon-sm" aria-label="Open" asChild>
          <a
            href={post.permalink_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink />
          </a>
        </Button>
      )}
      <DeletePostButton
        postId={post.id}
        projectId={projectId}
        onPostDeleted={onActionComplete}
      />
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

type TypeFilter = "all" | PostType;

export default function FacebookPostsPage() {
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [actionCounter, setActionCounter] = useState(0);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  useEffect(() => {
    document.title = "Posts · Meta Suite · SabNode";
    setProjectId(localStorage.getItem("activeProjectId"));
  }, []);

  const fetchPosts = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const { posts: fetched, error: fetchError } = await getFacebookPosts(
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
    fetchPosts();
  }, [fetchPosts, actionCounter]);

  const handleActionComplete = useCallback(() => {
    setActionCounter((n) => n + 1);
  }, []);

  const filtered = React.useMemo(() => {
    if (typeFilter === "all") return posts;
    return posts.filter((p) => detectType(p) === typeFilter);
  }, [posts, typeFilter]);

  const columns = React.useMemo<ColumnDef<FacebookPost>[]>(
    () => [
      {
        id: "post",
        accessorFn: (row) => row.message ?? "",
        header: "Post",
        cell: ({ row }) => {
          const post = row.original;
          const type = detectType(post);
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
                    {type === "video" ? (
                      <Video className="h-4 w-4" />
                    ) : (
                      <Newspaper className="h-4 w-4" />
                    )}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--st-text)]">
                  {post.message ||
                    (type === "video" ? "Video post" : "Media post")}
                </p>
                <p className="text-[11px] text-[var(--st-text-secondary)]">
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
        id: "type",
        header: "Type",
        accessorFn: (row) => detectType(row),
        cell: ({ row }) => <TypeBadge type={detectType(row.original)} />,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <PostStatusBadge post={row.original} />,
      },
      {
        id: "engagement",
        header: "Engagement",
        cell: ({ row }) => {
          const p = row.original;
          const reactions = p.reactions?.summary?.total_count ?? 0;
          const comments = p.comments?.summary?.total_count ?? 0;
          const shares = p.shares?.count ?? 0;
          return (
            <div className="flex items-center gap-3 text-[12px] text-[var(--st-text-secondary)]">
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" /> {reactions}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3 w-3" /> {comments}
              </span>
              <span className="inline-flex items-center gap-1">
                <Share2 className="h-3 w-3" /> {shares}
              </span>
            </div>
          );
        },
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

  if (isLoading && posts.length === 0) {
    return <PostsPageSkeleton />;
  }

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
            <ZoruBreadcrumbPage>Posts</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader bordered={false} className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Meta Suite</ZoruPageEyebrow>
          <ZoruPageTitle>Page posts</ZoruPageTitle>
          <ZoruPageDescription>
            Browse, edit and remove posts from your connected Facebook Page.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {typeFilter === "all"
                  ? "All types"
                  : TYPE_LABEL[typeFilter as PostType]}
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end" className="w-48">
              <ZoruDropdownMenuLabel>Filter by type</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuRadioGroup
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as TypeFilter)}
              >
                <ZoruDropdownMenuRadioItem value="all">
                  All types
                </ZoruDropdownMenuRadioItem>
                <ZoruDropdownMenuRadioItem value="text">
                  Text
                </ZoruDropdownMenuRadioItem>
                <ZoruDropdownMenuRadioItem value="photo">
                  Photo
                </ZoruDropdownMenuRadioItem>
                <ZoruDropdownMenuRadioItem value="video">
                  Video
                </ZoruDropdownMenuRadioItem>
              </ZoruDropdownMenuRadioGroup>
            </ZoruDropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={fetchPosts}>
            <RefreshCw /> Refresh
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="mt-6">
        {!projectId ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <ZoruAlertTitle>No project selected</ZoruAlertTitle>
            <ZoruAlertDescription>
              Please select a project from the main dashboard to view its posts.
            </ZoruAlertDescription>
          </Alert>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <ZoruAlertTitle>Could not fetch posts</ZoruAlertTitle>
            <ZoruAlertDescription>{error}</ZoruAlertDescription>
          </Alert>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Newspaper />}
            title="No posts yet"
            description="We couldn't find any posts on your connected Facebook Page. Create your first one to get started."
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            filterColumn="post"
            filterPlaceholder="Search posts…"
            pageSize={10}
          />
        )}
      </div>
    </div>
  );
}
