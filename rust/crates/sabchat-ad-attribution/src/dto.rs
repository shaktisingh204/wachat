//! Wire-format DTOs for the SabChat ad-attribution endpoints.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` so the
//! JSON the Next.js side speaks matches what the Rust handlers expect
//! without an intermediate translation layer.
//!
//! Stored documents are returned as `serde_json::Value` so the router
//! stays out of the way when callers evolve the document shape — the
//! same approach the sibling sabchat crates take with
//! `document_to_clean_json`.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Defaults / clamps
// ---------------------------------------------------------------------------

/// Maximum page size accepted on `/touches`. The list endpoint clamps
/// to this bound so a stray `limit=10000` from a buggy dashboard can't
/// blow the response budget.
pub const MAX_LIMIT: i64 = 200;

/// Default page size when `limit` is omitted on `/touches`.
pub const DEFAULT_LIMIT: i64 = 50;

fn default_limit() -> i64 {
    DEFAULT_LIMIT
}

// ---------------------------------------------------------------------------
// Shared sub-shapes
// ---------------------------------------------------------------------------

/// Free-form UTM cluster. All five fields are optional — most touches
/// will carry a subset (e.g. just `source` + `campaign` from a Meta
/// link with the default UTM template).
#[derive(Debug, Clone, Default, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UtmParams {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub medium: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub campaign: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub term: Option<String>,
}

impl UtmParams {
    /// True when every field is unset — the public `/touch` handler
    /// skips empty UTM blobs rather than writing a `{}` sub-document
    /// to Mongo.
    pub fn is_empty(&self) -> bool {
        self.source.is_none()
            && self.medium.is_none()
            && self.campaign.is_none()
            && self.content.is_none()
            && self.term.is_none()
    }
}

