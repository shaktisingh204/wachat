//! Wire-format DTOs for the SabChat cart-recovery endpoints.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` to match
//! the JSON shape the Next.js shim sends. Stored documents are returned
//! as `serde_json::Value` so the router stays out of the way as the
//! document shape evolves — same approach the rest of the SabChat
//! surface uses (`document_to_clean_json`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Defaults / constants
// ---------------------------------------------------------------------------

/// Default page size for list endpoints (carts, triggers). Matches the
/// per-page cap used by the sibling SabChat read surfaces.
pub const DEFAULT_LIMIT: i64 = 50;

/// Hard upper bound on list endpoint page size — kept in lockstep with
/// `MAX_LIMIT` in `sabchat-audit` so the operator UI can use one
/// constant.
pub const MAX_LIMIT: i64 = 200;

fn default_limit() -> i64 {
    DEFAULT_LIMIT
}

fn default_true() -> bool {
    true
}

// ===========================================================================
// Cart-event ingestion (public — widget / storefront snippet)
// ===========================================================================

/// One line item in the cart payload. Mirrors the
/// `{ productId, name, quantity, priceMinor, currency }` shape stored
/// on `sabchat_carts.items[]`.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CartItem {
    pub product_id: String,
    pub name: String,
    pub quantity: i64,
    pub price_minor: i64,
    pub currency: String,
}

/// Body for `POST /events` — visitor-side cart upsert. The widget posts
/// this every time the visitor's cart changes; the handler upserts the
/// row keyed by `(inboxId, visitorToken)` with `lastEventAt = now` and
/// `status = "active"`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CartEventBody {
    /// Hex `ObjectId` of the inbox the visitor is talking to. We use it
    /// to resolve the tenant for the cart row — the request body never
    /// carries a `tenantId` directly.
    pub inbox_id: String,
    /// Opaque per-visitor token from the widget session. Anonymous
    /// visitors get one when the widget bootstraps.
    pub visitor_token: String,
    /// Optional resolved contact id once the visitor has identified
    /// themselves (post sign-in / email-capture). The handler will
    /// `$set` it on the cart so the agent UI can link to the contact.
    #[serde(default)]
    pub contact_id: Option<String>,
    /// Current cart contents. Empty arrays are allowed — the handler
    /// still bumps `lastEventAt` so the sweep doesn't fire on a row the
    /// visitor just emptied (an empty cart is not "abandoned").
    #[serde(default)]
    pub items: Vec<CartItem>,
    /// Total order value in the currency's minor units (cents, paise).
    pub total_minor: i64,
    /// ISO 4217 currency code (e.g. `"USD"`, `"INR"`).
    pub currency: String,
}

/// Response envelope for `POST /events` — hands back the upserted cart
/// id so the storefront can correlate against future events.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CartEventResponse {
    pub cart_id: String,
}

/// Body for `POST /events/recover` — visitor completed the purchase
/// against this cart row. Marks `status = "recovered"`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CartRecoverBody {
    pub cart_id: String,
}

/// Generic `{ ok: true }` envelope returned by the recover endpoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}

impl OkResponse {
    pub fn yes() -> Self {
        Self { ok: true }
    }
}

// ===========================================================================
// Recovery rule CRUD (agent-side)
// ===========================================================================

/// Body for `POST /rules` — create a recovery rule for the tenant.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateRuleBody {
    /// How many minutes a cart must have been idle before this rule
    /// fires. Stored on the rule so the sweep can compute
    /// `now - lastEventAt >= idleMinutes` per-rule.
    pub idle_minutes: u32,
    /// Optional minimum cart total (minor units) — rules can be scoped
    /// to "only chase carts above $50".
    #[serde(default)]
    pub min_total_minor: Option<i64>,
    /// One of `"send_message" | "open_widget" | "send_coupon"` — the
    /// sweep logs this verbatim on the trigger row.
    pub action: String,
    /// Optional message template — used when `action == "send_message"`.
    #[serde(default)]
    pub message_template: Option<String>,
    /// Optional coupon code — used when `action == "send_coupon"`.
    #[serde(default)]
    pub coupon_code: Option<String>,
    /// Whether the rule should be considered by the sweep. New rules
    /// default to `active = true`.
    #[serde(default = "default_true")]
    pub active: bool,
}

/// Body for `PATCH /rules/{id}` — partial rule update. Every field is
/// optional; only the provided fields are `$set`.
#[derive(Debug, Clone, Deserialize, ToSchema, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRuleBody {
    #[serde(default)]
    pub idle_minutes: Option<u32>,
    #[serde(default)]
    pub min_total_minor: Option<i64>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub message_template: Option<String>,
    #[serde(default)]
    pub coupon_code: Option<String>,
    #[serde(default)]
    pub active: Option<bool>,
}

/// Response envelope returned by every rule mutation that creates a
/// document — hands back the persisted row so the caller can render it
/// without a follow-up GET.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RuleResponse {
    #[schema(value_type = Object)]
    pub rule: Value,
}

/// Response envelope for `GET /rules` — a tenant has at most a handful
/// of rules, so the list endpoint is unpaginated.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListRulesResponse {
    #[schema(value_type = Vec<Object>)]
    pub rules: Vec<Value>,
}

// ===========================================================================
// Cart read surfaces (agent-side)
// ===========================================================================

/// Query string for `GET /carts`. All filters are optional; an empty
/// query returns the most recent `DEFAULT_LIMIT` carts for the tenant.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListCartsQuery {
    /// One of `"active" | "recovered" | "abandoned"`. Unknown values
    /// produce an empty result set.
    #[serde(default)]
    pub status: Option<String>,
    /// Optional inbox-scope filter.
    #[serde(default)]
    pub inbox_id: Option<String>,
    /// Page size — clamped to `[1, MAX_LIMIT]`.
    #[serde(default = "default_limit")]
    pub limit: i64,
    /// Cursor returned by the previous page — opaque hex `_id`. Pages
    /// are newest-first by `_id`.
    #[serde(default)]
    pub cursor: Option<String>,
}

/// Response envelope for `GET /carts` — carts + opaque next cursor.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListCartsResponse {
    #[schema(value_type = Vec<Object>)]
    pub carts: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

// ===========================================================================
// Sweep
// ===========================================================================

/// Body for `POST /sweep`. Intentionally empty today — the sweep walks
/// every active cart for the tenant. Reserved for future per-rule /
/// dry-run flags.
#[derive(Debug, Clone, Deserialize, ToSchema, Default)]
#[serde(rename_all = "camelCase")]
pub struct SweepBody {}

/// Response envelope for `POST /sweep`. `scanned` is the number of
/// `status == "active"` carts the sweep considered; `fired` is the
/// number that actually had a matching rule and produced a trigger row.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SweepResponse {
    pub scanned: u64,
    pub fired: u64,
}

// ===========================================================================
// Trigger log read surface (agent-side)
// ===========================================================================

/// Query string for `GET /triggers`. Mirrors the cart-list pagination
/// contract — cursor-style on `_id`, newest first.
///
/// **Note:** the route spec calls the cart filter `carteId` (sic) — we
/// honour that wire form here but expose it as `cart_id` internally.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTriggersQuery {
    /// Optional cart-scope filter. Honours both the spec'd `carteId`
    /// and the more conventional `cartId` query keys.
    #[serde(default, alias = "carteId")]
    pub cart_id: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub cursor: Option<String>,
}

/// Response envelope for `GET /triggers`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTriggersResponse {
    #[schema(value_type = Vec<Object>)]
    pub triggers: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}
