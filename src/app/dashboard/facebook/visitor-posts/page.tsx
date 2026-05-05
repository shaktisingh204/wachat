"use client";

/**
 * /dashboard/facebook/visitor-posts — ZoruUI rebuild.
 *
 * Two collections (visitor posts + tagged posts) on one page. Per the
 * no-tab-ui rule we use segmented buttons to switch the visible
 * collection — no `Tabs` primitive.
 *
 * Same server-action wiring as the legacy page:
 *   - getVisitorPosts(projectId)
 *   - getTaggedPosts(projectId)
 */

import * as React from "react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import {
  ExternalLink,
  Eye,
  MessageCircle,
  Tag,
  ThumbsUp,
  Users,
} from "lucide-react";

import { getTaggedPosts, getVisitorPosts } from "@/app/actions/facebook.actions";

import {
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSkeleton,
  cn,
} from "@/components/zoruui";

import {
  FbBreadcrumb,
  FbErrorAlert,
  FbHeader,
  FbNoProject,
} from "../_components/zoru-fb-page-shell";

interface VisitorPost {
  id: string;
  message?: string;
  full_picture?: string;
  permalink_url?: string;
  created_time?: string;
  from?: {
    name?: string;
    picture?: { data?: { url?: string } };
  };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
}

function VisitorPostsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5">
        <ZoruSkeleton className="h-9 w-72" />
        <ZoruSkeleton className="mt-2 h-4 w-96" />
      </div>
      <div className="mt-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}

