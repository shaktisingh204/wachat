//! Wire DTOs for the Facebook misc router.
//!
//! Most responses pass through Graph API JSON arrays/objects unchanged
//! using `serde_json::Value` — the legacy TS callers already understand
//! the Meta Graph shapes.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
//  Generic envelopes
// ---------------------------------------------------------------------------

/// `{ success?, error? }` — matches the TS server-action ack shape.
#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AckResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub success: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  getBlockedProfiles
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct BlockedProfilesResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub profiles: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  getSubscribedApps / unsubscribeApp
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct SubscribedAppsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub apps: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  updateWebhookSubscription
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateWebhookSubscriptionBody {
    /// Comma-joined on the wire to Meta — accept as a list here for parity
    /// with the TS signature `(projectId, subscribedFields: string[])`.
    #[serde(rename = "subscribedFields")]
    pub subscribed_fields: Vec<String>,
}

// ---------------------------------------------------------------------------
//  getMessagingFeatureReview
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct MessagingFeatureReviewItem {
    pub feature: String,
    pub status: String,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct MessagingFeatureReviewResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub features: Option<Vec<MessagingFeatureReviewItem>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  getPublishingAuthStatus
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct PublishingAuthStatusResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Competitors
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct CompetitorsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub competitors: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct AddCompetitorBody {
    /// Facebook Page ID of the competitor to track.
    #[serde(rename = "pageId")]
    pub page_id: String,
}
