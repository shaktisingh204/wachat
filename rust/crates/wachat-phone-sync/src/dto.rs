//! Wire DTOs for the Meta `phone_numbers` and `whatsapp_business_profile`
//! endpoints, plus the request shape for [`crate::PhoneSync::update_profile`].
//!
//! These intentionally live in this crate (not `wachat-meta-dto`) because the
//! TS server actions in `whatsapp.actions.ts` are the only callers today.
//! Once a second consumer needs them, promote upstream.

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use wachat_meta_dto::Paging;

/// Wire shape of `GET /{wabaId}/phone_numbers`.
///
/// Mirrors `MetaPhoneNumbersResponse` (TS `definitions.ts` line 3023).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetaPhoneNumbersResp {
    #[serde(default)]
    pub data: Vec<MetaPhoneNumber>,
    #[serde(default)]
    pub paging: Option<Paging>,
}

/// Single phone-number row from Meta. Mirrors `MetaPhoneNumber`
/// (TS line 2407). Field-for-field shape; `whatsapp_business_profile` stays
/// the open-ended `PhoneNumberProfile` object Meta emits.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetaPhoneNumber {
    pub id: String,
    pub display_phone_number: String,
    pub verified_name: String,
    #[serde(default)]
    pub code_verification_status: Option<String>,
    #[serde(default)]
    pub quality_rating: Option<String>,
    #[serde(default)]
    pub platform_type: Option<String>,
    /// Open-ended throughput object (`{ "level": "STANDARD" | "HIGH" | ... }`).
    /// Kept as `Value` because the TS reads it through verbatim.
    #[serde(default)]
    pub throughput: Option<JsonValue>,
    /// Meta's nested business-profile object — the field is renamed to
    /// `profile` when we persist (TS `whatsapp.actions.ts` line 207:
    /// `profile: num.whatsapp_business_profile`).
    #[serde(default)]
    pub whatsapp_business_profile: Option<JsonValue>,
}

/// Locally-persisted phone-number doc — i.e. what ends up inside
/// `projects.phoneNumbers[]`. Mirrors the `phoneNumbers.map(...)` block at
/// TS lines 199–208: the only renaming versus [`MetaPhoneNumber`] is
/// `whatsapp_business_profile` → `profile`.
///
/// This is the **stored** shape; downstream code paths (e.g. dashboard
/// rendering) round-trip it through serde with `rename_all = "snake_case"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredPhoneNumber {
    pub id: String,
    pub display_phone_number: String,
    pub verified_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code_verification_status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quality_rating: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub platform_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub throughput: Option<JsonValue>,
    /// `whatsapp_business_profile` from Meta, persisted verbatim under the
    /// shorter local key `profile`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile: Option<JsonValue>,
}

impl From<MetaPhoneNumber> for StoredPhoneNumber {
    fn from(m: MetaPhoneNumber) -> Self {
        Self {
            id: m.id,
            display_phone_number: m.display_phone_number,
            verified_name: m.verified_name,
            code_verification_status: m.code_verification_status,
            quality_rating: m.quality_rating,
            platform_type: m.platform_type,
            throughput: m.throughput,
            profile: m.whatsapp_business_profile,
        }
    }
}

/// Request body for [`crate::PhoneSync::update_profile`].
///
/// Each `Option::None` field is omitted from the Meta payload **and** is not
/// touched on the local Mongo doc, mirroring the TS behavior of "only send
/// what was filled in" (lines 270–276). An empty `String` is treated like
/// the user clearing the field — see TS lines 301–306, where empty values
/// are still mirrored locally.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateProfileReq {
    pub about: Option<String>,
    pub address: Option<String>,
    pub description: Option<String>,
    pub email: Option<String>,
    pub vertical: Option<String>,
    /// Full website list. `Some(vec![])` clears, `None` leaves untouched.
    pub websites: Option<Vec<String>>,
    /// Pre-resolved Meta `profile_picture_handle` (output of the
    /// `/uploads` resumable session — that flow lives in a different crate).
    pub profile_picture_handle: Option<String>,
}

impl UpdateProfileReq {
    /// `true` if every field is `None` — the caller has nothing to send to
    /// Meta and nothing to mirror locally.
    pub fn is_empty(&self) -> bool {
        self.about.is_none()
            && self.address.is_none()
            && self.description.is_none()
            && self.email.is_none()
            && self.vertical.is_none()
            && self.websites.is_none()
            && self.profile_picture_handle.is_none()
    }
}
