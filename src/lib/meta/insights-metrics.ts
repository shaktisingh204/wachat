/**
 * Canonical v25 insights metric vocabulary + legacy → v25 mapping.
 *
 * Meta removed the reach / impressions family for ALL Graph API versions across
 * 2025-11-15 → 2026-06 (page_impressions*, post_impressions*, page_fans,
 * *_video_views_unique, story impressions). Requesting even ONE removed metric
 * fails the entire insights call with:
 *   "(#100) <metric> is not a valid insights metric for this object"
 *
 * So every insights caller MUST resolve its metric list through this module —
 * never hand a raw legacy metric name to Graph. New surfaces (Analytics Suite)
 * should import the typed metric groups below.
 *
 * Refs:
 *  - https://developers.facebook.com/docs/graph-api/changelog/version25.0/
 *  - https://developers.facebook.com/blog/post/2025/08/15/page-insights-api-updates/
 */

/** Page-level period metrics (all valid in v25). */
export const PAGE_METRICS = {
  /** Total media views — replaces the removed `page_impressions` family. */
  views: 'page_media_view',
  /** Unique viewers — replaces `page_impressions_unique`. */
  viewers: 'page_total_media_view_unique',
  /** Post engagements (kept in v25). */
  engagement: 'page_post_engagements',
  /** Total actions taken on the page (kept in v25). */
  totalActions: 'page_total_actions',
  /** Follower count — `page_fans` was removed; `page_follows` is the successor. */
  follows: 'page_follows',
} as const;

/** Post-level metrics (all valid in v25). */
export const POST_METRICS = {
  /** Post media views — replaces `post_impressions`. */
  views: 'post_media_view',
  /** Unique post viewers — replaces `post_impressions_unique`. */
  viewers: 'post_total_media_view_unique',
  /** Reactions broken down by type. */
  reactions: 'post_reactions_by_type_total',
  /** Link/photo/other clicks. */
  clicks: 'post_clicks',
} as const;

/** Story-level metrics (v25 successors of the removed story-impression metrics). */
export const STORY_METRICS = {
  views: 'story_media_view',
  viewers: 'story_total_media_view_unique',
} as const;

/**
 * Legacy metric name → v25 successor. `null` means the metric was removed with
 * no direct replacement and should simply be dropped from the request.
 */
const LEGACY_TO_V25: Record<string, string | null> = {
  // page
  page_impressions: PAGE_METRICS.views,
  page_impressions_unique: PAGE_METRICS.viewers,
  page_impressions_paid: PAGE_METRICS.views,
  page_impressions_paid_unique: PAGE_METRICS.viewers,
  page_impressions_organic: PAGE_METRICS.views,
  page_posts_impressions: PAGE_METRICS.views,
  page_posts_impressions_unique: PAGE_METRICS.viewers,
  page_engaged_users: PAGE_METRICS.engagement,
  page_consumptions: PAGE_METRICS.totalActions,
  page_fans: PAGE_METRICS.follows,
  page_views_total: PAGE_METRICS.views,
  // post
  post_impressions: POST_METRICS.views,
  post_impressions_unique: POST_METRICS.viewers,
  post_impressions_organic: POST_METRICS.views,
  post_impressions_paid: POST_METRICS.views,
  post_video_views: POST_METRICS.views,
  post_video_views_unique: POST_METRICS.viewers,
  // story
  page_story_impressions: STORY_METRICS.views,
  page_story_impressions_unique: STORY_METRICS.viewers,
};

/** Default page-overview metric set (all v25-valid), comma-joined for Graph. */
export const DEFAULT_PAGE_METRICS = [
  PAGE_METRICS.views,
  PAGE_METRICS.engagement,
  PAGE_METRICS.follows,
].join(',');

/**
 * Map a single metric name to its v25 successor. Already-valid names pass
 * through unchanged; removed-without-successor names return `null`.
 */
export function toV25Metric(name: string): string | null {
  const key = name.trim();
  if (key in LEGACY_TO_V25) return LEGACY_TO_V25[key];
  return key || null;
}

/**
 * Resolve a metric list (array or comma string) to a v25-safe comma string:
 * maps legacy names, drops removed-without-successor names, de-dupes, preserves
 * order. Use this before every insights request.
 */
export function toV25MetricList(metrics: string | readonly string[]): string {
  const list = Array.isArray(metrics)
    ? [...metrics]
    : String(metrics).split(',');
  const out: string[] = [];
  for (const raw of list) {
    const mapped = toV25Metric(raw);
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out.join(',');
}
