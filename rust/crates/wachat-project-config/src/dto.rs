//! Public DTOs for the read + manual-setup endpoints.
//!
//! Both shapes are wire-facing and carry serde derives so the API layer
//! (`wachat-api`) can plumb them through Axum handlers unchanged.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use wachat_types::PhoneNumberSummary;

/// **Read-only** projection of [`wachat_types::Project`] safe to return
/// to the public API.
///
/// Every field of `Project` is preserved **except** the sensitive token
/// fields. The TS `getPublicProjectById` (line 19) returns the entire
/// document including `accessToken`; this Rust port closes that hole by
/// dropping the token at the projection boundary so a misuse upstream
/// (e.g. forgetting to scrub before serialization) physically cannot
/// leak it.
///
/// Fields explicitly **excluded** vs. `Project`:
/// * `accessToken` — long-lived Meta system-user token. Never returned.
///
/// `appSecret` is not on the `Project` shape today, but if/when it is
/// added it must be excluded here as well (see the inline test in
/// [`crate::config`] guarding the projection).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicProject {
    /// Mongo `_id`.
    #[serde(rename = "_id")]
    pub id: ObjectId,

    /// Owning user. FK into the `users` collection.
    pub user_id: ObjectId,

    /// Human-readable project name.
    pub name: String,

    /// Meta WhatsApp Business Account id.
    pub waba_id: Option<String>,

    /// Meta Business Manager id.
    pub business_id: Option<String>,

    /// Meta App id used for embedded signup.
    pub app_id: Option<String>,

    // NOTE: `access_token` is intentionally absent. See the type-level
    // doc above and the regression test `public_project_has_no_access_token`
    // in `config.rs`.
    /// Phone numbers attached to the WABA. Read-only summary shape.
    #[serde(default)]
    pub phone_numbers: Vec<PhoneNumberSummary>,

    /// Project-level rate limit (messages/sec).
    pub messages_per_second: Option<u32>,

    /// Per-project credit balance.
    pub credits: Option<f64>,

    /// Plan id (FK into `plans`).
    pub plan_id: Option<ObjectId>,

    /// WABA review state strings as Meta returns them.
    pub review_status: Option<String>,

    /// WABA ban state.
    pub ban_state: Option<String>,

    /// Created-at timestamp.
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: DateTime<Utc>,
}

/// Request shape for [`crate::ProjectConfig::manual_setup`].
///
/// Mirrors the `FormData` keys read by `handleManualWachatSetup`
/// (line 143) and the shape destructured at the top of
/// `_createProjectFromWaba` (line 33):
///
/// ```text
///   wabaId       (required)
///   appId        (required)
///   accessToken  (required)
///   businessId   (optional — populated only when includeCatalog=on)
/// ```
///
/// `includeCatalog`, plan lookup and phone-number sync are deliberately
/// out of scope for this slice — they belong to the API/orchestration
/// layer that composes catalog discovery + plan lookup + this crate.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualSetupReq {
    /// Human-readable project name. The TS path fetches this from Meta
    /// (`GET /{wabaId}?fields=name`) before insertion; in the Rust port
    /// the API layer is expected to do that fetch and pass the resolved
    /// name through.
    pub name: String,

    /// Meta WhatsApp Business Account id. Used as part of the upsert
    /// key alongside `userId`.
    pub waba_id: String,

    /// Meta phone-number id. Carried through for downstream syncs even
    /// though the TS slice does not persist it as a top-level field
    /// (the legacy code stores `phoneNumbers: []` and lets a follow-up
    /// `handleSyncPhoneNumbers` populate it).
    pub phone_number_id: String,

    /// Long-lived Meta system-user access token.
    pub access_token: String,

    /// Meta Business Manager id (optional — only set when the caller
    /// has resolved it via `me/businesses` for catalog features).
    pub business_id: Option<String>,

    /// Meta App id used for embedded signup. Optional in the request
    /// shape because some callers may defer it; the TS path treats it
    /// as required and we surface the same validation in
    /// [`crate::ProjectConfig::manual_setup`].
    pub app_id: Option<String>,
}
