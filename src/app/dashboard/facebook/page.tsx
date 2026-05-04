"use client";

/**
 * /dashboard/facebook — Meta Suite root / overview.
 *
 * Rebuilt on ZoruUI primitives. Same data — `getProjectById`,
 * `getPageDetails`, `getPageInsights`, `getFacebookPosts`,
 * `getInstagramAccountForPage` — and the same handlers as before.
 * Visual layer is pure zoru tokens, no rainbow accents.
 */

import * as React from "react";
import { useEffect, useState, useTransition, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Edit,
  MessageSquare,
  MoreHorizontal,
  Megaphone,
  Newspaper,
  Plus,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  Users,
} from "lucide-react";

import { getProjectById } from "@/app/actions/project.actions";
import {
  getPageDetails,
  getPageInsights,
  getFacebookPosts,
  getInstagramAccountForPage,
} from "@/app/actions/facebook.actions";
import type {
  FacebookComment,
  FacebookPageDetails,
  FacebookPost,
  PageInsights,
  Project,
  WithId,
} from "@/lib/definitions";

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruInput,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
} from "@/components/zoruui";

import { PermissionErrorDialog } from "./_components/permission-error-dialog";
import {
  FacebookGlyph,
  InstagramGlyph,
  WhatsAppGlyph,
} from "./_components/icons";

/* ── helpers ─────────────────────────────────────────────────────── */

function compact(n: number | null | undefined): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return v.toLocaleString();
}

/* ── skeleton ────────────────────────────────────────────────────── */

function OverviewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-end justify-between gap-4">
        <ZoruSkeleton className="h-9 w-72" />
        <ZoruSkeleton className="h-9 w-36" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-96" />
        ))}
      </div>
    </div>
  );
}

/* ── stat tile ───────────────────────────────────────────────────── */

function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-4">
      <div className="flex items-start justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-4">
          {icon}
        </span>
      </div>
      <div className="mt-3 text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
        {label}
      </div>
      <div className="mt-1 text-[22px] tracking-[-0.01em] text-zoru-ink leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 truncate text-[11px] text-zoru-ink-muted">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/* ── post tile ───────────────────────────────────────────────────── */

