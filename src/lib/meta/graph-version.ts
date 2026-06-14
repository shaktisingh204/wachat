/**
 * Single source of truth for the Meta Graph API version used across SabNode
 * (Facebook Pages / Meta Suite, WhatsApp, Instagram, Ads, lead gen, …).
 *
 * Meta ships a new Graph API version roughly every quarter and hard-deprecates
 * old ones on a rolling schedule (v18/v19 → May 2026, v20 → Sep 2026). Pinning
 * the version in one place keeps every call on a supported version and turns the
 * next bump into a one-line change.
 *
 * IMPORTANT: keep this in sync with the Rust constant in
 * `rust/crates/wachat-meta-client/src/lib.rs` (`GRAPH_API_VERSION`).
 *
 * v25.0 note: the legacy reach/impressions metric family (`page_impressions*`,
 * `post_impressions*`, `page_fans`, story impressions) is being removed in 2026.
 * Request insights through `@/lib/meta/insights-metrics` so callers never ask
 * for a deprecated metric.
 */
export const GRAPH_API_VERSION = 'v25.0' as const;

/** Base URL for Graph API data calls, e.g. `${META_GRAPH_BASE}/me/accounts`. */
export const META_GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}` as const;

/** OAuth dialog base for the legacy redirect login flow. */
export const META_OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth` as const;

/**
 * Build a Graph API data URL from a bare node/edge path (leading slashes are
 * trimmed): `graphUrl('me/accounts')` → `https://graph.facebook.com/v25.0/me/accounts`.
 */
export function graphUrl(path: string): string {
  return `${META_GRAPH_BASE}/${path.replace(/^\/+/, '')}`;
}
