//! Mirrors `Project` from `src/lib/definitions.ts` (line ~1439).
//!
//! Stored in the `projects` Mongo collection. Only the **wachat-relevant**
//! fields are modeled here — fields owned by other modules (CRM, ad-manager,
//! ecomm, kanban, billing, plan, etc.) are intentionally omitted. They can
//! be added in the crates that need them, or modeled as
//! `serde(flatten) extra: serde_json::Map<String, Value>` later if we need
//! to forward unknown fields.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::waba::PhoneNumberSummary;

/// A Wachat **Project** — the top-level tenant scope in the wachat module.
/// One project pins a single Meta WABA + business + app + access token, plus
/// the phone numbers under that WABA.
///
/// Mongo collection: `projects`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    /// Mongo `_id`. `ObjectId`, not `String` — the TS uses `ObjectId` directly.
    #[serde(rename = "_id")]
    pub id: ObjectId,

    /// Owning user. FK into the `users` collection.
    pub user_id: ObjectId,

    /// Human-readable project name. Optional for resilience against legacy
    /// documents that may have been imported without one.
    #[serde(default)]
    pub name: Option<String>,

    /// Meta WhatsApp Business Account id. Optional because freshly-created
    /// projects can exist before the embedded-signup callback runs.
    #[serde(default)]
    pub waba_id: Option<String>,

    /// Meta Business Manager id.
    #[serde(default)]
    pub business_id: Option<String>,

    /// Meta App id used for embedded signup.
    #[serde(default)]
    pub app_id: Option<String>,

    /// Long-lived Meta system-user access token. Stored encrypted at the app
    /// layer — this crate is only concerned with the document shape.
    ///
    /// Optional because it's empty between project creation and OAuth
    /// completion.
    #[serde(default)]
    pub access_token: Option<String>,

    /// Phone numbers attached to the WABA. Note this is the *summary* shape,
    /// not the full `PhoneNumber` (which carries calling/SIP/profile/encryption
    /// settings). Wachat handlers that need those richer fields read them
    /// from the source-of-truth Meta API or from a richer projection.
    #[serde(default)]
    pub phone_numbers: Vec<PhoneNumberSummary>,

    /// Project-level rate limit (messages/sec) for broadcast workers. Defaults
    /// to `None` (worker falls back to plan/global default).
    #[serde(default)]
    pub messages_per_second: Option<u32>,

    /// Per-project credit balance. `f64` because the TS treats it as a number
    /// and we deduct fractional amounts for partial-message billing.
    #[serde(default)]
    pub credits: Option<f64>,

    /// Plan id (FK into `plans`). Populated lookups happen in the consuming
    /// service, not here.
    #[serde(default)]
    pub plan_id: Option<ObjectId>,

    /// WABA review state strings as Meta returns them
    /// (e.g. `"APPROVED"`, `"REJECTED"`, `"PENDING_REVIEW"`).
    #[serde(default)]
    pub review_status: Option<String>,

    /// WABA ban state (e.g. `"DEFAULT"`, `"DISABLED"`, `"VIOLATION"`).
    #[serde(default)]
    pub ban_state: Option<String>,

    /// Created-at timestamp. BSON `Date` ⇄ `chrono::DateTime<Utc>` via the
    /// `bson` `chrono-0_4` feature. Optional — pre-existing documents may not
    /// have it.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub created_at: Option<DateTime<Utc>>,
}
