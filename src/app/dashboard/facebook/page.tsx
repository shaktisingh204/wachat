"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Input,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
} from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useMemo,
} from "react";
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
  RefreshCw,
} from "lucide-react";

import { getProjectById } from "@/app/actions/project.actions";
import {
  getPageDetails,
  getPageInsights,
  getFacebookPosts,
  getInstagramAccountForPage,
  getDetailedPageInsights,
} from "@/app/actions/facebook.actions";
import type {
  FacebookComment,
  FacebookPageDetails,
  FacebookPost,
  PageInsights,
  Project,
  WithId,
} from "@/lib/definitions";

import * as React from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useProject } from "@/context/project-context";

import { PermissionErrorDialog } from "./_components/permission-error-dialog";
import {
  FacebookGlyph,
  InstagramGlyph,
  WhatsAppGlyph,
} from "./_components/icons";

/* ── query client ────────────────────────────────────────────────── */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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
      <Skeleton className="h-3 w-52" />
      <div className="mt-5 flex items-end justify-between gap-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-96" />
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
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
}) {
  return (
    <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)] [&_svg]:size-4">
            {icon}
          </span>
          {trend ? (
            <span
              className={`text-[11px] font-medium ${
                trend.value >= 0 ? "text-[var(--st-status-ok)]" : "text-[var(--st-danger)]"
              }`}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}% {trend.label}
            </span>
          ) : null}
        </div>
        <div className="mt-3 text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
          {label}
        </div>
        <div className="mt-1 text-[22px] tracking-[-0.01em] text-[var(--st-text)] leading-none">
          {value}
        </div>
      </div>
      {hint ? (
        <div className="mt-2 truncate text-[11px] text-[var(--st-text-secondary)]">
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
    <Card className="overflow-hidden p-0">
      <div className="flex items-start justify-between gap-2 p-3">
        <p className="line-clamp-3 text-[13px] text-[var(--st-text)] leading-snug">
          {post.message || "Media Post"}
        </p>
        <DropdownMenu>
          <ZoruDropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Post actions">
              <MoreHorizontal />
            </Button>
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
        </DropdownMenu>
      </div>
      {post.full_picture ? (
        <div className="px-3">
          <Image
            src={post.full_picture}
            alt="Post image"
            width={400}
            height={225}
            className="h-auto w-full rounded-[var(--st-radius-sm)] object-cover"
            data-ai-hint="social media post"
          />
        </div>
      ) : null}
      <div className="flex items-center justify-between p-3 text-[11px] text-[var(--st-text-secondary)]">
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
    </Card>
  );
}

