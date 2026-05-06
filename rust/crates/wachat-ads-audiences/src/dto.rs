//! Wire DTOs for the Ad Manager Audiences + Targeting + Reach router.
//!
//! Most endpoints return free-form Graph API JSON because the TS callers
//! already understand the Meta Graph shapes. We use `serde_json::Value`
//! generously rather than re-typing every Graph object.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
//  Generic envelopes (mirroring the TS `ActionResult<T> = { data?, error? }`)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AckResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub success: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub data: Option<Value>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ListResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub data: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ValueResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  getCustomAudiences
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AudiencesResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub audiences: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  createCustomAudience
// ---------------------------------------------------------------------------

/// Mirrors `CreateCustomAudienceInput` on the TS side.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateCustomAudienceBody {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// `CUSTOM | WEBSITE | APP | ENGAGEMENT | OFFLINE_CONVERSION`.
    pub subtype: String,
    #[serde(default)]
    pub customer_file_source: Option<String>,
    #[serde(default)]
    pub retention_days: Option<i64>,
    /// Optional rule object — JSON-stringified before being sent to Graph.
    #[serde(default)]
    #[schema(value_type = Object)]
    pub rule: Option<Value>,
}

// ---------------------------------------------------------------------------
//  createLookalikeAudience
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateLookalikeBody {
    pub name: String,
    pub origin_audience_id: String,
    /// ISO 3166 alpha-2 country code.
    pub country: String,
    /// 0.01 .. 0.20 — defaults to 0.01 when omitted.
    #[serde(default)]
    pub ratio: Option<f64>,
}

// ---------------------------------------------------------------------------
//  createSavedAudience
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateSavedAudienceBody {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// Free-form Meta targeting spec — JSON-stringified before forwarding.
    #[schema(value_type = Object)]
    pub targeting: Value,
}

// ---------------------------------------------------------------------------
//  addUsersToCustomAudience / removeUsersFromCustomAudience
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct AudienceUsersBody {
    /// e.g. `["EMAIL","PHONE","FN","LN","CT","ST","ZIP","COUNTRY"]`.
    pub schema: Vec<String>,
    /// Pre-hashed (SHA-256) rows, each row aligned with `schema` columns.
    #[serde(rename = "hashedUsers")]
    pub hashed_users: Vec<Vec<String>>,
}

// ---------------------------------------------------------------------------
//  shareCustomAudience
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ShareAudienceBody {
    /// Ad-account ids — `act_` prefix is added server-side if missing.
    #[serde(rename = "accountIds")]
    pub account_ids: Vec<String>,
}

// ---------------------------------------------------------------------------
//  createWebsiteRetargetingAudience
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct WebsiteRetargetingBody {
    pub name: String,
    pub pixel_id: String,
    /// `{ inclusions: {...}, exclusions?: {...} }` — JSON-stringified before
    /// being sent to Graph.
    #[schema(value_type = Object)]
    pub rule: Value,
    /// Defaults to 180 days when omitted (matches the TS fallback).
    #[serde(default)]
    pub retention_days: Option<i64>,
}

// ---------------------------------------------------------------------------
//  searchTargeting
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Default)]
pub struct SearchTargetingQuery {
    /// The free-text search query.
    pub q: String,
    /// One of: `adinterest | adgeolocation | adworkposition | adworkemployer
    /// | adeducationschool | adeducationmajor | adlocale`. Defaults to
    /// `adinterest`.
    #[serde(default, rename = "type")]
    pub type_: Option<String>,
    /// Comma-separated `location_types` — only honored when `type=adgeolocation`.
    #[serde(default, rename = "locationTypes")]
    pub location_types: Option<String>,
}

// ---------------------------------------------------------------------------
//  browseTargeting
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Default)]
pub struct BrowseTargetingQuery {
    /// `adinterest_category | behaviors | demographics`.
    #[serde(rename = "type")]
    pub type_: String,
}

// ---------------------------------------------------------------------------
//  getReachEstimate
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ReachEstimateBody {
    #[schema(value_type = Object)]
    pub targeting: Value,
    #[serde(default)]
    pub optimization_goal: Option<String>,
    /// Currency hint — accepted for API parity, not currently forwarded.
    #[serde(default)]
    pub currency: Option<String>,
}

// ---------------------------------------------------------------------------
//  getDeliveryEstimate
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct DeliveryEstimateBody {
    #[schema(value_type = Object)]
    pub targeting_spec: Value,
    pub optimization_goal: String,
    #[serde(default)]
    pub daily_budget: Option<i64>,
}

// ---------------------------------------------------------------------------
//  suggestTargeting
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SuggestTargetingBody {
    /// List of interest names to seed the suggestion engine.
    #[serde(rename = "interestList")]
    pub interest_list: Vec<String>,
}

// ---------------------------------------------------------------------------
//  validateTargeting
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ValidateInterest {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ValidateTargetingBody {
    pub interests: Vec<ValidateInterest>,
}

// ---------------------------------------------------------------------------
//  getTargetingSentenceLines
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct TargetingSentenceLinesBody {
    #[schema(value_type = Object)]
    pub targeting: Value,
}

// ---------------------------------------------------------------------------
//  createReachFrequencyPrediction
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateRfpBody {
    #[serde(default)]
    pub campaign_group_id: Option<String>,
    pub name: String,
    /// Free-form Meta targeting spec — JSON-stringified before forwarding.
    #[schema(value_type = Object)]
    pub target_spec: Value,
    /// Budget in minor currency units (cents/paise).
    pub budget: i64,
    pub start_time: String,
    pub end_time: String,
    /// `RESERVED` (default) or `AUCTION`.
    #[serde(default)]
    pub buying_type: Option<String>,
    #[serde(default)]
    pub prediction_mode: Option<i64>,
    #[serde(default)]
    pub story_event_type: Option<i64>,
    #[serde(default)]
    pub destination_id: Option<String>,
    #[serde(default)]
    pub destination_ids: Option<Vec<String>>,
    #[serde(default)]
    pub instream_packages: Option<Vec<String>>,
}
