//! Wire DTOs for the Facebook Pages router.
//!
//! Most endpoints return free-form Graph API JSON because the TS callers
//! already understand the Meta Graph shapes. We use `serde_json::Value`
//! generously rather than re-typing every Graph object.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
//  Generic envelopes (mirroring the TS `{ success?, error? }` shapes)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AckResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub success: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "redirectPath")]
    pub redirect_path: Option<String>,
}

// ---------------------------------------------------------------------------
//  handleFacebookPageSetup
// ---------------------------------------------------------------------------

/// Body for `POST /v1/facebook/pages/setup`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct PageSetupBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "facebookPageId")]
    pub facebook_page_id: String,
    #[serde(rename = "accessToken")]
    pub access_token: String,
}

// ---------------------------------------------------------------------------
//  handleFacebookOAuthCallback
// ---------------------------------------------------------------------------

/// Body for `POST /v1/facebook/pages/oauth-callback`.
///
/// The TS action reads `onboarding_state` from `cookies()` directly. Since
/// the Rust BFF is fronted by Next.js, the calling shim is responsible for
/// decoding the cookie and forwarding the relevant fields here.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct OAuthCallbackBody {
    pub code: String,
    pub state: String,
    /// Hex string of the user's Mongo `_id` — sourced from the JWT-issued
    /// session on the TS side; passed through so handlers don't need to
    /// re-decode the session cookie in Rust.
    #[serde(rename = "userId")]
    pub user_id: String,
    /// Value parsed from the `onboarding_state` cookie. Must match the
    /// `state` query parameter or the request is rejected.
    #[serde(rename = "stateCookie")]
    pub state_cookie: String,
    /// Whether the user opted in to catalog scopes in this OAuth flow. The
    /// WhatsApp branch uses this to flip `hasCatalogManagement` on the
    /// project doc — we accept it here for parity even though this slice
    /// doesn't currently honor it (no WhatsApp branch yet).
    #[serde(default, rename = "includeCatalog")]
    pub include_catalog: bool,
    /// Facebook Login for Business (JS-SDK `FB.login`) flow. When `true` the
    /// one-time `code` is exchanged WITHOUT a `redirect_uri` — the SDK never
    /// performed a server redirect, so sending one yields a `redirect_uri`
    /// mismatch. Plain redirect OAuth leaves this `false`.
    #[serde(default)]
    pub embedded: bool,
}

// ---------------------------------------------------------------------------
//  handleManualFacebookPageSetup
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ManualSetupBody {
    #[serde(rename = "projectName")]
    pub project_name: String,
    #[serde(rename = "facebookPageId")]
    pub facebook_page_id: String,
    #[serde(rename = "accessToken")]
    pub access_token: String,
}

// ---------------------------------------------------------------------------
//  getFacebookPages
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct PagesResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub pages: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  getPageDetails
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct PageDetailsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub page: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  handleUpdatePageDetails
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdatePageDetailsBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "pageId")]
    pub page_id: String,
    #[serde(default)]
    pub about: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
}

// ---------------------------------------------------------------------------
//  getPageInsights
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct PageInsightsCompact {
    #[serde(rename = "pageReach")]
    pub page_reach: i64,
    #[serde(rename = "postEngagement")]
    pub post_engagement: i64,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct PageInsightsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub insights: Option<PageInsightsCompact>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  getDetailedPageInsights
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Default)]
pub struct DetailedInsightsQuery {
    #[serde(default)]
    pub metrics: Option<String>,
    #[serde(default)]
    pub period: Option<String>,
    #[serde(default)]
    pub since: Option<String>,
    #[serde(default)]
    pub until: Option<String>,
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
pub struct DemographicsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub demographics: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Page CTA
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct CtaResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub cta: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SetCtaBody {
    /// Must be one of:
    /// `BOOK_NOW | CALL_NOW | CONTACT_US | GET_QUOTE | MESSAGE_PAGE |`
    /// `ORDER_FOOD | SHOP_NOW | SIGN_UP | WATCH_VIDEO | SEND_EMAIL | LEARN_MORE`.
    #[serde(rename = "type")]
    pub cta_type: String,
    #[serde(default, rename = "webUrl")]
    pub web_url: Option<String>,
}

// ---------------------------------------------------------------------------
//  Token management
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct DebugTokenResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "tokenInfo")]
    #[schema(value_type = Object)]
    pub token_info: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct RefreshTokenResp {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "newExpiry")]
    pub new_expiry: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Live videos
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct LiveVideosResp {
    #[serde(skip_serializing_if = "Option::is_none", rename = "liveVideos")]
    #[schema(value_type = Vec<Object>)]
    pub live_videos: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateLiveVideoBody {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct CreateLiveVideoResp {
    #[serde(skip_serializing_if = "Option::is_none", rename = "liveVideo")]
    #[schema(value_type = Object)]
    pub live_video: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct LiveVideoCommentsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub comments: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Settings / locations / tabs / roles — all return open `data` arrays
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct SettingsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub settings: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct LocationsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub locations: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct TabsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub tabs: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct RolesResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub roles: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct InsightsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub insights: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
