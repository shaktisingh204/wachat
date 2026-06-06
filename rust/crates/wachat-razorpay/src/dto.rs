//! Wire DTOs for the wachat-razorpay endpoints. `camelCase` to match the
//! JSON the `/wachat/integrations/razorpay` page sends/receives.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Response for `GET /projects/{id}/settings`.
///
/// `keySecret` is **never** returned raw — it is replaced with a masked
/// placeholder so the secret cannot leak back to the client while still
/// letting the UI render a "configured / not configured" state.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SettingsResponse {
    /// The public Razorpay key id (e.g. `rzp_test_...`). Empty if unset.
    pub key_id: String,
    /// Masked secret — `••••••••` when a secret is stored, empty otherwise.
    /// The raw secret is intentionally withheld.
    pub key_secret: String,
    /// Convenience flag for the UI: are both creds present?
    pub configured: bool,
}

/// Body for `PUT /projects/{id}/settings` — upserts `razorpaySettings`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PutSettingsBody {
    /// Razorpay key id (public).
    pub key_id: String,
    /// Razorpay key secret (sensitive). Stored verbatim on the project doc.
    pub key_secret: String,
}

/// `{ success: true }` envelope for PUT.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}

/// Response for the two log endpoints — a flat list of cleaned Razorpay
/// items (payments or payment links). The shapes are passed through
/// verbatim from Razorpay so the page can read `id`, `amount`, `status`,
/// `created_at`, etc.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LogsResponse {
    #[schema(value_type = Vec<Object>)]
    pub items: Vec<Value>,
}

/// Body for `POST /projects/{id}/payment-links` — create a Razorpay link.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreatePaymentLinkBody {
    /// Amount in **rupees** (whole-currency units). Converted to paise
    /// (`× 100`) before hitting Razorpay. Must be ≥ 1.
    pub amount: f64,
    /// Customer contact number (digits; Razorpay strips a leading +91).
    pub contact: String,
    /// Human description shown on the payment page.
    pub description: String,
    /// Optional customer display name.
    #[serde(default)]
    pub name: Option<String>,
    /// Optional customer email (enables email notification when present).
    #[serde(default)]
    pub email: Option<String>,
}

/// Response for `POST /projects/{id}/payment-links`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreatePaymentLinkResponse {
    /// Razorpay payment-link id (`plink_...`).
    pub id: String,
    /// Short shareable URL for the payment link.
    pub short_url: String,
}
