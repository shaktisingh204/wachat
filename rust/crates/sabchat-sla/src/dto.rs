//! Wire-format DTOs for the SabChat SLA policy endpoints.
//!
//! Mirrors the shape stored in `sabchat_sla_policies`:
//!
//! ```text
//! { _id, tenant_id, name,
//!   applies_to: { inboxIds?: [string], priorities?: ["low"|...|"urgent"] },
//!   first_response_minutes?: u32,
//!   next_response_minutes?: u32,
//!   resolution_minutes?: u32,
//!   active: bool,
//!   created_at, updated_at }
//! ```
//!
//! Every body / response uses `#[serde(rename_all = "camelCase")]` to
//! match the JSON the Next.js shim sends. Hex `ObjectId` strings are
//! used on the wire — the handlers parse them via
//! [`oid_from_str`](sabnode_db::bson_helpers::oid_from_str).

use chrono::{DateTime, Utc};
use sabchat_types::ConversationPriority;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// `applies_to` matcher
// ---------------------------------------------------------------------------

/// Matcher block on each policy. Either / both fields are optional —
/// a fully empty `AppliesTo` is the wildcard policy (lowest specificity).
///
/// * `inbox_ids` — hex `ObjectId` strings. Policy applies when the
///   conversation's `inboxId` is in this list.
/// * `priorities` — list of [`ConversationPriority`] values. Policy
///   applies when the conversation's `priority` is in this list.
///
/// Specificity ranking used by [`crate::pick_policy_for`]:
/// * `inboxIds` match contributes a higher weight than `priorities`,
///   so an inbox-specific policy wins over a priority-only one and a
///   policy that matches both fields wins over either alone.
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AppliesTo {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inbox_ids: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priorities: Option<Vec<ConversationPriority>>,
}

// ---------------------------------------------------------------------------
// `POST /policies` — create
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/sla/policies`. At least one of the three
/// timer fields must be present — the handler rejects a request that
/// would create a policy that ticks nothing.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreatePolicyBody {
    pub name: String,
    #[serde(default)]
    pub applies_to: AppliesTo,
    #[serde(default)]
    pub first_response_minutes: Option<u32>,
    #[serde(default)]
    pub next_response_minutes: Option<u32>,
    #[serde(default)]
    pub resolution_minutes: Option<u32>,
    /// Defaults to `true` so newly-created policies are immediately
    /// pickable by [`crate::pick_policy_for`].
    #[serde(default = "default_active")]
    pub active: bool,
}

// ---------------------------------------------------------------------------
// `PATCH /policies/{id}` — update
// ---------------------------------------------------------------------------

/// Body for `PATCH /v1/sabchat/sla/policies/{id}`. Every field is
/// optional and only the provided fields are `$set` — same partial-
/// update semantics as the wachat-contacts crate.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePolicyBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub applies_to: Option<AppliesTo>,
    #[serde(default)]
    pub first_response_minutes: Option<u32>,
    #[serde(default)]
    pub next_response_minutes: Option<u32>,
    #[serde(default)]
    pub resolution_minutes: Option<u32>,
    #[serde(default)]
    pub active: Option<bool>,
}

// ---------------------------------------------------------------------------
// Stored / rendered policy
// ---------------------------------------------------------------------------

/// Rendered policy returned by GET / POST / PATCH endpoints. ObjectIds
/// are hex strings; timestamps are ISO 8601.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SlaPolicyDoc {
    #[serde(rename = "_id")]
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    #[serde(default)]
    pub applies_to: AppliesTo,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub first_response_minutes: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_response_minutes: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolution_minutes: Option<u32>,
    pub active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// List response
// ---------------------------------------------------------------------------

/// Response body for `GET /v1/sabchat/sla/policies`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListPoliciesResponse {
    pub policies: Vec<SlaPolicyDoc>,
    pub total: u64,
}

// ---------------------------------------------------------------------------
// Sweep response
// ---------------------------------------------------------------------------

/// Response body for `POST /v1/sabchat/sla/sweep`. `scanned` is every
/// open conversation visited; `breached` is the count whose stored
/// `sla.breached` flag is now `true` after the recompute.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SweepResponse {
    pub scanned: u64,
    pub breached: u64,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by DELETE.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

fn default_active() -> bool {
    true
}
