//! Wire DTOs for the Ad Manager Pixels router.
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
//  createPixel
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreatePixelBody {
    pub name: String,
}

// ---------------------------------------------------------------------------
//  getPixelStats
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Default)]
pub struct PixelStatsQuery {
    /// `event` (default), `browser_type`, or `url`.
    #[serde(default)]
    pub aggregation: Option<String>,
}

// ---------------------------------------------------------------------------
//  sharePixelWithAdAccount
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SharePixelBody {
    #[serde(rename = "adAccountId")]
    pub ad_account_id: String,
}

// ---------------------------------------------------------------------------
//  createCustomConversion
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateCustomConversionBody {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub custom_event_type: String,
    /// Free-form rule object — the TS `validate(CustomConversionInput, …)`
    /// schema treats this as `z.record(z.string(), z.unknown())`. We pass it
    /// straight through to Graph as a JSON-encoded string (Graph wants the
    /// `rule` field stringified).
    #[schema(value_type = Object)]
    pub rule: Value,
    #[serde(default)]
    pub default_conversion_value: Option<f64>,
}

// ---------------------------------------------------------------------------
//  sendConversionApiEvent
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ConversionApiEventBody {
    pub event_name: String,
    pub event_time: i64,
    /// Required user identifiers (hashed where Meta requires it). Mirrors
    /// `z.record(z.string(), z.unknown())` on the TS side.
    #[schema(value_type = Object)]
    pub user_data: Value,
    #[serde(default)]
    #[schema(value_type = Object)]
    pub custom_data: Option<Value>,
    #[serde(default)]
    pub action_source: Option<String>,
    #[serde(default)]
    pub event_source_url: Option<String>,
}

// ---------------------------------------------------------------------------
//  uploadOfflineEvents
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UploadOfflineEventsBody {
    /// Array of offline-conversion event objects. Each entry is a free-form
    /// JSON map per the Marketing API offline-event docs.
    #[schema(value_type = Vec<Object>)]
    pub events: Vec<Value>,
}

// ---------------------------------------------------------------------------
//  getLeadsFromForm
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Default)]
pub struct LeadsQuery {
    /// Unix epoch seconds — when set, Graph is queried with a
    /// `time_created > since` filter (matches the legacy `since?: number`
    /// argument).
    #[serde(default)]
    pub since: Option<i64>,
}

// ---------------------------------------------------------------------------
//  createProductSet
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateProductSetBody {
    pub name: String,
    /// Optional Meta product-set filter expression. Mirrors
    /// `filter?: Record<string, any>` and is JSON-stringified before being
    /// sent on to Graph.
    #[serde(default)]
    #[schema(value_type = Object)]
    pub filter: Option<Value>,
}