function PostCard({
  post,
  onView,
}: {
  post: VisitorPost;
  onView: (post: VisitorPost) => void;
}) {
  const author = post.from?.name ?? "Unknown";
  return (
    <ZoruCard className="p-5">
      <div className="flex items-start gap-4">
        <ZoruAvatar className="h-10 w-10">
          {post.from?.picture?.data?.url ? (
            <ZoruAvatarImage src={post.from.picture.data.url} alt={author} />
          ) : null}
          <ZoruAvatarFallback>
            {author.charAt(0).toUpperCase()}
          </ZoruAvatarFallback>
        </ZoruAvatar>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-zoru-ink">{author}</p>
            <div className="flex items-center gap-2">
              {post.created_time && (
                <span className="text-xs text-zoru-ink-muted">
                  {formatDistanceToNow(new Date(post.created_time), {
                    addSuffix: true,
                  })}
                </span>
              )}
              {post.permalink_url && (
                <a
                  href={post.permalink_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zoru-ink-muted hover:text-zoru-ink"
                  aria-label="Open on Facebook"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
          {post.message && (
            <p className="text-sm text-zoru-ink-muted">{post.message}</p>
          )}
          {post.full_picture && (
            <div className="relative aspect-video max-h-48 overflow-hidden rounded-[var(--zoru-radius-sm)] border border-zoru-line">
              <Image
                src={post.full_picture}
                alt="Post image"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}
          <div className="flex items-center gap-4 pt-1 text-xs text-zoru-ink-muted">
            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {post.reactions?.summary?.total_count ?? 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {post.comments?.summary?.total_count ?? 0}
            </span>
            <ZoruButton
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => onView(post)}
            >
              <Eye /> View details
            </ZoruButton>
          </div>
        </div>
      </div>
    </ZoruCard>
  );
}

type VisitorView = "visitor" | "tagged";

export default function VisitorPostsPage() {
  const [visitorPosts, setVisitorPosts] = useState<VisitorPost[]>([]);
  const [taggedPosts, setTaggedPosts] = useState<VisitorPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [view, setView] = useState<VisitorView>("visitor");
  const [activePost, setActivePost] = useState<VisitorPost | null>(null);

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const [visitorRes, taggedRes] = await Promise.all([
        getVisitorPosts(projectId),
        getTaggedPosts(projectId),
      ]);

      if (visitorRes.error) setError(visitorRes.error);
      else setVisitorPosts((visitorRes.posts ?? []) as VisitorPost[]);

      if (taggedRes.posts) {
        setTaggedPosts(taggedRes.posts as VisitorPost[]);
      }
    });
  }, [projectId]);

  useEffect(() => {
    setProjectId(localStorage.getItem("activeProjectId"));
  }, []);

  useEffect(() => {
    fetchData();
  }, [projectId, fetchData]);

  const posts = view === "visitor" ? visitorPosts : taggedPosts;

  const counts = useMemo(
    () => ({ visitor: visitorPosts.length, tagged: taggedPosts.length }),
    [visitorPosts, taggedPosts],
  );

  if (isLoading && visitorPosts.length === 0 && taggedPosts.length === 0) {
    return <VisitorPostsSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <FbBreadcrumb page="Visitor & tagged posts" />
      <FbHeader
        title="Visitor & tagged posts"
        description="Posts from visitors and posts your page has been tagged in."
      />

      {!projectId ? (
        <FbNoProject />
      ) : error ? (
        <FbErrorAlert message={error} />
      ) : (
        <>
          {/* Segmented buttons (no tab UI) */}
          <div
            className="mt-6 inline-flex rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-0.5"
            role="tablist"
            aria-label="Filter posts"
          >
            <ZoruButton
              variant={view === "visitor" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("visitor")}
              className={cn(view !== "visitor" && "text-zoru-ink-muted")}
            >
              <Users /> Visitor posts ({counts.visitor})
            </ZoruButton>
            <ZoruButton
              variant={view === "tagged" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("tagged")}
              className={cn(view !== "tagged" && "text-zoru-ink-muted")}
            >
              <Tag /> Tagged posts ({counts.tagged})
            </ZoruButton>
          </div>

          <div className="mt-4 space-y-4">
            {posts.length > 0 ? (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onView={(p) => setActivePost(p)}
                />
              ))
            ) : (
              <ZoruEmptyState
                icon={view === "visitor" ? <Users /> : <Tag />}
                title={
                  view === "visitor"
                    ? "No visitor posts"
                    : "No tagged posts"
                }
                description={
                  view === "visitor"
                    ? "No one has posted on your page yet."
                    : "Your page has not been tagged in any posts."
                }
              />
            )}
          </div>
        </>
      )}

      <ZoruSheet
        open={!!activePost}
        onOpenChange={(o) => !o && setActivePost(null)}
      >
        <ZoruSheetContent side="right" className="w-full sm:max-w-md">
          <ZoruSheetHeader>
            <ZoruSheetTitle>
              {activePost?.from?.name ?? "Post details"}
            </ZoruSheetTitle>
            <ZoruSheetDescription>
              {activePost?.created_time
                ? formatDistanceToNow(new Date(activePost.created_time), {
                    addSuffix: true,
                  })
                : "Visitor post"}
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {activePost && (
            <div className="mt-4 space-y-4">
              {activePost.message && (
                <p className="text-sm text-zoru-ink whitespace-pre-wrap">
                  {activePost.message}
                </p>
              )}
              {activePost.full_picture && (
                <div className="relative aspect-video w-full overflow-hidden rounded-[var(--zoru-radius-sm)] border border-zoru-line">
                  <Image
                    src={activePost.full_picture}
                    alt="Post image"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
              <div className="flex items-center gap-4 text-xs text-zoru-ink-muted">
                <span className="inline-flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />
                  {activePost.reactions?.summary?.total_count ?? 0} reactions
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  {activePost.comments?.summary?.total_count ?? 0} comments
                </span>
              </div>
              {activePost.permalink_url && (
                <ZoruButton variant="outline" asChild className="w-full">
                  <a
                    href={activePost.permalink_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink /> Open on Facebook
                  </a>
                </ZoruButton>
              )}
            </div>
          )}
        </ZoruSheetContent>
      </ZoruSheet>
    </div>
  );
}
