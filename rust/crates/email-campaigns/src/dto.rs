//! Wire DTOs (HTTP request / response shapes) for the campaigns router.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` to match
//! the JSON shape the TS shim sends. Persisted campaign docs are returned
//! as `serde_json::Value` so the router stays out of the way when the
//! document shape evolves — same pattern `wachat-broadcast` uses.

use chrono::{DateTime, Utc};
use email_types::{
    EmailCampaignAbConfig, EmailCampaignStatus, EmailCampaignType, EmailCampaignVariant,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Pagination + list query
// ---------------------------------------------------------------------------

fn default_page() -> u64 {
    1
}
fn default_limit() -> u64 {
    20
}

/// `GET /` — list campaigns with optional filters.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CampaignsQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: u64,
    #[serde(default)]
    pub status: Option<EmailCampaignStatus>,
    #[serde(default, rename = "type")]
    pub kind: Option<EmailCampaignType>,
    /// Hex `ObjectId` — narrows to campaigns targeting this list.
    #[serde(default)]
    pub list_id: Option<String>,
}

/// `{ items, total, page, limit, hasMore }` — generic page envelope.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse<T> {
    pub items: Vec<T>,
    pub total: u64,
    pub page: u64,
    pub limit: u64,
    pub has_more: bool,
}

/// Single-field success envelope (matches the legacy TS shim shape).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageResponse {
    pub message: String,
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

/// `POST /` — create a draft campaign. Everything is optional except a
/// human name and a `type` discriminator; the user fills in subject /
/// body / lists / variants via subsequent `PATCH` calls or the wizard.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCampaignBody {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: EmailCampaignType,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub from_name: Option<String>,
    #[serde(default)]
    pub from_email: Option<String>,
    #[serde(default)]
    pub preheader: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub template_id: Option<String>,
    #[serde(default)]
    pub brand_kit_id: Option<String>,
    #[serde(default)]
    pub list_ids: Vec<String>,
    #[serde(default)]
    pub segment_ids: Vec<String>,
    #[serde(default)]
    pub variants: Vec<EmailCampaignVariant>,
    #[serde(default)]
    pub ab_config: Option<EmailCampaignAbConfig>,
    #[serde(default)]
    pub track_opens: Option<bool>,
    #[serde(default)]
    pub track_clicks: Option<bool>,
    #[serde(default)]
    pub scheduled_at: Option<DateTime<Utc>>,
}

/// `PATCH /{id}` — every field optional. Only applies if the campaign
/// is still in `draft` status (handlers enforce).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCampaignBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub from_name: Option<String>,
    #[serde(default)]
    pub from_email: Option<String>,
    #[serde(default)]
    pub preheader: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub template_id: Option<String>,
    #[serde(default)]
    pub brand_kit_id: Option<String>,
    #[serde(default)]
    pub list_ids: Option<Vec<String>>,
    #[serde(default)]
    pub segment_ids: Option<Vec<String>>,
    #[serde(default)]
    pub variants: Option<Vec<EmailCampaignVariant>>,
    #[serde(default)]
    pub ab_config: Option<EmailCampaignAbConfig>,
    #[serde(default)]
    pub track_opens: Option<bool>,
    #[serde(default)]
    pub track_clicks: Option<bool>,
    #[serde(default)]
    pub scheduled_at: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
// Lifecycle bodies
// ---------------------------------------------------------------------------

/// `POST /{id}/test-send` — send to a small set of inboxes for QA.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestSendBody {
    pub to_emails: Vec<String>,
}

/// `POST /{id}/schedule` — flip draft → scheduled at a future time.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleBody {
    pub scheduled_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Preview / recipients / report
// ---------------------------------------------------------------------------

/// `GET /{id}/preview` — optional sample-subscriber to interpolate.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewQuery {
    /// Optional hex `ObjectId` of an `email_subscribers` row whose merge
    /// tags should be applied. When absent, a synthetic placeholder
    /// subscriber is used.
    #[serde(default)]
    pub subscriber_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResponse {
    pub subject: String,
    pub html: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipientsCountResponse {
    /// Total recipients after subtracting suppressions.
    pub count: u64,
    /// Total recipients before suppression filtering.
    pub gross: u64,
    /// Number suppressed (bounces, complaints, unsubscribes).
    pub suppressed: u64,
}

/// Aggregated KPI envelope returned by `GET /{id}/report`. Pulled from
/// the `email_reports_cache` collection — if no cache row exists yet the
/// envelope is returned with zeros so the UI can render without errors.
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ReportResponse {
    pub sent: u64,
    pub delivered: u64,
    pub opens: u64,
    pub unique_opens: u64,
    pub clicks: u64,
    pub unique_clicks: u64,
    pub bounces: u64,
    pub complaints: u64,
    pub unsubscribes: u64,
    /// Pass-through of the raw cache document for any provider-specific
    /// fields the UI wants to render. `None` when no cache exists.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub raw: Option<Value>,
}