// ---------------------------------------------------------------------------
// `POST /v1/sabchat/ad-attribution-public/touch` — public_touch
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/ad-attribution-public/touch`. The visitor
/// surface — recorded when the widget bootstraps or when a webhook
/// (e.g. Meta's CTWA lookup) reports a landing.
///
/// The tenant id is **never** taken from this body — it is resolved
/// server-side via the inbox row, so a malicious client cannot spoof
/// cross-tenant touches.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicTouchBody {
    /// Required — hex `ObjectId` of the inbox the visitor landed on.
    /// Public knowledge (it's in the embed snippet) but still subject
    /// to a tenant join.
    pub inbox_id: String,
    /// Opaque visitor token minted by the widget. Stored as-is so the
    /// later conversation-start path can re-attach the touch.
    pub visitor_token: String,
    /// Source bucket — one of `meta`, `google`, `organic`, `direct`,
    /// `other`. Anything else is normalised to `other` server-side.
    #[serde(default)]
    pub source: Option<String>,
    /// Optional campaign / adset / ad ids. These are free-form strings
    /// (Meta and Google use very different shapes) so they're stored
    /// verbatim.
    #[serde(default)]
    pub campaign_id: Option<String>,
    #[serde(default)]
    pub adset_id: Option<String>,
    #[serde(default)]
    pub ad_id: Option<String>,
    /// Inline UTM blob.
    #[serde(default)]
    pub utm: Option<UtmParams>,
    /// Meta Click-to-WhatsApp click id.
    #[serde(default)]
    pub ctwa_clid: Option<String>,
    /// Google click id.
    #[serde(default)]
    pub gclid: Option<String>,
    /// Facebook click id (web tracking).
    #[serde(default)]
    pub fbclid: Option<String>,
    /// Full landing URL — useful when the UTM blob was stripped by a
    /// rewrite layer but the original URL is still available.
    #[serde(default)]
    pub landing_url: Option<String>,
}

/// Response body for `POST /v1/sabchat/ad-attribution-public/touch`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicTouchResponse {
    /// Hex `ObjectId` of the freshly inserted touch row.
    pub touch_id: String,
}

// ---------------------------------------------------------------------------
// `GET /v1/sabchat/ad-attribution/touches` — list_touches
// ---------------------------------------------------------------------------

/// Query string for `GET /v1/sabchat/ad-attribution/touches`. Filters
/// are all optional — an empty query returns the most recent
/// `DEFAULT_LIMIT` touches for the tenant.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTouchesQuery {
    /// Optional — restrict to touches bound to a specific conversation.
    #[serde(default)]
    pub conversation_id: Option<String>,
    /// Page size — clamped to `[1, MAX_LIMIT]` server-side.
    #[serde(default = "default_limit")]
    pub limit: i64,
    /// Hex `ObjectId` cursor — touches with `_id < cursor` only.
    /// Newest-first scroll (ObjectIds are monotonic with insertion
    /// time, so this is equivalent to `capturedAt DESC`).
    #[serde(default)]
    pub cursor: Option<String>,
}

/// Response body for `GET /v1/sabchat/ad-attribution/touches`. Sorted
/// newest-first by `_id`. `nextCursor` is the `_id` of the **last**
/// document in `touches` — pass it back as `cursor` to fetch the next
/// page. `None` means the caller has reached the end.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTouchesResponse {
    #[schema(value_type = Vec<Object>)]
    pub touches: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

// ---------------------------------------------------------------------------
// `POST /v1/sabchat/ad-attribution/attribute-revenue` — attribute_revenue
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/ad-attribution/attribute-revenue`.
///
/// Finds the conversation's most recent touch (if any), inserts a row
/// into `sabchat_ad_revenue_attributions`, and increments the touch's
/// `attributed_revenue_minor` counter. Revenue with no matching touch
/// returns `404 Not Found` so the caller knows the loop did not close.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AttributeRevenueBody {
    /// Hex `ObjectId` of the conversation that closed.
    pub conversation_id: String,
    /// Amount in minor units (e.g. `1999` = ₹19.99 or $19.99). Negative
    /// values are rejected — refund flows should call this endpoint
    /// with a separate `source: "manual"` row instead.
    pub amount_minor: i64,
    /// ISO 4217 currency code. Stored verbatim — no validation beyond
    /// non-empty.
    pub currency: String,
    /// Optional source discriminant. Defaults to `payment_request` when
    /// omitted. Anything other than `payment_request` / `manual` is
    /// normalised to `manual` server-side.
    #[serde(default)]
    pub source: Option<String>,
}

/// Response body for `POST /v1/sabchat/ad-attribution/attribute-revenue`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AttributeRevenueResponse {
    /// Hex `ObjectId` of the newly inserted attribution row.
    pub attribution_id: String,
    /// Hex `ObjectId` of the touch the revenue was bound to.
    pub touch_id: String,
}

// ---------------------------------------------------------------------------
// `GET /v1/sabchat/ad-attribution/report` — report
// ---------------------------------------------------------------------------

/// `groupBy` discriminant on `/report`. Free-form `String` on the wire
/// so the dashboard can lazily add buckets later without bumping this
/// crate, but the handler only understands `source` / `campaign` / `ad`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReportQuery {
    /// RFC 3339 timestamp — inclusive lower bound on `capturedAt`.
    #[serde(default)]
    pub from: Option<String>,
    /// RFC 3339 timestamp — exclusive upper bound on `capturedAt`.
    #[serde(default)]
    pub to: Option<String>,
    /// `source` | `campaign` | `ad`. Defaults to `source` when omitted
    /// or unrecognised.
    #[serde(default)]
    pub group_by: Option<String>,
}

/// One row of the `/report` aggregation. `groupKey` is the bucket id
/// (the source name, campaign id, or ad id depending on `groupBy`).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReportEntry {
    pub group_key: String,
    pub conversation_count: i64,
    pub revenue_minor: i64,
}

/// Response body for `GET /v1/sabchat/ad-attribution/report`. Rows are
/// returned sorted by `revenueMinor DESC` so dashboards can render the
/// top-revenue buckets without re-sorting client-side.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReportResponse {
    pub group_by: String,
    pub entries: Vec<ReportEntry>,
}
