//! Wire DTOs (HTTP request / response shapes) the config router speaks.
//!
//! Where engines already expose serde-friendly request/response types we
//! re-use them directly (e.g.
//! [`wachat_project_config::ManualSetupReq`]); where the engines take
//! plain function arguments, we mirror the wire shape here so the JSON
//! body deserializes cleanly.

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Shared envelopes
// ---------------------------------------------------------------------------

/// Generic `{ ok: true }` envelope used by endpoints that don't return
/// data (e.g. registration / deregistration).
#[derive(Debug, Clone, Serialize)]
pub struct OkResponse {
    pub ok: bool,
}

impl OkResponse {
    pub fn ok() -> Self {
        Self { ok: true }
    }
}

// ---------------------------------------------------------------------------
// `POST /projects/manual-setup`
// ---------------------------------------------------------------------------

/// Wire payload for `POST /projects/manual-setup`.
///
/// Re-export of [`wachat_project_config::ManualSetupReq`] under the
/// router's typed alias so callers / tests have a single import path.
pub type ManualSetupBody = wachat_project_config::ManualSetupReq;

// ---------------------------------------------------------------------------
// `POST /projects/{id}/phone-numbers/{pnid}/profile`
// ---------------------------------------------------------------------------

/// Wire payload for the phone-number profile update endpoint. Every
/// field is optional — Meta accepts partial profile updates.
///
/// Mirrors the keys read from the TS form action
/// `handleUpdatePhoneNumberProfile`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileBody {
    #[serde(default)]
    pub about: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub vertical: Option<String>,
    #[serde(default)]
    pub websites: Option<Vec<String>>,
    /// Pre-uploaded Meta profile-picture handle (multipart upload happens
    /// on a dedicated route, not this JSON one).
    #[serde(default)]
    pub profile_picture_handle: Option<String>,
}

// ---------------------------------------------------------------------------
// `GET /projects/{id}/webhook-subscription`
// ---------------------------------------------------------------------------

/// `?waba_id=…` query string for the webhook-subscription status read.
///
/// The WABA id is required and is **not** taken from the project
/// document because the same caller may want to inspect a WABA that has
/// not yet been wired into a Project row (admin / debug flows).
#[derive(Debug, Clone, Deserialize)]
pub struct WebhookSubscriptionQuery {
    pub waba_id: String,
}

// ---------------------------------------------------------------------------
// `POST /projects/{id}/webhooks/subscribe`
// ---------------------------------------------------------------------------

/// Wire payload for `POST /projects/{id}/webhooks/subscribe` — subscribe
/// one WABA to the configured app's webhook.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscribeOneBody {
    /// Meta app id whose webhook should receive WABA events.
    pub app_id: String,
    /// Caller's Meta user access token (NOT the long-lived system-user
    /// token — this endpoint mirrors the TS embedded-signup flow which
    /// uses the freshly-minted user token to subscribe).
    pub user_access_token: String,
}

// ---------------------------------------------------------------------------
// Phone-number register / verify
// ---------------------------------------------------------------------------

/// Wire payload for `POST /projects/{id}/phone-numbers/{pnid}/register`
/// and `POST /projects/{id}/phone-numbers/{pnid}/two-step-pin`.
#[derive(Debug, Clone, Deserialize)]
pub struct PinBody {
    /// Six-digit two-step verification PIN. Stored on Meta side; we
    /// pass it through unchanged.
    pub pin: String,
}

/// Wire payload for
/// `POST /projects/{id}/phone-numbers/{pnid}/request-verification-code`.
#[derive(Debug, Clone, Deserialize)]
pub struct RequestVerificationCodeBody {
    /// Delivery method — Meta accepts `"SMS"` or `"VOICE"`.
    pub method: String,
    /// IETF BCP 47 language tag (e.g. `"en"`, `"en_US"`).
    pub language: String,
}

/// Wire payload for `POST /projects/{id}/phone-numbers/{pnid}/verify-code`.
#[derive(Debug, Clone, Deserialize)]
pub struct VerifyCodeBody {
    /// One-time verification code Meta delivered to the phone.
    pub code: String,
}

// ---------------------------------------------------------------------------
// QR codes
// ---------------------------------------------------------------------------

/// Wire payload for
/// `POST /projects/{id}/phone-numbers/{pnid}/qr-codes` — create a QR.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateQrCodeBody {
    /// Pre-filled chat message that opens when the QR is scanned.
    pub prefilled_message: String,
    /// Whether Meta should also generate a PNG image for the QR.
    /// Defaults to `false` so we don't surprise callers with a heavier
    /// response shape.
    #[serde(default)]
    pub generate_qr_image: bool,
}

/// Wire payload for
/// `POST /projects/{id}/phone-numbers/{pnid}/qr-codes/{code}` — update
/// the prefilled message of an existing QR.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateQrCodeBody {
    /// New pre-filled chat message for the QR.
    pub prefilled_message: String,
}