function PostItemCard({ post }: { post: FacebookPost }) {
  const copyLink = () => {
    if (post.permalink_url) {
      navigator.clipboard.writeText(post.permalink_url);
    }
  };
  return (
    <ZoruCard className="overflow-hidden p-0">
      <div className="flex items-start justify-between gap-2 p-3">
        <p className="line-clamp-3 text-[13px] text-zoru-ink leading-snug">
          {post.message || "Media Post"}
        </p>
        <ZoruDropdownMenu>
          <ZoruDropdownMenuTrigger asChild>
            <ZoruButton variant="ghost" size="icon-sm" aria-label="Post actions">
              <MoreHorizontal />
            </ZoruButton>
          </ZoruDropdownMenuTrigger>
          <ZoruDropdownMenuContent align="end">
            <ZoruDropdownMenuLabel>Actions</ZoruDropdownMenuLabel>
            <ZoruDropdownMenuSeparator />
            {post.permalink_url ? (
              <ZoruDropdownMenuItem asChild>
                <a
                  href={post.permalink_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ArrowRight /> View on Facebook
                </a>
              </ZoruDropdownMenuItem>
            ) : null}
            <ZoruDropdownMenuItem onSelect={copyLink}>
              <Share2 /> Copy link
            </ZoruDropdownMenuItem>
            <ZoruDropdownMenuItem asChild>
              <Link href="/dashboard/facebook/posts">
                <Edit /> Edit post
              </Link>
            </ZoruDropdownMenuItem>
            <ZoruDropdownMenuItem asChild>
              <Link href="/dashboard/facebook/insights">
                <TrendingUp /> Insights
              </Link>
            </ZoruDropdownMenuItem>
          </ZoruDropdownMenuContent>
        </ZoruDropdownMenu>
      </div>
      {post.full_picture ? (
        <div className="px-3">
          <Image
            src={post.full_picture}
            alt="Post image"
            width={400}
            height={225}
            className="h-auto w-full rounded-[var(--zoru-radius-sm)] object-cover"
            data-ai-hint="social media post"
          />
        </div>
      ) : null}
      <div className="flex items-center justify-between p-3 text-[11px] text-zoru-ink-muted">
        <span className="font-mono">
          {new Date(post.created_time).toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
          })}
        </span>
        <div className="flex gap-3">
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {post.comments?.summary?.total_count || 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {post.reactions?.summary?.total_count || 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <Share2 className="h-3 w-3" />
            {post.shares?.count || 0}
          </span>
        </div>
      </div>
    </ZoruCard>
  );
}

function CommentItemCard({ comment }: { comment: FacebookComment }) {
  return (
    <ZoruCard className="p-3">
      <div className="flex items-start gap-3">
        <ZoruAvatar className="h-9 w-9">
          <ZoruAvatarImage
            src={`https://graph.facebook.com/${comment.from.id}/picture`}
            alt={comment.from.name}
          />
          <ZoruAvatarFallback>{comment.from.name.charAt(0)}</ZoruAvatarFallback>
        </ZoruAvatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[13px] text-zoru-ink">
              {comment.from.name}
            </p>
            <p className="shrink-0 text-[10.5px] text-zoru-ink-subtle">
              {formatDistanceToNow(new Date(comment.created_time), {
                addSuffix: true,
              })}
            </p>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[12.5px] text-zoru-ink-muted">
            “{comment.message}”
          </p>
        </div>
      </div>
    </ZoruCard>
  );
}

function PostColumn({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[13px] text-zoru-ink">{title}</h3>
        <ZoruBadge variant="secondary">{count}</ZoruBadge>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

export default function FacebookOverviewPage() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [pageDetails, setPageDetails] = useState<FacebookPageDetails | null>(
    null,
  );
  const [insights, setInsights] = useState<PageInsights | null>(null);
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [instagramId, setInstagramId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);

  const fetchPageData = useCallback((id: string) => {
    startLoading(async () => {
      const projectData = await getProjectById(id);
      setProject(projectData);
      if (!projectData) {
        setError("Project not found or you don't have access.");
        return;
      }
      const [detailsResult, insightsResult, postsResult, igResult] =
        await Promise.all([
          getPageDetails(id),
          getPageInsights(id),
          getFacebookPosts(id),
          getInstagramAccountForPage(id),
        ]);

      const firstError =
        detailsResult.error ||
        insightsResult.error ||
        postsResult.error ||
        igResult.error;
      if (firstError) {
        if (
          firstError.includes("permission") ||
          firstError.includes("(#100)") ||
          firstError.includes("(#200)")
        ) {
          setPermissionError(firstError);
          setError(null);
        } else {
          setError(firstError);
        }
      }

      if (detailsResult.page) setPageDetails(detailsResult.page);
      if (insightsResult.insights) setInsights(insightsResult.insights);
      if (postsResult.posts) {
        setPosts(postsResult.posts);
        setTotalPosts(postsResult.totalCount || postsResult.posts.length);
      }
      if (igResult.instagramAccount?.id)
        setInstagramId(igResult.instagramAccount.id);
    });
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("activeProjectId");
    setProjectId(stored);
  }, []);

  useEffect(() => {
    if (projectId) fetchPageData(projectId);
  }, [projectId, fetchPageData]);

  const onSuccessfulReconnect = () => {
    setPermissionError(null);
    if (projectId) fetchPageData(projectId);
  };

  const engagementRate =
    insights && insights.pageReach > 0
      ? Math.round((insights.postEngagement / insights.pageReach) * 100)
      : 0;

  const { topPosts, recentComments } = useMemo(() => {
    if (!posts || posts.length === 0)
      return { topPosts: [] as FacebookPost[], recentComments: [] as Array<FacebookComment & { postLink?: string }> };
    const calculatedTopPosts = [...posts]
      .map((post) => ({
        ...post,
        engagementScore:
          (post.reactions?.summary?.total_count || 0) +
          (post.comments?.summary?.total_count || 0),
      }))
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 3);
    const allComments = posts
      .flatMap((post) =>
        (post.comments?.data || []).map((comment) => ({
          ...comment,
          postLink: post.permalink_url,
        })),
      )
      .sort(
        (a, b) =>
          new Date(b.created_time).getTime() -
          new Date(a.created_time).getTime(),
      )
      .slice(0, 5);
    return { topPosts: calculatedTopPosts, recentComments: allComments };
  }, [posts]);

  if (isLoading && !pageDetails) {
    return <OverviewSkeleton />;
  }

  /* ── no project selected ── */
  if (!projectId) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <ZoruBreadcrumb>
          <ZoruBreadcrumbList>
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>Meta Suite</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </ZoruBreadcrumb>
        <div className="mt-6">
          <ZoruEmptyState
            icon={<FacebookGlyph />}
            title="No project selected"
            description="Open a connected Facebook Page to see its overview, posts and engagement."
            action={
              <ZoruButton asChild>
                <Link href="/dashboard/facebook/all-projects">
                  View connected pages <ArrowRight />
                </Link>
              </ZoruButton>
            }
          />
        </div>
      </div>
    );
  }

  /* ── connection broken ── */
  if (!pageDetails) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <ZoruBreadcrumb>
          <ZoruBreadcrumbList>
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard/facebook/all-projects">
                Meta Suite
              </ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>Connection issue</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </ZoruBreadcrumb>
        <div className="mt-6 flex justify-center">
          <ZoruCard className="max-w-xl p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zoru-danger/10 text-zoru-danger">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-[18px] text-zoru-ink">Connection issue</h2>
            <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
              We couldn’t fetch details for this page. This is usually because
              the necessary permissions were not granted during the initial
              connection.
            </p>
            {permissionError || error ? (
              <div className="mt-4 text-left">
                <ZoruAlert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <ZoruAlertTitle>Error from Meta</ZoruAlertTitle>
                  <ZoruAlertDescription>
                    {permissionError || error}
                  </ZoruAlertDescription>
                </ZoruAlert>
              </div>
            ) : null}
            <div className="mt-5 flex flex-col gap-2">
              <ZoruButton asChild size="lg">
                <a href="/api/auth/meta-suite/login?reauthorize=true&state=facebook_reauth">
                  <FacebookGlyph className="h-4 w-4" /> Re-authorize
                </a>
              </ZoruButton>
              <ZoruButton asChild variant="outline" size="sm">
                <Link href="/dashboard/facebook/all-projects">
                  Back to connected pages
                </Link>
              </ZoruButton>
            </div>
          </ZoruCard>
        </div>
      </div>
    );
  }

  /* ── normal overview ── */
  return (
    <>
      <PermissionErrorDialog
        isOpen={!!permissionError}
        onOpenChange={(o) => {
          if (!o) {
            setPermissionError(null);
            onSuccessfulReconnect();
          }
        }}
        error={permissionError}
        project={project}
      />

      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <ZoruBreadcrumb>
          <ZoruBreadcrumbList>
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard/facebook/all-projects">
                Meta Suite
              </ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>{pageDetails.name}</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </ZoruBreadcrumb>

        <ZoruPageHeader className="mt-5" bordered={false}>
          <ZoruPageHeading>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zoru-ink-subtle">
              Page overview
            </p>
            <div className="flex items-center gap-3">
              <ZoruPageTitle>{pageDetails.name}</ZoruPageTitle>
              {project?.wabaId ? (
                <span
                  title="WhatsApp linked"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted"
                >
                  <WhatsAppGlyph className="h-3.5 w-3.5" />
                </span>
              ) : null}
              {instagramId ? (
                <span
                  title="Instagram linked"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted"
                >
                  <InstagramGlyph className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </div>
            <ZoruPageDescription>
              Followers, engagement and the latest activity across this Page.
            </ZoruPageDescription>
          </ZoruPageHeading>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zoru-ink-subtle" />
              <ZoruInput
                placeholder="Search posts…"
                className="h-9 w-56 pl-8"
              />
            </div>
            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="sm">
                  <SlidersHorizontal /> Filters
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuLabel>Filter posts</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuItem>Image posts</ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem>Video posts</ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem>Text posts</ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
            <ZoruButton asChild size="sm">
              <Link href="/dashboard/facebook/create-post">
                <Plus /> Create post
              </Link>
            </ZoruButton>
          </div>
        </ZoruPageHeader>

        {error ? (
          <div className="mt-5">
            <ZoruAlert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <ZoruAlertTitle>Error</ZoruAlertTitle>
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </ZoruAlert>
          </div>
        ) : null}

        {/* ── Stats ── */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label="Followers"
            value={compact(pageDetails.followers_count || 0)}
            hint="Total followers"
            icon={<Users />}
          />
          <StatTile
            label="Page likes"
            value={compact(pageDetails.fan_count || 0)}
            hint="Total page likes"
            icon={<Star />}
          />
          <StatTile
            label="Engagements"
            value={compact(insights?.postEngagement || 0)}
            hint="Last 28 days"
            icon={<ThumbsUp />}
          />
          <StatTile
            label="Posts"
            value={compact(totalPosts)}
            hint="Total on page"
            icon={<Newspaper />}
          />
          <StatTile
            label="Engagement rate"
            value={`${engagementRate}%`}
            hint="Daily / reach"
            icon={<TrendingUp />}
          />
        </div>

        {/* ── Activity columns ── */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
          <PostColumn title="Latest posts" count={posts.slice(0, 3).length}>
            {posts.slice(0, 3).length === 0 ? (
              <ZoruEmptyState
                compact
                icon={<Newspaper />}
                title="No posts yet"
                description="Create your first post to see it here."
              />
            ) : (
              posts.slice(0, 3).map((post) => (
                <PostItemCard key={post.id} post={post} />
              ))
            )}
          </PostColumn>

          <PostColumn title="Top posts" count={topPosts.length}>
            {topPosts.length === 0 ? (
              <ZoruEmptyState
                compact
                icon={<Sparkles />}
                title="No top posts"
                description="Engagement insights appear once your posts collect reactions."
              />
            ) : (
              topPosts.map((post) => (
                <PostItemCard key={post.id} post={post} />
              ))
            )}
          </PostColumn>

          <PostColumn title="Recent comments" count={recentComments.length}>
            {recentComments.length === 0 ? (
              <ZoruEmptyState
                compact
                icon={<MessageSquare />}
                title="No comments yet"
                description="Replies and comments on your posts will show up here."
              />
            ) : (
              recentComments.map((comment) => (
                <CommentItemCard key={comment.id} comment={comment} />
              ))
            )}
          </PostColumn>

          <PostColumn title="Quick links" count={4}>
            <ZoruCard className="divide-y divide-zoru-line p-0">
              {[
                {
                  href: "/dashboard/facebook/posts",
                  title: "Manage posts",
                  icon: Newspaper,
                },
                {
                  href: "/dashboard/facebook/calendar",
                  title: "Content calendar",
                  icon: Calendar,
                },
                {
                  href: "/dashboard/facebook/messages",
                  title: "Messenger inbox",
                  icon: MessageSquare,
                },
                {
                  href: "/dashboard/facebook/settings",
                  title: "Page settings",
                  icon: Settings,
                },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 px-3 py-2.5 text-[13px] text-zoru-ink transition-colors hover:bg-zoru-surface"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 [&_svg]:size-3.5">
                    <link.icon />
                  </span>
                  <span className="flex-1">{link.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-zoru-ink-subtle" />
                </Link>
              ))}
            </ZoruCard>

            <ZoruCard className="p-3">
              <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                Run a campaign
              </p>
              <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                Reach new audiences with Meta Ads.
              </p>
              <ZoruButton asChild size="sm" variant="outline" className="mt-3">
                <Link href="/dashboard/ad-manager">
                  <Megaphone /> Open Ads Manager
                </Link>
              </ZoruButton>
            </ZoruCard>
          </PostColumn>
        </div>
      </div>
    </>
  );
}