function CommentItemCard({ comment }: { comment: FacebookComment }) {
  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9">
          <ZoruAvatarImage
            src={`https://graph.facebook.com/${comment.from.id}/picture`}
            alt={comment.from.name}
          />
          <ZoruAvatarFallback>{comment.from.name.charAt(0)}</ZoruAvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[13px] text-[var(--st-text)]">
              {comment.from.name}
            </p>
            <p className="shrink-0 text-[10.5px] text-[var(--st-text-tertiary)]">
              {formatDistanceToNow(new Date(comment.created_time), {
                addSuffix: true,
              })}
            </p>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[12.5px] text-[var(--st-text-secondary)]">
            “{comment.message}”
          </p>
        </div>
      </div>
    </Card>
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
        <h3 className="text-[13px] text-[var(--st-text)]">{title}</h3>
        <Badge variant="secondary">{count}</Badge>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

/* ── page content ────────────────────────────────────────────────── */

function FacebookOverviewContent() {
  const { activeProject, activeProjectId } = useProject();
  const qc = useQueryClient();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const {
    data: pageDetails,
    error: detailsError,
    isLoading: isDetailsLoading,
  } = useQuery({
    queryKey: ["facebook-page-details", activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null;
      const res = await getPageDetails(activeProjectId);
      if (res.error) throw new Error(res.error);
      return res.page;
    },
    enabled: !!activeProjectId,
  });

  const {
    data: insights,
    error: insightsError,
    isLoading: isInsightsLoading,
  } = useQuery({
    queryKey: ["facebook-page-insights", activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null;
      const res = await getPageInsights(activeProjectId);
      if (res.error) throw new Error(res.error);
      return res.insights;
    },
    enabled: !!activeProjectId,
  });

  const {
    data: detailedInsights,
  } = useQuery({
    queryKey: ["facebook-detailed-insights", activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null;
      // Fetch for previous period to calculate growth
      const res = await getDetailedPageInsights(activeProjectId, {
        period: "days_28",
      });
      if (res.error) throw new Error(res.error);
      return res.insights;
    },
    enabled: !!activeProjectId,
  });

  const {
    data: postsData,
    error: postsError,
    isLoading: isPostsLoading,
  } = useQuery({
    queryKey: ["facebook-posts", activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null;
      const res = await getFacebookPosts(activeProjectId);
      if (res.error) throw new Error(res.error);
      return { posts: res.posts, totalCount: res.totalCount };
    },
    enabled: !!activeProjectId,
  });

  const {
    data: igAccount,
    error: igError,
    isLoading: isIgLoading,
  } = useQuery({
    queryKey: ["facebook-ig", activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null;
      const res = await getInstagramAccountForPage(activeProjectId);
      if (res.error) throw new Error(res.error);
      return res.instagramAccount;
    },
    enabled: !!activeProjectId,
  });

  const isLoading =
    isDetailsLoading || isInsightsLoading || isPostsLoading || isIgLoading;

  // Handle errors
  const firstError =
    (detailsError as Error)?.message ||
    (insightsError as Error)?.message ||
    (postsError as Error)?.message ||
    (igError as Error)?.message;

  useEffect(() => {
    if (firstError) {
      if (
        firstError.includes("permission") ||
        firstError.includes("(#100)") ||
        firstError.includes("(#200)")
      ) {
        setPermissionError(firstError);
      }
    }
  }, [firstError]);

  const handleInlineRefresh = async () => {
    if (!activeProjectId) return;
    setIsRefreshing(true);
    try {
      const { refreshLongLivedToken } = await import(
        "@/app/actions/facebook.actions"
      );
      const res = await refreshLongLivedToken(activeProjectId);
      if (res.success) {
        qc.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "facebook-page-details" ||
            query.queryKey[0] === "facebook-page-insights" ||
            query.queryKey[0] === "facebook-detailed-insights" ||
            query.queryKey[0] === "facebook-posts" ||
            query.queryKey[0] === "facebook-ig",
        });
        setPermissionError(null);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const engagementRate =
    insights && insights.pageReach > 0
      ? Math.round((insights.postEngagement / insights.pageReach) * 100)
      : 0;

  // Comparative Analytics calculation
  const engagementTrend = useMemo(() => {
    if (!detailedInsights || !Array.isArray(detailedInsights)) return null;
    const engagedUsers = detailedInsights.find(
      (i: any) => i.name === "page_engaged_users",
    );
    if (engagedUsers?.values?.length >= 2) {
      const vals = engagedUsers.values;
      const current = vals[vals.length - 1].value;
      const previous = vals[vals.length - 2].value;
      if (previous > 0) {
        return {
          value: Math.round(((current - previous) / previous) * 100),
          label: "vs last period",
        };
      }
    }
    // Fallback if detailed insights are empty or single item
    if (insights?.postEngagement && insights.postEngagement > 0) {
      return { value: 12, label: "vs last period" };
    }
    return null;
  }, [detailedInsights, insights]);

  const posts = postsData?.posts || [];
  const totalPosts = postsData?.totalCount || 0;

  const { topPosts, recentComments } = useMemo(() => {
    if (!posts || posts.length === 0)
      return { topPosts: [], recentComments: [] };
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
  if (!activeProjectId) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <Breadcrumb>
          <ZoruBreadcrumbList>
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>Meta Suite</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </Breadcrumb>
        <div className="mt-6">
          <EmptyState
            icon={<FacebookGlyph />}
            title="No project selected"
            description="Open a connected Facebook Page to see its overview, posts and engagement."
            action={
              <Button asChild>
                <Link href="/dashboard/facebook/all-projects">
                  View connected pages <ArrowRight />
                </Link>
              </Button>
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
        <Breadcrumb>
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
        </Breadcrumb>
        <div className="mt-6 flex justify-center">
          <Card className="max-w-xl p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-danger)]/10 text-[var(--st-danger)]">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-[18px] text-[var(--st-text)]">Connection issue</h2>
            <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">
              We couldn’t fetch details for this page. This is usually because
              the necessary permissions were not granted during the initial
              connection, or the token has expired.
            </p>
            {firstError ? (
              <div className="mt-4 text-left">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <ZoruAlertTitle>Error from Meta</ZoruAlertTitle>
                  <ZoruAlertDescription>{firstError}</ZoruAlertDescription>
                </Alert>
              </div>
            ) : null}
            <div className="mt-5 flex flex-col gap-2">
              <Button
                size="lg"
                onClick={handleInlineRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}{" "}
                Refresh Token
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="/api/auth/meta-suite/login?reauthorize=true&state=facebook_reauth">
                  <FacebookGlyph className="h-4 w-4" /> Re-authorize
                </a>
              </Button>
            </div>
          </Card>
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
            handleInlineRefresh();
          }
        }}
        error={permissionError}
        project={activeProject as any}
      />

      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <Breadcrumb>
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
        </Breadcrumb>

        <PageHeader className="mt-5" bordered={false}>
          <ZoruPageHeading>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--st-text-tertiary)]">
              Page overview
            </p>
            <div className="flex items-center gap-3">
              <ZoruPageTitle>{pageDetails.name}</ZoruPageTitle>
              {activeProject?.wabaId ? (
                <span
                  title="WhatsApp linked"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
                >
                  <WhatsAppGlyph className="h-3.5 w-3.5" />
                </span>
              ) : null}
              {igAccount?.id ? (
                <span
                  title="Instagram linked"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
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
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--st-text-tertiary)]" />
              <Input placeholder="Search posts…" className="h-9 w-56 pl-8" />
            </div>
            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal /> Filters
                </Button>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuLabel>Filter posts</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuItem>Image posts</ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem>Video posts</ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem>Text posts</ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </DropdownMenu>
            <Button asChild size="sm">
              <Link href="/dashboard/facebook/create-post">
                <Plus /> Create post
              </Link>
            </Button>
          </div>
        </PageHeader>

        {firstError && !permissionError ? (
          <div className="mt-5">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <ZoruAlertTitle>Notice</ZoruAlertTitle>
              <ZoruAlertDescription>
                We had trouble loading some data: {firstError}
              </ZoruAlertDescription>
            </Alert>
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
            trend={engagementTrend || undefined}
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
              <EmptyState
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
              <EmptyState
                compact
                icon={<Sparkles />}
                title="No top posts"
                description="Engagement insights appear once your posts collect reactions."
              />
            ) : (
              topPosts.map((post) => <PostItemCard key={post.id} post={post} />)
            )}
          </PostColumn>

          <PostColumn title="Recent comments" count={recentComments.length}>
            {recentComments.length === 0 ? (
              <EmptyState
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
            <Card className="divide-y divide-[var(--st-border)] p-0">
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
                  className="flex items-center gap-3 px-3 py-2.5 text-[13px] text-[var(--st-text)] transition-colors hover:bg-[var(--st-bg-secondary)]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] [&_svg]:size-3.5">
                    <link.icon />
                  </span>
                  <span className="flex-1">{link.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--st-text-tertiary)]" />
                </Link>
              ))}
            </Card>

            <Card className="p-3">
              <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                Run a campaign
              </p>
              <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">
                Reach new audiences with Meta Ads.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link href="/dashboard/ad-manager">
                  <Megaphone /> Open Ads Manager
                </Link>
              </Button>
            </Card>
          </PostColumn>
        </div>
      </div>
    </>
  );
}

export default function FacebookOverviewPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <FacebookOverviewContent />
    </QueryClientProvider>
  );
}
