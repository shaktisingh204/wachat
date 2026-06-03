//! Wire DTOs for the Messenger Profile / Personas / Saved Responses router.
//!
//! Most endpoints return free-form Graph API JSON because the TS callers
//! already understand the Meta Graph shapes. We use `serde_json::Value`
//! generously rather than re-typing every Graph object.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
//  Generic envelopes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AckResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub success: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct MessageResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  getMessengerProfile
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ProfileQuery {
    /// Comma-separated Graph fields list. When omitted, mirrors the TS
    /// default: `greeting,get_started,persistent_menu,ice_breakers,whitelisted_domains`.
    #[serde(default)]
    pub fields: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ProfileResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub profile: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  setMessengerGreeting
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SetGreetingBody {
    /// Greeting text shown to first-time visitors before they message the page.
    pub greeting: String,
}

// ---------------------------------------------------------------------------
//  setMessengerGetStarted
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SetGetStartedBody {
    /// Postback payload fired when a new user taps "Get Started".
    pub payload: String,
}

// ---------------------------------------------------------------------------
//  setMessengerIceBreakers
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct IceBreakerInput {
    pub question: String,
    pub payload: String,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SetIceBreakersBody {
    #[serde(rename = "iceBreakers")]
    pub ice_breakers: Vec<IceBreakerInput>,
}

// ---------------------------------------------------------------------------
//  setWhitelistedDomains
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SetWhitelistedDomainsBody {
    pub domains: Vec<String>,
}

// ---------------------------------------------------------------------------
//  deleteMessengerProfileFields
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct DeleteProfileFieldsBody {
    pub fields: Vec<String>,
}

// ---------------------------------------------------------------------------
//  savePersistentMenu
// ---------------------------------------------------------------------------

/// One menu item from the legacy form payload — either a `web_url` link or a
/// `postback` button. Mirrors the shape produced by the
/// `dashboard/custom-ecommerce/settings` form on the TS side.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum PersistentMenuItem {
    WebUrl { title: String, url: String },
    Postback { title: String, payload: String },
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SavePersistentMenuBody {
    #[serde(rename = "menuItems")]
    pub menu_items: Vec<PersistentMenuItem>,
}

// ---------------------------------------------------------------------------
//  Personas
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct PersonasResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub personas: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreatePersonaBody {
    pub name: String,
    #[serde(rename = "profilePictureUrl")]
    pub profile_picture_url: String,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct CreatePersonaResp {
    #[serde(skip_serializing_if = "Option::is_none", rename = "personaId")]
    pub persona_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Saved Responses
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct SavedResponsesResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub responses: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateSavedResponseBody {
    pub title: String,
    pub message: String,
    /// Optional URL of an image attachment (mirrors `formData.get('image')`).
    #[serde(default)]
    pub image: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateSavedResponseBody {
    pub title: String,
    pub message: String,
}

// ---------------------------------------------------------------------------
//  Reusable attachments
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UploadReusableAttachmentBody {
    /// `image | video | audio | file`.
    #[serde(rename = "type")]
    pub attachment_type: String,
    pub url: String,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct UploadReusableAttachmentResp {
    #[serde(skip_serializing_if = "Option::is_none", rename = "attachmentId")]
    pub attachment_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Project-id query selector — every endpoint in this crate is project-scoped.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectIdQuery {
    #[serde(rename = "projectId")]
    pub project_id: String,
}
