//! Wire-format DTOs for the SabChat commerce endpoints.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` to match
//! the JSON the TS shim sends. Stored documents that flow back out
//! (`payment_requests` list response, etc.) are surfaced as
//! `serde_json::Value` so the router stays out of the way when callers
//! evolve the document shape — same approach taken across the SabChat
//! crates.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// `POST /send-product/{conversationId}` — send_product
// ---------------------------------------------------------------------------

/// Body for `POST /send-product/{conversationId}`. The product is
/// looked up in the tenant's catalog (`crm_items` ∪ `shop`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SendProductBody {
    /// Hex `ObjectId` of the product in either `crm_items` or `shop`.
    pub product_id: String,
}

/// Response for `POST /send-product/{conversationId}`. Mirrors what the
/// `sabchat-messages` append response surfaces so the agent inbox can
/// re-use the same rendering path.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SendProductResponse {
    /// Hex `ObjectId` of the newly inserted `sabchat_messages` row.
    pub message_id: String,
}

// ---------------------------------------------------------------------------
// `POST /send-catalog/{conversationId}` — send_catalog
// ---------------------------------------------------------------------------

/// Body for `POST /send-catalog/{conversationId}`. The carousel
/// renders one [`sabchat_types::CarouselCard`] per product — order is
/// preserved.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SendCatalogBody {
    /// Hex `ObjectId`s of the products. Empty list is rejected.
    #[serde(default)]
    pub product_ids: Vec<String>,
}

/// Response for `POST /send-catalog/{conversationId}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SendCatalogResponse {
    /// Hex `ObjectId` of the newly inserted `sabchat_messages` row.
    pub message_id: String,
    /// Number of products that resolved successfully. Products that
    /// could not be found are silently skipped — empty result is a
    /// 404.
    pub count: u64,
}

// ---------------------------------------------------------------------------
// `POST /payment-link/{conversationId}` — payment_link
// ---------------------------------------------------------------------------

/// Body for `POST /payment-link/{conversationId}`. Provider defaults to
/// `razorpay` to match the existing wachat-pay default.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PaymentLinkBody {
    /// Amount in minor units (paise / cents) — same convention as
    /// [`sabchat_types::ContentBlock::Payment`].
    pub amount_minor: i64,
    /// ISO-4217 currency code (`INR`, `USD`, …).
    pub currency: String,
    /// Optional human-readable label rendered on the pay button.
    #[serde(default)]
    pub label: Option<String>,
    /// `razorpay` | `stripe` | `upi`. Unknown providers are rejected.
    #[serde(default)]
    pub provider: Option<String>,
    /// Optional TTL in seconds applied to `expires_at`.
    #[serde(default)]
    pub expires_in: Option<u32>,
}

/// Response for `POST /payment-link/{conversationId}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PaymentLinkResponse {
    /// Hex `ObjectId` of the newly inserted `sabchat_payment_requests`
    /// row. Quote this on the provider's webhook callback.
    pub payment_request_id: String,
    /// The minted checkout URL — already embedded in the appended
    /// [`sabchat_types::ContentBlock::Payment`] message; surfaced here
    /// for clients that want to copy / share it out-of-band.
    pub link_url: String,
}

// ---------------------------------------------------------------------------
// `POST /payment-callback` — payment_callback
// ---------------------------------------------------------------------------

/// Body for `POST /payment-callback`. The provider quotes back the
/// `paymentRequestId` we minted on `/payment-link/...` plus a coarse
/// status. `externalRef` is the provider's own transaction id and is
/// persisted verbatim for reconciliation.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PaymentCallbackBody {
    pub payment_request_id: String,
    /// `paid` | `failed` | `expired`. Other values are rejected.
    pub status: String,
    #[serde(default)]
    pub external_ref: Option<String>,
}

// ---------------------------------------------------------------------------
// `GET /payment-requests` — list_payment_requests
// ---------------------------------------------------------------------------

/// Query for `GET /payment-requests`. Lists every payment request
/// minted for the given conversation, newest first.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListPaymentRequestsQuery {
    pub conversation_id: String,
}

/// Response for `GET /payment-requests`. Returns raw stored documents
/// with ObjectIds rendered as hex strings.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListPaymentRequestsResponse {
    #[schema(value_type = Vec<Object>)]
    pub payment_requests: Vec<Value>,
    pub total: u64,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by the callback endpoint —
/// matches the convention used across the sibling routers.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
