//! WhatsApp Business Account & Phone Number summary shapes.
//!
//! These types overlap with `wachat-meta-dto` (which models Meta's exact
//! API responses) but are kept in this domain crate because they're also
//! the shape we *persist* into `Project.phone_numbers` and the shape we
//! return from our own internal APIs.
//!
//! Sourced from `MetaWaba` (line ~2447) and `MetaPhoneNumber` (line ~2407)
//! in `src/lib/definitions.ts`, trimmed to the fields wachat handlers
//! actually consume. Calling/SIP/encryption settings live in the richer TS
//! `PhoneNumber` (line ~1195) and are intentionally **not** modeled here —
//! they're calling-feature concerns and can be added when we port that
//! module.

use serde::{Deserialize, Serialize};

/// Shallow phone-number summary.
///
/// The wachat broadcast/messages/templates code paths only need the four
/// fields here. Profile, throughput, calling and flow-encryption settings
/// belong to the calling-features crate (when ported).
///
/// Note: `id`, `display_phone_number` and `verified_name` are **Meta's**
/// strings (not Mongo `ObjectId`s) — this entire struct is identity data
/// from Meta, not a SabNode-side document.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PhoneNumberSummary {
    /// Meta phone-number id (`PHONE_NUMBER_ID` in Cloud API URLs).
    pub id: String,

    /// Human-readable phone number (e.g. `"+1 555-555-5555"`).
    pub display_phone_number: String,

    /// Verified business display name shown on the WhatsApp client.
    pub verified_name: String,

    /// Quality rating reported by Meta (`"GREEN" | "YELLOW" | "RED"`).
    /// Optional because freshly-provisioned numbers may not have one yet.
    pub quality_rating: Option<String>,
}

/// A WABA — top-level Meta WhatsApp Business Account.
///
/// Returned by the WABA-list endpoints and embedded into onboarding flows.
/// We persist `(id, name)` onto [`crate::Project`] via
/// `Project.waba_id` / project-level fields rather than storing the whole
/// struct.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct WhatsAppBusinessAccount {
    /// Meta WABA id.
    pub id: String,

    /// WABA display name.
    pub name: String,

    /// Phone numbers under this WABA. Wire shape comes back from Meta
    /// nested under `phone_numbers.data` — that unwrapping lives in the
    /// `wachat-meta-dto` crate; here we present the flat list.
    #[serde(default)]
    pub phone_numbers: Vec<PhoneNumberSummary>,

    /// IANA timezone string (e.g. `"Asia/Kolkata"`). Optional because not
    /// every WABA has it set.
    pub timezone: Option<String>,

    /// Legacy MM Lite namespace (still required for some on-premises-style
    /// template sends).
    pub message_template_namespace: Option<String>,
}
